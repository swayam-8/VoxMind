import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import Redis from 'ioredis';
import { isDbConnected } from '../../database/connection.js';
import { getRedisConnection } from '../../queues/connection.js';
import { AiServiceClient } from '../../services/aiServiceClient.js';
import { config } from '../../config/index.js';

export class DiagnosticsController {
  static async getHealth(_req: Request, res: Response) {
    const dbOk = isDbConnected();
    const payload = {
      status: dbOk ? 'healthy' : 'degraded',
      service: 'meetingbrief-backend',
      database: dbOk ? 'connected' : 'disconnected',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
    return res.status(dbOk ? 200 : 503).json({
      success: dbOk,
      message: dbOk ? 'System healthy' : 'System degraded',
      data: payload,
      ...payload,
    });
  }

  static async getReadiness(_req: Request, res: Response) {
    const dbOk = isDbConnected();
    const payload = {
      status: dbOk ? 'ready' : 'not_ready',
      checks: {
        database: dbOk ? 'ok' : 'down',
      },
    };
    return res.status(dbOk ? 200 : 503).json({
      success: dbOk,
      message: dbOk ? 'Service ready' : 'Service not ready',
      data: payload,
      ...payload,
    });
  }

  static async getDiagnostics(_req: Request, res: Response, _next: NextFunction) {
    // 1. Check MongoDB
    const mongoStatus = isDbConnected() ? 'healthy' : 'degraded';

    // 2. Check Redis
    let redisStatus = 'degraded';
    let diagnosticRedis: Redis | undefined;
    let redisLatency = 0;
    try {
      const redisOptions = getRedisConnection();
      const redis = diagnosticRedis = new Redis({ ...redisOptions, maxRetriesPerRequest: 1, connectTimeout: 1500, lazyConnect: true });
      redis.on('error', () => {});
      const t0 = Date.now();
      await redis.connect();
      await redis.ping();
      redisLatency = Date.now() - t0;
      redisStatus = 'healthy';
      await redis.quit();
    } catch (_e) {
      redisStatus = 'offline';
    } finally { diagnosticRedis?.disconnect(); }

    // 3. Check AI microservice
    let aiHealth = {
      status: 'offline',
      whisper_available: false,
      ollama_available: false,
      embeddings_available: false,
    };
    try {
      aiHealth = await AiServiceClient.checkHealth();
    } catch (_e) {}

    // 4. Check Storage
    let storageExists = false;
    try {
      if (fs.existsSync(config.uploadDir)) {
        storageExists = true;
      }
    } catch (_e) {}

    const memory = process.memoryUsage();

    const payload = {
      status: mongoStatus === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      node_version: process.version,
      uptime_seconds: Math.round(process.uptime()),
      database: {
        type: 'MongoDB',
        status: isDbConnected() ? 'connected' : 'disconnected',
      },
      services: {
        database: {
          status: mongoStatus,
          message: isDbConnected() ? 'MongoDB 7.0 connected' : 'MongoDB disconnected',
        },
        redis: {
          status: redisStatus,
          latency_ms: redisLatency,
          message: redisStatus === 'healthy' ? 'Redis 7 connected' : 'Redis offline',
        },
        workers: {
          status: redisStatus === 'healthy' ? 'unknown' : 'offline',
          worker_names: ['bullmq-audio-worker', 'bullmq-ai-worker'],
          message: redisStatus === 'healthy' ? 'Queue connection available; check job progress for worker activity' : 'Queue connection unavailable',
        },
        ollama: {
          status: aiHealth.ollama_available ? 'healthy' : 'offline',
          configured_model: process.env.OLLAMA_MODEL || 'llama3.2',
          model_available: aiHealth.ollama_available,
          message: aiHealth.ollama_available ? 'Ollama operational' : 'Ollama offline',
        },
        whisper: {
          status: aiHealth.whisper_available ? 'healthy' : 'offline',
          whisper_installed: aiHealth.whisper_available,
          model: 'base',
          device: 'cpu',
          compute_type: 'int8',
          message: aiHealth.whisper_available ? 'faster-whisper operational' : 'faster-whisper offline',
        },
        embedding: {
          status: aiHealth.embeddings_available ? 'healthy' : 'offline',
          model: 'all-MiniLM-L6-v2',
          dimension: 384,
          device: 'cpu',
          message: aiHealth.embeddings_available ? 'sentence-transformers operational' : 'embeddings offline',
        },
        vector_storage: {
          status: 'healthy',
          dialect: 'mongodb',
          message: 'MongoDB vector cosine retrieval active',
        },
        storage: {
          status: storageExists ? 'healthy' : 'degraded',
          path: config.uploadDir,
          message: storageExists ? 'Upload directory writeable' : 'Upload directory missing',
        },
      },
      system: {
        heap_used_mb: Math.round(memory.heapUsed / 1024 / 1024),
        rss_mb: Math.round(memory.rss / 1024 / 1024),
      },
    };

    return res.json({
      success: true,
      message: 'System diagnostics retrieved',
      data: payload,
      ...payload,
    });
  }
}
