import { Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { Recording } from '../../database/models/Recording.js';
import { TranscriptSegment } from '../../database/models/TranscriptSegment.js';
import { TranscriptChunk } from '../../database/models/TranscriptChunk.js';
import { Summary } from '../../database/models/Summary.js';
import { ActionItem } from '../../database/models/ActionItem.js';
import { Collection } from '../../database/models/Collection.js';
import { ApiUsageRecord } from '../../database/models/ApiUsageRecord.js';
import { audioQueue } from '../../queues/audioQueue.js';
import { aiQueue } from '../../queues/aiQueue.js';
import { AiServiceClient } from '../../services/aiServiceClient.js';
import { AppError } from '../../middleware/errorHandler.js';

export class RecordingsController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspaceId!;
      const page = Number(req.query.page) || 1;
      const pageSize = Number(req.query.per_page || req.query.page_size || req.query.pageSize) || 20;
      const status = req.query.status as string | undefined;
      const collectionId = (req.query.collection_id || req.query.collectionId) as string | undefined;
      const search = req.query.search as string | undefined;

      const filter: any = { workspaceId };

      if (status && status !== 'all') {
        filter.status = status;
      }
      if (collectionId && collectionId !== 'all') {
        filter.collectionId = collectionId;
      }
      if (search && search.trim()) {
        filter.title = { $regex: search.trim(), $options: 'i' };
      }

      const total = await Recording.countDocuments(filter);
      const recordings = await Recording.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean();

      // Enrich recordings with summary preview and collection name
      const recordingIds = recordings.map((r) => r._id);
      const summaries = await Summary.find({ recordingId: { $in: recordingIds } }).lean();
      const summaryMap = new Map(summaries.map((s) => [s.recordingId, s]));

      const collectionIds = recordings.map((r) => r.collectionId).filter(Boolean);
      const collections = await Collection.find({ _id: { $in: collectionIds } }).lean();
      const collectionMap = new Map(collections.map((c) => [c._id, c]));

      const enriched = recordings.map((r) => {
        const s = summaryMap.get(r._id);
        const c = r.collectionId ? collectionMap.get(r.collectionId) : null;
        return {
          id: r._id,
          workspace_id: r.workspaceId,
          workspaceId: r.workspaceId,
          user_id: r.userId,
          userId: r.userId,
          collection_id: r.collectionId,
          collectionId: r.collectionId,
          collection_name: c ? c.name : null,
          collection: c ? { id: c._id, name: c.name, color: c.color } : null,
          title: r.title,
          filename: r.filename,
          file_size_bytes: r.fileSizeBytes,
          fileSizeBytes: r.fileSizeBytes,
          duration_seconds: r.durationSeconds,
          durationSeconds: r.durationSeconds,
          mime_type: r.mimeType,
          mimeType: r.mimeType,
          status: r.status,
          error_message: r.errorMessage,
          errorMessage: r.errorMessage,
          language: r.language,
          index_status: r.indexStatus,
          indexStatus: r.indexStatus,
          has_summary: Boolean(s),
          summary_preview: s ? s.summaryMarkdown?.slice(0, 160) : null,
          created_at: r.createdAt.toISOString(),
          createdAt: r.createdAt.toISOString(),
          updated_at: r.updatedAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        };
      });

      const pages = Math.ceil(total / pageSize);

      return res.json({
        success: true,
        message: 'Recordings retrieved successfully',
        data: enriched,
        recordings: enriched,
        total,
        page,
        per_page: pageSize,
        page_size: pageSize,
        pages,
        total_pages: pages,
        meta: {
          page,
          per_page: pageSize,
          total,
          pages,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async upload(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new AppError('No audio file provided', 400, 'NO_FILE_PROVIDED');
      }

      const workspaceId = req.workspaceId!;
      const userId = req.user!._id;
      const title =
        req.body.title ||
        path.basename(req.file.originalname, path.extname(req.file.originalname));
      const collectionId = req.body.collection_id || req.body.collectionId || null;
      const language = req.body.language || null;

      const recording = await Recording.create({
        workspaceId,
        userId,
        collectionId,
        title,
        filename: req.file.originalname,
        storagePath: req.file.path,
        fileSizeBytes: req.file.size,
        mimeType: req.file.mimetype || 'audio/wav',
        status: 'queued',
        language,
        indexStatus: 'pending',
      });

      // Enqueue BullMQ transcription job
      const job = await audioQueue.add('transcribe-audio', { recordingId: recording._id });
      recording.transcriptionJobId = job.id || null;
      await recording.save();

      const responsePayload = {
        id: recording._id,
        recording_id: recording._id,
        recordingId: recording._id,
        workspace_id: recording.workspaceId,
        user_id: recording.userId,
        title: recording.title,
        filename: recording.filename,
        file_size_bytes: recording.fileSizeBytes,
        duration_seconds: recording.durationSeconds,
        mime_type: recording.mimeType,
        status: recording.status,
        collection_id: recording.collectionId,
        index_status: recording.indexStatus,
        created_at: recording.createdAt.toISOString(),
        updated_at: recording.updatedAt.toISOString(),
      };

      return res.status(201).json({
        success: true,
        message: 'Audio recording queued for processing',
        data: responsePayload,
        ...responsePayload,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const workspaceId = req.workspaceId!;

      const recording = await Recording.findOne({ _id: id, workspaceId });
      if (!recording) {
        throw new AppError('Recording not found', 404, 'RECORDING_NOT_FOUND');
      }

      const segments = await TranscriptSegment.find({ recordingId: id })
        .sort({ segmentIndex: 1 })
        .lean();

      const summary = await Summary.findOne({ recordingId: id }).lean();
      const actionItems = await ActionItem.find({ recordingId: id }).lean();

      let collection = null;
      if (recording.collectionId) {
        collection = await Collection.findById(recording.collectionId).lean();
      }

      const payload = {
        id: recording._id,
        workspace_id: recording.workspaceId,
        workspaceId: recording.workspaceId,
        user_id: recording.userId,
        userId: recording.userId,
        collection_id: recording.collectionId,
        collectionId: recording.collectionId,
        collection_name: collection ? collection.name : null,
        collection: collection ? { id: collection._id, name: collection.name, color: collection.color } : null,
        title: recording.title,
        filename: recording.filename,
        file_size_bytes: recording.fileSizeBytes,
        fileSizeBytes: recording.fileSizeBytes,
        duration_seconds: recording.durationSeconds,
        durationSeconds: recording.durationSeconds,
        mime_type: recording.mimeType,
        mimeType: recording.mimeType,
        status: recording.status,
        error_message: recording.errorMessage,
        errorMessage: recording.errorMessage,
        language: recording.language,
        index_status: recording.indexStatus,
        indexStatus: recording.indexStatus,
        created_at: recording.createdAt.toISOString(),
        createdAt: recording.createdAt.toISOString(),
        updated_at: recording.updatedAt.toISOString(),
        updatedAt: recording.updatedAt.toISOString(),
        segments: segments.map((s) => ({
          id: s._id,
          recording_id: s.recordingId,
          segment_index: s.segmentIndex,
          segmentIndex: s.segmentIndex,
          start_time: s.startTime,
          startTime: s.startTime,
          end_time: s.endTime,
          endTime: s.endTime,
          speaker: s.speaker,
          text: s.text,
          confidence: s.confidence,
        })),
        summaries: summary
          ? [
              {
                id: summary._id,
                recording_id: summary.recordingId,
                model_name: summary.modelName,
                status: 'completed',
                summary_markdown: summary.summaryMarkdown,
                key_takeaways: summary.keyTakeaways || [],
                decisions: (summary.decisions || []).map((d: any) => typeof d === 'string' ? { decision: d } : d),
                topics: summary.topics || [],
                created_at: summary.createdAt ? summary.createdAt.toISOString() : new Date().toISOString(),
                updated_at: summary.updatedAt ? summary.updatedAt.toISOString() : new Date().toISOString(),
              },
            ]
          : [],
        summary: summary
          ? {
              id: summary._id,
              recording_id: summary.recordingId,
              model_name: summary.modelName,
              modelName: summary.modelName,
              summary_markdown: summary.summaryMarkdown,
              summaryMarkdown: summary.summaryMarkdown,
              key_takeaways: summary.keyTakeaways || [],
              keyTakeaways: summary.keyTakeaways || [],
              decisions: (summary.decisions || []).map((d: any) => typeof d === 'string' ? { decision: d } : d),
              topics: summary.topics || [],
              action_items: summary.actionItems || [],
              prompt_tokens: summary.promptTokens,
              completion_tokens: summary.completionTokens,
              created_at: summary.createdAt ? summary.createdAt.toISOString() : new Date().toISOString(),
            }
          : null,
        action_items: actionItems.map((a) => ({
          id: a._id,
          recording_id: a.recordingId,
          task: a.task,
          assignee: a.assignee,
          due_date: a.dueDate,
          dueDate: a.dueDate,
          status: a.status,
          completed: a.status === 'completed',
          priority: a.priority,
        })),
      };

      return res.json({
        success: true,
        message: 'Recording details retrieved',
        data: payload,
        ...payload,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getTranscript(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const workspaceId = req.workspaceId!;

      const recording = await Recording.findOne({ _id: id, workspaceId });
      if (!recording) {
        throw new AppError('Recording not found', 404, 'RECORDING_NOT_FOUND');
      }

      const segments = await TranscriptSegment.find({ recordingId: id })
        .sort({ segmentIndex: 1 })
        .lean();

      const payload = {
        recording_id: id,
        status: recording.status,
        error_message: recording.errorMessage,
        count: segments.length,
        segments: segments.map((s) => ({
          id: s._id,
          recording_id: s.recordingId,
          segment_index: s.segmentIndex,
          start_time: s.startTime,
          end_time: s.endTime,
          speaker: s.speaker,
          text: s.text,
          confidence: s.confidence,
        })),
      };

      return res.json({
        success: true,
        message: 'Transcript retrieved',
        data: payload,
        ...payload,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAnalysis(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const workspaceId = req.workspaceId!;

      const recording = await Recording.findOne({ _id: id, workspaceId });
      if (!recording) {
        throw new AppError('Recording not found', 404, 'RECORDING_NOT_FOUND');
      }

      const summary = await Summary.findOne({ recordingId: id }).lean();
      const actionItems = await ActionItem.find({ recordingId: id }).lean();

      if (!summary) {
        throw new AppError('Analysis not yet generated for this recording', 404, 'ANALYSIS_NOT_FOUND');
      }

      const payload = {
        id: summary._id,
        recording_id: summary.recordingId,
        model_name: summary.modelName,
        status: 'completed',
        summary_markdown: summary.summaryMarkdown,
        key_takeaways: summary.keyTakeaways || [],
        decisions: (summary.decisions || []).map((d: any) => typeof d === 'string' ? { decision: d } : d),
        topics: summary.topics || [],
        created_at: summary.createdAt ? summary.createdAt.toISOString() : new Date().toISOString(),
        updated_at: summary.updatedAt ? summary.updatedAt.toISOString() : new Date().toISOString(),
        action_items: actionItems.map((a) => ({
          id: a._id,
          recording_id: a.recordingId,
          task: a.task,
          assignee: a.assignee,
          due_date: a.dueDate,
          completed: a.status === 'completed',
        })),
      };

      return res.json({
        success: true,
        message: 'Analysis retrieved',
        data: payload,
        ...payload,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAnalysisStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const workspaceId = req.workspaceId!;

      const recording = await Recording.findOne({ _id: id, workspaceId });
      if (!recording) {
        throw new AppError('Recording not found', 404, 'RECORDING_NOT_FOUND');
      }

      const summary = await Summary.findOne({ recordingId: id }).lean();

      const payload = {
        recording_id: id,
        summary_id: summary?._id || undefined,
        status: summary ? 'completed' : recording.status === 'processing' ? 'processing' : 'pending',
        model_name: summary?.modelName || 'llama3.2',
        completed_at: summary?.updatedAt ? summary.updatedAt.toISOString() : undefined,
      };

      return res.json({
        success: true,
        message: 'Analysis status retrieved',
        data: payload,
        ...payload,
      });
    } catch (error) {
      next(error);
    }
  }

  static async regenerateAnalysis(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const workspaceId = req.workspaceId!;

      const recording = await Recording.findOne({ _id: id, workspaceId });
      if (!recording) {
        throw new AppError('Recording not found', 404, 'RECORDING_NOT_FOUND');
      }

      // Re-enqueue AI analysis job
      await aiQueue.add('analyze-recording', { recordingId: id });

      return res.json({
        success: true,
        message: 'Analysis regeneration queued',
        data: { recording_id: id, status: 'processing' },
      });
    } catch (error) {
      next(error);
    }
  }

  static async toggleActionItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id, actionId } = req.params;
      const { completed } = req.body;
      const workspaceId = req.workspaceId!;

      const actionItem = await ActionItem.findOne({ _id: actionId, recordingId: id, workspaceId });
      if (!actionItem) {
        throw new AppError('Action item not found', 404, 'ACTION_ITEM_NOT_FOUND');
      }

      if (completed !== undefined) {
        actionItem.status = completed ? 'completed' : 'pending';
      } else {
        actionItem.status = actionItem.status === 'completed' ? 'pending' : 'completed';
      }

      await actionItem.save();

      const payload = {
        id: actionItem._id,
        recording_id: actionItem.recordingId,
        task: actionItem.task,
        assignee: actionItem.assignee,
        due_date: actionItem.dueDate,
        completed: actionItem.status === 'completed',
        status: actionItem.status,
      };

      return res.json({
        success: true,
        message: 'Action item updated',
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
      const { title, collection_id, collectionId } = req.body;

      const recording = await Recording.findOne({ _id: id, workspaceId });
      if (!recording) {
        throw new AppError('Recording not found', 404, 'RECORDING_NOT_FOUND');
      }

      if (title !== undefined) {
        recording.title = title;
      }
      const targetCollection = collection_id !== undefined ? collection_id : collectionId;
      if (targetCollection !== undefined) {
        recording.collectionId = targetCollection;
      }

      await recording.save();

      const payload = {
        id: recording._id,
        title: recording.title,
        collection_id: recording.collectionId,
        collectionId: recording.collectionId,
        updated_at: recording.updatedAt.toISOString(),
      };

      return res.json({
        success: true,
        message: 'Recording updated',
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

      const recording = await Recording.findOne({ _id: id, workspaceId });
      if (!recording) {
        throw new AppError('Recording not found', 404, 'RECORDING_NOT_FOUND');
      }

      // Delete file from disk if exists
      if (recording.storagePath && fs.existsSync(recording.storagePath)) {
        try {
          fs.unlinkSync(recording.storagePath);
        } catch (_err) {}
      }

      await TranscriptSegment.deleteMany({ recordingId: id });
      await TranscriptChunk.deleteMany({ recordingId: id });
      await Summary.deleteMany({ recordingId: id });
      await ActionItem.deleteMany({ recordingId: id });
      await Recording.deleteOne({ _id: id });

      return res.json({
        success: true,
        message: 'Recording deleted successfully',
        data: { id },
        id,
      });
    } catch (error) {
      next(error);
    }
  }

  static async retry(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const workspaceId = req.workspaceId!;

      const recording = await Recording.findOne({ _id: id, workspaceId });
      if (!recording) {
        throw new AppError('Recording not found', 404, 'RECORDING_NOT_FOUND');
      }

      recording.status = 'queued';
      recording.errorMessage = null;
      recording.indexStatus = 'pending';
      await recording.save();

      const job = await audioQueue.add('transcribe-audio', { recordingId: recording._id });
      recording.transcriptionJobId = job.id || null;
      await recording.save();

      const payload = {
        recording: {
          id: recording._id,
          title: recording.title,
          status: recording.status,
        },
        job: {
          id: job.id,
          status: 'queued',
        },
      };

      return res.json({
        success: true,
        message: 'Transcription job re-queued',
        data: payload,
        id: recording._id,
        status: recording.status,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAudio(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const workspaceId = req.workspaceId!;

      const recording = await Recording.findOne({ _id: id, workspaceId });
      if (!recording) {
        throw new AppError('Recording not found', 404, 'RECORDING_NOT_FOUND');
      }

      if (!fs.existsSync(recording.storagePath)) {
        throw new AppError('Audio file not found on disk', 404, 'FILE_NOT_FOUND');
      }

      res.setHeader('Content-Type', recording.mimeType || 'audio/wav');
      const stream = fs.createReadStream(recording.storagePath);
      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  }

  static async ask(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { question } = req.body;
      const workspaceId = req.workspaceId!;

      const recording = await Recording.findOne({ _id: id, workspaceId });
      if (!recording) {
        throw new AppError('Recording not found', 404, 'RECORDING_NOT_FOUND');
      }

      const segments = await TranscriptSegment.find({ recordingId: id })
        .sort({ segmentIndex: 1 })
        .lean();

      if (segments.length === 0) {
        throw new AppError('Recording transcript is empty or still processing', 400, 'TRANSCRIPT_EMPTY');
      }

      const fullTranscript = segments.map((s) => `${s.speaker}: ${s.text}`).join('\n');
      const startTime = Date.now();

      const answerRes = await AiServiceClient.askQuestion(
        fullTranscript,
        question,
        recording.title
      );

      const durationSeconds = (Date.now() - startTime) / 1000;

      // Record usage
      await ApiUsageRecord.create({
        workspaceId,
        userId: req.user?._id || null,
        apiKeyId: req.apiKey?._id || null,
        resourceType: 'qa',
        model: 'llama3.2',
        promptTokens: answerRes.prompt_tokens || 0,
        completionTokens: answerRes.completion_tokens || 0,
        totalTokens: (answerRes.prompt_tokens || 0) + (answerRes.completion_tokens || 0),
        durationSeconds,
        statusCode: 200,
      });

      const payload = {
        recording_id: id,
        recordingId: id,
        question,
        answer: answerRes.answer,
        supported_by_transcript: true,
        timestamps: [],
        model_name: 'llama3.2',
        prompt_tokens: answerRes.prompt_tokens,
        completion_tokens: answerRes.completion_tokens,
      };

      return res.json({
        success: true,
        message: 'Question answered successfully',
        data: payload,
        ...payload,
      });
    } catch (error) {
      next(error);
    }
  }
}
