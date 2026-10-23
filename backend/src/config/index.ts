import path from 'path';
import dotenv from 'dotenv';

import fs from 'fs';

// Attempt to load backend/.env first if present, otherwise process.cwd()/.env
const backendEnvPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
} else {
  dotenv.config();
}

export interface AppConfig {
  port: number;
  host: string;
  nodeEnv: string;
  mongoUri: string;
  redisUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  aiServiceUrl: string;
  uploadDir: string;
  corsOrigin: string;
  maxUploadSizeMb: number;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

let jwtSecret = process.env.JWT_SECRET;

if (isProduction) {
  if (
    !jwtSecret ||
    jwtSecret.trim() === '' ||
    jwtSecret === 'voxmind-jwt-super-secret-key-change-in-production' ||
    jwtSecret.length < 32
  ) {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is required in production and must be a secure secret of at least 32 characters.'
    );
  }
} else {
  // Explicit isolated development/testing secret
  jwtSecret = jwtSecret || 'voxmind-dev-isolated-secret-do-not-use-in-production-min32chars';
}

const rawAiUrl = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001';
const aiServiceUrl = rawAiUrl.includes('ai_service') ? 'http://127.0.0.1:8001' : rawAiUrl;

const rawMongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/voxmind';
const mongoUri = rawMongoUri.includes('@mongo:') || rawMongoUri.startsWith('mongodb://mongo:')
  ? rawMongoUri.replace('//mongo:', '//localhost:')
  : rawMongoUri;

const rawRedisUrl = process.env.REDIS_URL || 'redis://localhost:6379/0';
const redisUrl = rawRedisUrl.startsWith('redis://redis:')
  ? rawRedisUrl.replace('redis://redis:', 'redis://localhost:')
  : rawRedisUrl;

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '5000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv,
  mongoUri,
  redisUrl,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  aiServiceUrl,
  uploadDir: process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads'),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  maxUploadSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '100', 10),
};
