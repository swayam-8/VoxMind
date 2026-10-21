import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { Collection } from '../../database/models/Collection.js';
import { Recording } from '../../database/models/Recording.js';
import { AppError } from '../../middleware/errorHandler.js';

export class CollectionsController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspaceId!;
      const collections = await Collection.find({ workspaceId }).sort({ createdAt: -1 }).lean();

      const collectionIds = collections.map((c) => c._id);
      const counts = await Recording.aggregate([
        { $match: { collectionId: { $in: collectionIds }, workspaceId } },
        { $group: { _id: '$collectionId', count: { $sum: 1 } } },
      ]);
      const countMap = new Map(counts.map((item) => [item._id, item.count]));

      const enriched = collections.map((c) => ({
        id: c._id,
        workspace_id: c.workspaceId,
        workspaceId: c.workspaceId,
        name: c.name,
        description: c.description,
        color: c.color,
        recording_count: countMap.get(c._id) || 0,
        recordingCount: countMap.get(c._id) || 0,
        created_at: c.createdAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
      }));

      return res.json({
        success: true,
        message: 'Collections retrieved',
        data: enriched,
        collections: enriched,
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspaceId!;
      const userId = req.user!._id;
      const { name, description, color } = req.body;

      const collection = await Collection.create({
        workspaceId,
        createdById: userId,
        name,
        description: description || '',
        color: color || '#6366f1',
      });

      const payload = {
        id: collection._id,
        workspace_id: collection.workspaceId,
        workspaceId: collection.workspaceId,
        name: collection.name,
        description: collection.description,
        color: collection.color,
        recording_count: 0,
        recordingCount: 0,
        created_at: collection.createdAt.toISOString(),
        createdAt: collection.createdAt.toISOString(),
      };

      return res.status(201).json({
        success: true,
        message: 'Collection created successfully',
        data: payload,
        ...payload,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const workspaceId = req.workspaceId!;

      const collection = await Collection.findOne({ _id: id, workspaceId }).lean();
      if (!collection) {
        throw new AppError('Collection not found', 404, 'COLLECTION_NOT_FOUND');
      }

      const recordings = await Recording.find({ collectionId: id, workspaceId })
        .sort({ createdAt: -1 })
        .lean();

      const payload = {
        id: collection._id,
        workspace_id: collection.workspaceId,
        workspaceId: collection.workspaceId,
        name: collection.name,
        description: collection.description,
        color: collection.color,
        recording_count: recordings.length,
        recordingCount: recordings.length,
        recordings: recordings.map((r) => ({
          id: r._id,
          title: r.title,
          status: r.status,
          duration_seconds: r.durationSeconds,
          durationSeconds: r.durationSeconds,
          created_at: r.createdAt.toISOString(),
          createdAt: r.createdAt.toISOString(),
        })),
        created_at: collection.createdAt.toISOString(),
        createdAt: collection.createdAt.toISOString(),
      };

      return res.json({
        success: true,
        message: 'Collection retrieved',
        data: payload,
        ...payload,
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const workspaceId = req.workspaceId!;
      const { name, description, color } = req.body;

      const collection = await Collection.findOne({ _id: id, workspaceId });
      if (!collection) {
        throw new AppError('Collection not found', 404, 'COLLECTION_NOT_FOUND');
      }

      if (name !== undefined) collection.name = name;
      if (description !== undefined) collection.description = description;
      if (color !== undefined) collection.color = color;

      await collection.save();

      const payload = {
        id: collection._id,
        name: collection.name,
        description: collection.description,
        color: collection.color,
        updated_at: collection.updatedAt.toISOString(),
      };

      return res.json({
        success: true,
        message: 'Collection updated',
        data: payload,
        ...payload,
      });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const workspaceId = req.workspaceId!;

      const collection = await Collection.findOne({ _id: id, workspaceId });
      if (!collection) {
        throw new AppError('Collection not found', 404, 'COLLECTION_NOT_FOUND');
      }

      await Recording.updateMany({ collectionId: id, workspaceId }, { $set: { collectionId: null } });
      await Collection.deleteOne({ _id: id });

      return res.json({
        success: true,
        message: 'Collection deleted successfully',
        data: { id },
        id,
      });
    } catch (error) {
      next(error);
    }
  }

  static async addRecording(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const recordingId = req.body.recording_id || req.body.recordingId;
      const recordingIds = req.body.recording_ids || req.body.recordingIds || (recordingId ? [recordingId] : []);
      const workspaceId = req.workspaceId!;

      const collection = await Collection.findOne({ _id: id, workspaceId });
      if (!collection) {
        throw new AppError('Collection not found', 404, 'COLLECTION_NOT_FOUND');
      }

      await Recording.updateMany(
        { _id: { $in: recordingIds }, workspaceId },
        { $set: { collectionId: id } }
      );

      const payload = {
        collection_id: id,
        assigned_count: recordingIds.length,
      };

      return res.json({
        success: true,
        message: 'Recordings added to collection',
        data: payload,
        ...payload,
      });
    } catch (error) {
      next(error);
    }
  }

  static async removeRecording(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id, recordingId } = req.params;
      const workspaceId = req.workspaceId!;

      const recording = await Recording.findOne({ _id: recordingId, workspaceId, collectionId: id });
      if (!recording) {
        throw new AppError('Recording not found in collection', 404, 'RECORDING_NOT_FOUND');
      }

      recording.collectionId = null;
      await recording.save();

      const payload = {
        recording_id: recordingId,
        collection_id: id,
      };

      return res.json({
        success: true,
        message: 'Recording removed from collection',
        data: payload,
        ...payload,
      });
    } catch (error) {
      next(error);
    }
  }
}
