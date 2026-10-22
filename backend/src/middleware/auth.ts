import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { HydratedDocument } from 'mongoose';
import { TokenService } from '../services/tokenService.js';
import { User, IUser } from '../database/models/User.js';
import { WorkspaceMembership } from '../database/models/WorkspaceMembership.js';
import { Workspace } from '../database/models/Workspace.js';
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
    const queryToken = req.query.token as string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (apiKeyHeader) {
      token = apiKeyHeader.trim();
    } else if (queryToken) {
      token = queryToken.trim();
    }

    if (!token) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    // Check if token is an API key (starts with "vm_live_")
    if (token.startsWith('vm_live_')) {
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

      req.user = user;
      req.workspaceId = apiKey.workspaceId;
      req.apiKey = apiKey;
      req.userRole = 'admin'; // API keys act with admin workspace permissions
      return next();
    }

    // Otherwise, treat as JWT token
    try {
      const decoded = TokenService.verify(token);
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new AppError('User not found or disabled', 401, 'USER_DISABLED');
      }

      req.user = user;

      // Determine workspace
      let workspaceId = decoded.workspaceId;
      if (!workspaceId) {
        // Find default membership or workspace
        const membership = await WorkspaceMembership.findOne({ userId: user._id });
        if (membership) {
          workspaceId = membership.workspaceId;
          req.userRole = membership.role;
        } else {
          // Find or create personal workspace
          let personalWorkspace = await Workspace.findOne({ createdBy: user._id });
          if (!personalWorkspace) {
            personalWorkspace = await Workspace.create({
              name: `${user.fullName || user.email}'s Workspace`,
              slug: `ws-${user._id.substring(0, 8)}`,
              createdBy: user._id,
              isPersonal: true,
            });
            await WorkspaceMembership.create({
              workspaceId: personalWorkspace._id,
              userId: user._id,
              role: 'owner',
            });
          }
          workspaceId = personalWorkspace._id;
          req.userRole = 'owner';
        }
      } else {
        const membership = await WorkspaceMembership.findOne({
          workspaceId,
          userId: user._id,
        });
        req.userRole = membership?.role || 'viewer';
      }

      req.workspaceId = workspaceId;
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
    if (req.user.isSuperuser) {
      return next();
    }
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      return next(new AppError('Insufficient permissions for this workspace resource', 403, 'FORBIDDEN'));
    }
    next();
  };
}
