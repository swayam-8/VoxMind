import express from 'express';
import { openapi } from './modules/docs/openapi.js';
import { meetingIntegrationRoutes } from './modules/meeting-integrations/routes.js';
import cors from 'cors';
import { apiRateLimit } from './middleware/rateLimit.js';
import helmet from 'helmet';
import { httpLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { config } from './config/index.js';

// Route imports
import { googleAuthRoutes } from './modules/auth/google.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { recordingRoutes } from './modules/recordings/recordings.routes.js';
import { collectionRoutes } from './modules/collections/collections.routes.js';
import { searchRoutes, knowledgeRoutes } from './modules/search/search.routes.js';
import { apiKeyRoutes } from './modules/api-keys/api-keys.routes.js';
import { usageRoutes } from './modules/usage/usage.routes.js';
import { diagnosticsRoutes } from './modules/diagnostics/diagnostics.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  // Security & Utility middleware
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(
    cors({
      origin: [config.corsOrigin, ...(config.nodeEnv === 'development' ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : [])],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    })
  );
  app.use(httpLogger);
  app.use('/api/', apiRateLimit, (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use(express.json({ limit: '256kb', inflate: false }));
  app.use(express.urlencoded({ extended: false, limit: '16kb', parameterLimit: 50, inflate: false }));

  // Root healthcheck
  app.get('/health', (_req, res) => res.json({ status: 'healthy', timestamp: new Date().toISOString() }));

  app.get('/api/v1/openapi.json', (_req, res) => res.json(openapi));

  // Version 1 API routes
  app.use('/api/v1/auth/google', googleAuthRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/meeting-integrations', meetingIntegrationRoutes);
  app.use('/api/v1/recordings', recordingRoutes);
  app.use('/api/v1/collections', collectionRoutes);
  app.use('/api/v1/search', searchRoutes);
  app.use('/api/v1/knowledge', knowledgeRoutes);
  app.use('/api/v1/api-keys', apiKeyRoutes);
  app.use('/api/v1/usage', usageRoutes);
  app.use('/api/v1', diagnosticsRoutes);

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Route not found',
      code: 'NOT_FOUND',
    });
  });

  // Centralized error handler
  app.use(errorHandler);

  return app;
}
