import jwt from 'jsonwebtoken';
import type { Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { authenticate, type AuthenticatedRequest } from './auth.js';
import { AppError } from './errorHandler.js';
import { User } from '../database/models/User.js';
import { WorkspaceMembership } from '../database/models/WorkspaceMembership.js';
import { ApiKey } from '../database/models/ApiKey.js';

type AudioTicket = { purpose: 'recording-audio'; recordingId: string; workspaceId: string; userId: string; tokenVersion: number; apiKeyId?: string };
export function issueAudioTicket(req: AuthenticatedRequest, recordingId: string) {
  return jwt.sign({ purpose: 'recording-audio', recordingId, workspaceId: req.workspaceId, userId: req.user!._id,
    tokenVersion: req.user!.tokenVersion ?? 0, ...(req.apiKey ? { apiKeyId: req.apiKey._id } : {}),
  }, config.jwtSecret, { algorithm: 'HS256', issuer: 'voxmind', audience: 'voxmind-audio', expiresIn: '15m' });
}

/** Query credentials are permitted only as short-lived tickets for one audio file. */
export async function authenticateAudio(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.query.ticket) return authenticate(req, res, next);
  try {
    if (typeof req.query.ticket !== 'string') throw new Error('Invalid ticket');
    const ticket = jwt.verify(req.query.ticket, config.jwtSecret, {
      algorithms: ['HS256'], issuer: 'voxmind', audience: 'voxmind-audio',
    }) as AudioTicket;
    if (ticket.purpose !== 'recording-audio' || ticket.recordingId !== req.params.id || typeof ticket.userId !== 'string' || typeof ticket.workspaceId !== 'string') throw new Error('Wrong audio');
    const user = await User.findById(ticket.userId);
    if (!user?.isActive || (user.tokenVersion ?? 0) !== ticket.tokenVersion) throw new Error('Session expired');
    const membership = await WorkspaceMembership.findOne({ userId: user._id, workspaceId: ticket.workspaceId });
    if (!membership) throw new Error('Membership removed');
    if (ticket.apiKeyId && !(await ApiKey.exists({ _id: ticket.apiKeyId, userId: user._id, workspaceId: ticket.workspaceId, isRevoked: false,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }))) throw new Error('Key revoked');
    req.user = user; req.workspaceId = membership.workspaceId; req.userRole = membership.role;
    next();
  } catch { next(new AppError('Audio access expired. Refresh the recording and try again.', 401, 'INVALID_AUDIO_TICKET')); }
}
