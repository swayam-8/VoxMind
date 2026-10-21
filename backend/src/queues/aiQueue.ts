import { Queue, Worker, Job } from 'bullmq';
import { getRedisConnection } from './connection.js';
import { Recording } from '../database/models/Recording.js';
import { TranscriptSegment } from '../database/models/TranscriptSegment.js';
import { TranscriptChunk } from '../database/models/TranscriptChunk.js';
import { Summary } from '../database/models/Summary.js';
import { ActionItem } from '../database/models/ActionItem.js';
import { ApiUsageRecord } from '../database/models/ApiUsageRecord.js';
import { AiServiceClient } from '../services/aiServiceClient.js';
import { logger } from '../middleware/requestLogger.js';

export interface AiJobData {
  recordingId: string;
}

const connection = getRedisConnection();

export const aiQueue = new Queue<AiJobData>('ai-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export function startAiWorker(): Worker<AiJobData> {
  const worker = new Worker<AiJobData>(
    'ai-processing',
    async (job: Job<AiJobData>) => {
      const { recordingId } = job.data;
      logger.info({ recordingId, jobId: job.id }, 'Starting AI analysis & indexing job');

      const recording = await Recording.findById(recordingId);
      if (!recording) {
        throw new Error(`Recording ${recordingId} not found`);
      }

      recording.indexStatus = 'indexing';
      await recording.save();

      const startTime = Date.now();

      try {
        // Fetch all segments
        const segments = await TranscriptSegment.find({ recordingId })
          .sort({ segmentIndex: 1 })
          .lean();

        if (segments.length === 0) {
          logger.warn({ recordingId }, 'No segments found to analyze');
          recording.indexStatus = 'completed';
          await recording.save();
          return;
        }

        const fullTranscriptText = segments.map((s) => `${s.speaker}: ${s.text}`).join('\n');

        // 1. Generate Summary & Action Items via AI service
        try {
          const analysis = await AiServiceClient.analyzeTranscript(
            fullTranscriptText,
            recording.title
          );

          // Update or create Summary
          await Summary.findOneAndUpdate(
            { recordingId },
            {
              recordingId,
              modelName: analysis.model || 'llama3.2',
              summaryMarkdown: analysis.summary,
              keyTakeaways: analysis.key_takeaways || [],
              decisions: analysis.decisions || [],
              topics: analysis.topics || [],
              actionItems: analysis.action_items || [],
              promptTokens: analysis.prompt_tokens || 0,
              completionTokens: analysis.completion_tokens || 0,
            },
            { upsert: true, new: true }
          );

          // Save ActionItems if present
          if (analysis.action_items && analysis.action_items.length > 0) {
            await ActionItem.deleteMany({ recordingId });
            const actionDocs = analysis.action_items.map((item) => ({
              recordingId,
              workspaceId: recording.workspaceId,
              task: item.text,
              assignee: item.assignee || null,
              dueDate: item.due_date || null,
              status: 'pending',
              priority: 'medium',
            }));
            await ActionItem.insertMany(actionDocs);
          }

          // Record usage for summary
          await ApiUsageRecord.create({
            workspaceId: recording.workspaceId,
            userId: recording.userId,
            resourceType: 'summary',
            model: analysis.model || 'llama3.2',
            promptTokens: analysis.prompt_tokens || 0,
            completionTokens: analysis.completion_tokens || 0,
            totalTokens: (analysis.prompt_tokens || 0) + (analysis.completion_tokens || 0),
            durationSeconds: (Date.now() - startTime) / 1000,
            statusCode: 200,
          });
        } catch (aiErr: any) {
          logger.error({ recordingId, err: aiErr.message }, 'AI analysis summary failed');
        }

        // 2. Transcript Chunking & Vector Embeddings
        try {
          const chunkRes = await AiServiceClient.chunkTranscript(
            segments.map((s) => ({
              start: s.startTime,
              end: s.endTime,
              speaker: s.speaker,
              text: s.text,
            }))
          );

          if (chunkRes.chunks && chunkRes.chunks.length > 0) {
            const texts = chunkRes.chunks.map((c) => c.text);
            const embedRes = await AiServiceClient.generateEmbeddings(texts);

            // Delete old chunks
            await TranscriptChunk.deleteMany({ recordingId });

            const chunkDocs = chunkRes.chunks.map((c, idx) => ({
              recordingId,
              workspaceId: recording.workspaceId,
              chunkIndex: c.chunk_index,
              startTime: c.start_time,
              endTime: c.end_time,
              speaker: c.speaker,
              text: c.text,
              tokenCount: c.token_count,
              embedding: embedRes.embeddings[idx] || [],
            }));

            await TranscriptChunk.insertMany(chunkDocs);

            // Record usage for embedding
            await ApiUsageRecord.create({
              workspaceId: recording.workspaceId,
              userId: recording.userId,
              resourceType: 'embedding',
              model: embedRes.model || 'all-MiniLM-L6-v2',
              promptTokens: chunkDocs.reduce((acc, c) => acc + c.tokenCount, 0),
              completionTokens: 0,
              totalTokens: chunkDocs.reduce((acc, c) => acc + c.tokenCount, 0),
              durationSeconds: (Date.now() - startTime) / 1000,
              statusCode: 200,
            });
          }
        } catch (embedErr: any) {
          logger.error({ recordingId, err: embedErr.message }, 'Vector chunking/embedding failed');
        }

        recording.indexStatus = 'completed';
        await recording.save();

        logger.info({ recordingId }, 'AI analysis & indexing completed successfully');
      } catch (err: any) {
        logger.error({ recordingId, err: err.message }, 'AI analysis job failed');
        recording.indexStatus = 'failed';
        await recording.save();
        throw err;
      }
    },
    { connection, concurrency: 2 }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'AI worker job failed');
  });

  return worker;
}
