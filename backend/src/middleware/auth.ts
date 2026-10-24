import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { HydratedDocument } from 'mongoose';
import { TokenService } from '../services/tokenService.js';
import { User, IUser } from '../database/models/User.js';
import { WorkspaceMembership } from '../database/models/WorkspaceMembership.js';
import { ApiKey, IApiKey } from '../database/models/ApiKey.js';
import { AppError } from './errorHandler.js';

export interface AuthenticatedRequest extends Request {
  user?: HydratedDocument<IUser>;
  workspaceId?: string;
  userRole?: string;
  apiKey?: IApiKey;
}

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'] as string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (apiKeyHeader) {
      token = apiKeyHeader.trim();
    }

    if (!token) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    // Check if token is an API key (starts with "vm_live_")
    if (token.startsWith('vm_live_') || token.startsWith('mb_live_')) {
      const keyHash = crypto.createHash('sha256').update(token).digest('hex');
      const apiKey = await ApiKey.findOne({ keyHash, isRevoked: false });

      if (!apiKey) {
        throw new AppError('Invalid or revoked API key', 401, 'INVALID_API_KEY');
      }

      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        throw new AppError('API key has expired', 401, 'EXPIRED_API_KEY');
      }

      // Update lastUsedAt asynchronously
      ApiKey.updateOne({ _id: apiKey._id }, { lastUsedAt: new Date() }).exec().catch(() => {});

      const user = await User.findById(apiKey.userId);
      if (!user || !user.isActive) {
        throw new AppError('User not found or disabled', 401, 'USER_DISABLED');
      }

      const membership = await WorkspaceMembership.findOne({ workspaceId: apiKey.workspaceId, userId: user._id });
      if (!membership) throw new AppError('Workspace access has been removed', 403, 'WORKSPACE_FORBIDDEN');

      req.user = user;
      req.workspaceId = apiKey.workspaceId;
      req.apiKey = apiKey;
      req.userRole = membership.role;
      const requestPath = req.originalUrl.split('?')[0].replace(/\/+$/, '');
      const readRequest = ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ||
        (req.method === 'POST' && (/^\/api\/v1\/recordings\/[^/]+\/(ask|audio-ticket)$/.test(requestPath) ||
          ['/api/v1/knowledge/ask', '/api/v1/search'].includes(requestPath)));
      if ((apiKey.accessLevel || 'read') === 'read' && !readRequest) {
        throw new AppError('This key has read-only access. Create a read and write key for uploads or changes.', 403, 'API_KEY_READ_ONLY');
      }
      return next();
    }

    // Otherwise, treat as JWT token
    try {
      const decoded = TokenService.verify(token);
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new AppError('User not found or disabled', 401, 'USER_DISABLED');
      }
      if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
        throw new AppError('Session expired. Sign in again.', 401, 'INVALID_TOKEN');
      }

      req.user = user;

      const membership = await WorkspaceMembership.findOne({
        userId: user._id, ...(decoded.workspaceId ? { workspaceId: decoded.workspaceId } : {}),
      });
      if (!membership) throw new AppError('Workspace access has been removed', 403, 'WORKSPACE_FORBIDDEN');
      req.userRole = membership.role;
      req.workspaceId = membership.workspaceId;
      return next();
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
    }
  } catch (error) {
    next(error);
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      return next(new AppError('Insufficient permissions for this workspace resource', 403, 'FORBIDDEN'));
    }
    next();
  };
}

/** Personal credentials, billing and OAuth connections require an interactive session. */
export function requireSession(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  if (req.apiKey) return next(new AppError('Sign in to manage account credentials', 403, 'SESSION_REQUIRED'));
  next();
}

/** Deployment-wide diagnostics are reserved for the service operator. */
export function requireOperator(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  if (!req.user?.isSuperuser) return next(new AppError('Service operator access required', 403, 'OPERATOR_REQUIRED'));
  next();
}
