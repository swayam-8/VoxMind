import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../../database/models/User.js';
import { Workspace } from '../../database/models/Workspace.js';
import { WorkspaceMembership } from '../../database/models/WorkspaceMembership.js';
import { TokenService } from '../../services/tokenService.js';
import { AppError } from '../../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { ApiKey } from '../../database/models/ApiKey.js';

// Equalize the password work for unknown and known accounts.
const dummyPasswordHash = bcrypt.hashSync('voxmind-non-account-password-check', 10);

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, fullName } = req.body;

      const existing = await User.findOne({ email: email.toLowerCase().trim() });
      if (existing) {
        throw new AppError('Email is already registered', 409, 'EMAIL_EXISTS');
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create({
        email: email.toLowerCase().trim(),
        passwordHash,
        fullName: (fullName || '').trim(),
      });

      // Create personal workspace for the user
      const slug = `ws-${user._id.substring(0, 8)}`;
      const workspace = await Workspace.create({
        name: `${fullName?.trim() || email.split('@')[0]}'s Workspace`,
        slug,
        createdBy: user._id,
        isPersonal: true,
      });

      await WorkspaceMembership.create({
        workspaceId: workspace._id,
        userId: user._id,
        role: 'owner',
      });

      const token = TokenService.sign({
        userId: user._id,
        email: user.email,
        workspaceId: workspace._id,
        isSuperuser: user.isSuperuser,
        tokenVersion: user.tokenVersion ?? 0,
      });

      const payload = {
        access_token: token,
        accessToken: token,
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          isActive: user.isActive,
        },
        workspace: {
          id: workspace._id,
          name: workspace.name,
          slug: workspace.slug,
          role: 'owner',
        },
      };

      return res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: payload,
        ...payload,
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email: email.toLowerCase().trim() });
      if (!user || !user.isActive) {
        await bcrypt.compare(password, dummyPasswordHash);
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      const isMatch = await user.checkPassword(password);
      if (!isMatch) {
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      const membership = await WorkspaceMembership.findOne({ userId: user._id });
      const workspace = membership ? await Workspace.findById(membership.workspaceId) : null;
      if (!workspace || !membership) throw new AppError('No active workspace membership', 403, 'WORKSPACE_FORBIDDEN');
      const role = membership.role;

      const token = TokenService.sign({
        userId: user._id,
        email: user.email,
        workspaceId: workspace._id,
        isSuperuser: user.isSuperuser,
        tokenVersion: user.tokenVersion ?? 0,
      });

      const payload = {
        access_token: token,
        accessToken: token,
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          isActive: user.isActive,
        },
        workspace: {
          id: workspace._id,
          name: workspace.name,
          slug: workspace.slug,
          role,
        },
      };

      return res.json({
        success: true,
        message: 'Signed in successfully',
        data: payload,
        ...payload,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const workspace = await Workspace.findById(req.workspaceId);

      const payload = {
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          isActive: user.isActive,
        },
        workspace: workspace
          ? {
              id: workspace._id,
              name: workspace.name,
              slug: workspace.slug,
              role: req.userRole || 'owner',
            }
          : null,
      };

      return res.json({
        success: true,
        message: 'Current profile retrieved',
        data: payload,
        ...payload,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { fullName, currentPassword, newPassword } = req.body;

      if (fullName !== undefined) {
        user.fullName = fullName.trim();
      }

      if (newPassword) {
        if (!currentPassword) {
          throw new AppError('Current password is required to set a new password', 400, 'PASSWORD_REQUIRED');
        }
        const isMatch = await user.checkPassword(currentPassword);
        if (!isMatch) {
          throw new AppError('Current password is incorrect', 400, 'INVALID_PASSWORD');
        }
        if (newPassword.length < 8) {
          throw new AppError('New password must be at least 8 characters long', 400, 'PASSWORD_TOO_SHORT');
        }
        user.passwordHash = await bcrypt.hash(newPassword, 10);
        user.tokenVersion = (user.tokenVersion ?? 0) + 1;
        await ApiKey.updateMany({ userId: user._id }, { $set: { isRevoked: true } });
      }

      await user.save();

      const workspace = await Workspace.findById(req.workspaceId);

      const payload = {
        ...(newPassword ? { access_token: TokenService.sign({
          userId: user._id, email: user.email, workspaceId: req.workspaceId,
          tokenVersion: user.tokenVersion,
        }) } : {}),
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          isActive: user.isActive,
        },
        workspace: workspace
          ? {
              id: workspace._id,
              name: workspace.name,
              slug: workspace.slug,
              role: req.userRole || 'owner',
            }
          : null,
      };

      return res.json({
        success: true,
        message: 'Profile updated successfully',
        data: payload,
        ...payload,
      });
    } catch (error) {
      next(error);
    }
  }
}
