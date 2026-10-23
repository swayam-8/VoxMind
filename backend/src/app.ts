import express from 'express';
import { meetingIntegrationRoutes } from './modules/meeting-integrations/routes.js';
import cors from 'cors';
import helmet from 'helmet';
import { httpLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { config } from './config/index.js';

// Route imports
import { authRoutes } from './modules/auth/auth.routes.js';
import { recordingRoutes } from './modules/recordings/recordings.routes.js';
import { collectionRoutes } from './modules/collections/collections.routes.js';
import { searchRoutes, knowledgeRoutes } from './modules/search/search.routes.js';
import { apiKeyRoutes } from './modules/api-keys/api-keys.routes.js';
import { usageRoutes } from './modules/usage/usage.routes.js';
import { diagnosticsRoutes } from './modules/diagnostics/diagnostics.routes.js';

export function createApp() {
  const app = express();

  // Security & Utility middleware
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(
    cors({
      origin: config.corsOrigin === '*' ? true : [config.corsOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(httpLogger);

  // Root healthcheck
  app.get('/health', (_req, res) => res.json({ status: 'healthy', timestamp: new Date().toISOString() }));

  // Version 1 API routes
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
      error: `Route ${req.method} ${req.originalUrl} not found`,
      code: 'NOT_FOUND',
    });
  });

  // Centralized error handler
  app.use(errorHandler);

  return app;
}
