import { createApp } from './app.js';
import { config } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './database/connection.js';
import { startAudioWorker } from './queues/audioQueue.js';
import { startAiWorker } from './queues/aiQueue.js';
import { logger } from './middleware/requestLogger.js';
import { Worker } from 'bullmq';
import { startMeetingImportWorker } from './queues/meetingImportQueue.js';

async function bootstrap() {
  try {
    // 1. Connect to MongoDB
    logger.info('Connecting to MongoDB...');
    await connectDatabase();
    logger.info('Connected to MongoDB successfully');

    // 2. Start BullMQ background workers (if not in test mode)
    let audioWorker: Worker | undefined;
    let aiWorker: Worker | undefined;
    let meetingImportWorker: Worker | undefined;
    try {
      audioWorker = startAudioWorker();
      aiWorker = startAiWorker();
      meetingImportWorker = startMeetingImportWorker();
      logger.info('BullMQ audio and AI workers started successfully');
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Failed to initialize BullMQ workers (Redis might be offline)');
    }

    // 3. Create and start Express server
    const app = createApp();
    const server = app.listen(config.port, config.host, () => {
      logger.info(`MeetingBrief Backend running at http://${config.host}:${config.port}`);
    });
    server.requestTimeout = 120000;
    server.headersTimeout = 30000;

    // 4. Graceful shutdown handler
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        if (audioWorker) await audioWorker.close();
        if (aiWorker) await aiWorker.close();
        if (meetingImportWorker) await meetingImportWorker.close();
        await disconnectDatabase();
        logger.info('Graceful shutdown completed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error({ errorType: error instanceof Error ? error.name : 'UnknownError' }, 'Failed to start server. Check database and service configuration.');
    process.exit(1);
  }
}

bootstrap();
