import { createApp } from './app.js';
import { config } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './database/connection.js';
import { startAudioWorker } from './queues/audioQueue.js';
import { startAiWorker } from './queues/aiQueue.js';
import { logger } from './middleware/requestLogger.js';
import { Worker } from 'bullmq';

async function bootstrap() {
  try {
    // 1. Connect to MongoDB
    logger.info({ uri: config.mongoUri }, 'Connecting to MongoDB...');
    await connectDatabase();
    logger.info('Connected to MongoDB successfully');

    // 2. Start BullMQ background workers (if not in test mode)
    let audioWorker: Worker | undefined;
    let aiWorker: Worker | undefined;
    try {
      audioWorker = startAudioWorker();
      aiWorker = startAiWorker();
      logger.info('BullMQ audio and AI workers started successfully');
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Failed to initialize BullMQ workers (Redis might be offline)');
    }

    // 3. Create and start Express server
    const app = createApp();
    const server = app.listen(config.port, config.host, () => {
      logger.info(`VoxMind Backend running at http://${config.host}:${config.port}`);
    });

    // 4. Graceful shutdown handler
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        if (audioWorker) await audioWorker.close();
        if (aiWorker) await aiWorker.close();
        await disconnectDatabase();
        logger.info('Graceful shutdown completed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

bootstrap();
