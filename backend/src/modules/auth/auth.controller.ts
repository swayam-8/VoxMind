import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../../database/models/User.js';
import { Workspace } from '../../database/models/Workspace.js';
import { WorkspaceMembership } from '../../database/models/WorkspaceMembership.js';
import { TokenService } from '../../services/tokenService.js';
import { AppError } from '../../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, fullName } = req.body;

      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        throw new AppError('Email is already registered', 409, 'EMAIL_EXISTS');
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create({
        email: email.toLowerCase(),
        passwordHash,
        fullName: fullName || '',
      });

      // Create personal workspace for the user
      const slug = `ws-${user._id.substring(0, 8)}`;
      const workspace = await Workspace.create({
        name: `${fullName || email.split('@')[0]}'s Workspace`,
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
      });

      return res.status(201).json({
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
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      const isMatch = await user.checkPassword(password);
      if (!isMatch) {
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      // Find workspace
      let workspace = await Workspace.findOne({ createdBy: user._id });
      let role = 'owner';

      if (!workspace) {
        const membership = await WorkspaceMembership.findOne({ userId: user._id });
        if (membership) {
          workspace = await Workspace.findById(membership.workspaceId);
          role = membership.role;
        }
      }

      if (!workspace) {
        workspace = await Workspace.create({
          name: `${user.fullName || user.email.split('@')[0]}'s Workspace`,
          slug: `ws-${user._id.substring(0, 8)}`,
          createdBy: user._id,
          isPersonal: true,
        });
        await WorkspaceMembership.create({
          workspaceId: workspace._id,
          userId: user._id,
          role: 'owner',
        });
      }

      const token = TokenService.sign({
        userId: user._id,
        email: user.email,
        workspaceId: workspace._id,
        isSuperuser: user.isSuperuser,
      });

      return res.json({
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
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const workspace = await Workspace.findById(req.workspaceId);

      return res.json({
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
      });
    } catch (error) {
      next(error);
    }
  }
}
