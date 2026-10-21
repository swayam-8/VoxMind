import { Queue, Worker, Job } from 'bullmq';
import { getRedisConnection } from './connection.js';
import { Recording } from '../database/models/Recording.js';
import { TranscriptSegment } from '../database/models/TranscriptSegment.js';
import { ApiUsageRecord } from '../database/models/ApiUsageRecord.js';
import { AiServiceClient } from '../services/aiServiceClient.js';
import { logger } from '../middleware/requestLogger.js';
import { aiQueue } from './aiQueue.js';

export interface TranscribeJobData {
  recordingId: string;
}

const connection = getRedisConnection();

export const audioQueue = new Queue<TranscribeJobData>('audio-transcription', {
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

export function startAudioWorker(): Worker<TranscribeJobData> {
  const worker = new Worker<TranscribeJobData>(
    'audio-transcription',
    async (job: Job<TranscribeJobData>) => {
      const { recordingId } = job.data;
      logger.info({ recordingId, jobId: job.id }, 'Starting audio transcription job');

      const recording = await Recording.findById(recordingId);
      if (!recording) {
        throw new Error(`Recording ${recordingId} not found`);
      }

      recording.status = 'processing';
      recording.errorMessage = null;
      await recording.save();

      const startTime = Date.now();

      try {
        // Call Python AI microservice
        const result = await AiServiceClient.transcribeAudio(
          recording.storagePath,
          recording.language || undefined
        );

        const durationSeconds = (Date.now() - startTime) / 1000;

        // Remove old segments if any
        await TranscriptSegment.deleteMany({ recordingId: recording._id });

        // Save new segments
        if (result.segments && result.segments.length > 0) {
          const segmentDocs = result.segments.map((seg, idx) => ({
            recordingId: recording._id,
            segmentIndex: idx,
            startTime: seg.start,
            endTime: seg.end,
            speaker: seg.speaker || 'Speaker 1',
            text: seg.text.trim(),
            confidence: seg.confidence ?? 0.95,
          }));
          await TranscriptSegment.insertMany(segmentDocs);
        }

        // Update recording
        recording.status = 'completed';
        recording.language = result.language || recording.language;
        if (result.duration && result.duration > 0) {
          recording.durationSeconds = result.duration;
        }
        await recording.save();

        // Record usage
        await ApiUsageRecord.create({
          workspaceId: recording.workspaceId,
          userId: recording.userId,
          resourceType: 'transcription',
          model: 'faster-whisper-base',
          durationSeconds,
          statusCode: 200,
        });

        logger.info(
          { recordingId, segmentCount: result.segments.length, durationSeconds },
          'Audio transcription completed successfully'
        );

        // Enqueue AI analysis & indexing job
        await aiQueue.add('analyze-recording', { recordingId: recording._id });
      } catch (err: any) {
        logger.error({ recordingId, err: err.message }, 'Audio transcription failed');
        recording.status = 'failed';
        recording.errorMessage = err.message || 'Transcription failed';
        await recording.save();
        throw err;
      }
    },
    { connection, concurrency: 2 }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Transcription worker job failed');
  });

  return worker;
}
