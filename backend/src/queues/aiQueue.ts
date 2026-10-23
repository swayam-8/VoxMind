import { Queue, Worker, Job } from 'bullmq';
import { getRedisConnection } from './connection.js';
import { processRecordingAnalysis } from '../services/recordingAnalysis.js';
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

export async function processAiJob(job: Job<AiJobData>) {
  const { recordingId } = job.data;
  logger.info({ recordingId, jobId: job.id }, 'Starting AI analysis & indexing job');
  // Persist pending throughout backoff so a polling request cannot mistake a retry for a terminal failure.
  await processRecordingAnalysis(recordingId, { retryPending: job.attemptsMade + 1 < (job.opts.attempts || 1) });
}

export function startAiWorker(): Worker<AiJobData> {
  const worker = new Worker<AiJobData>(
    'ai-processing', processAiJob,
    { connection, concurrency: 2 }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'AI worker job failed');
  });

  return worker;
}
