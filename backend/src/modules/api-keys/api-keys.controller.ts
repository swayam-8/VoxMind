import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { ApiKey } from '../../database/models/ApiKey.js';
import { AppError } from '../../middleware/errorHandler.js';

export class ApiKeysController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspaceId!;
      const keys = await ApiKey.find({ workspaceId }).sort({ createdAt: -1 }).lean();

      const enriched = keys.map((k) => ({
        id: k._id,
        workspace_id: k.workspaceId,
        user_id: k.userId,
        name: k.name,
        key_prefix: k.keyPrefix,
        keyPrefix: k.keyPrefix,
        is_revoked: k.isRevoked,
        isRevoked: k.isRevoked,
        last_used_at: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
        lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
        expires_at: k.expiresAt ? k.expiresAt.toISOString() : null,
        expiresAt: k.expiresAt ? k.expiresAt.toISOString() : null,
        created_at: k.createdAt.toISOString(),
        createdAt: k.createdAt.toISOString(),
      }));

      return res.json({
        success: true,
        message: 'API keys retrieved',
        data: enriched,
        api_keys: enriched,
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspaceId!;
      const userId = req.user!._id;
      const { name } = req.body;
      const expiresInDays = req.body.expires_days || req.body.expires_in_days || req.body.expiresInDays;

      const randomPart = crypto.randomBytes(24).toString('hex');
      const rawKey = `vm_live_${randomPart}`;
      const keyPrefix = `${rawKey.substring(0, 16)}...`;
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      let expiresAt: Date | null = null;
      if (expiresInDays) {
        expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
      }

      const apiKey = await ApiKey.create({
        workspaceId,
        userId,
        name,
        keyPrefix,
        keyHash,
        expiresAt,
      });

      const payload = {
        id: apiKey._id,
        name: apiKey.name,
        key_prefix: apiKey.keyPrefix,
        keyPrefix: apiKey.keyPrefix,
        raw_key: rawKey,
        rawKey: rawKey,
        is_revoked: false,
        expires_at: apiKey.expiresAt ? apiKey.expiresAt.toISOString() : null,
        expiresAt: apiKey.expiresAt ? apiKey.expiresAt.toISOString() : null,
        created_at: apiKey.createdAt.toISOString(),
        createdAt: apiKey.createdAt.toISOString(),
      };

      return res.status(201).json({
        success: true,
        message: 'API key created successfully',
        data: payload,
        ...payload,
      });
    } catch (error) {
      next(error);
    }
  }

  static async revoke(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const workspaceId = req.workspaceId!;

      const key = await ApiKey.findOne({ _id: id, workspaceId });
      if (!key) {
        throw new AppError('API key not found', 404, 'API_KEY_NOT_FOUND');
      }

      key.isRevoked = true;
      await key.save();

      const payload = {
        id: key._id,
        is_revoked: true,
      };

      return res.json({
        success: true,
        message: 'API key revoked successfully',
        data: payload,
        ...payload,
      });
    } catch (error) {
      next(error);
    }
  }
}
