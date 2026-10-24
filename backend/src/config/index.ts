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
  aiInternalSecret: string;
  trustProxy: false | number;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

let jwtSecret = process.env.JWT_SECRET;

if (isProduction) {
  if (
    !jwtSecret ||
    jwtSecret.trim() === '' ||
    /(?:change.?me|change.?in.?production|your-secure|do-not-use|default-docker)/i.test(jwtSecret) ||
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

const aiInternalSecret = process.env.AI_INTERNAL_SECRET || '';
if (isProduction && aiInternalSecret.length < 32) {
  throw new Error('FATAL: AI_INTERNAL_SECRET must contain at least 32 characters in production. Run npm start to generate it.');
}
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
if (isProduction && (corsOrigin === '*' || !/^https?:\/\//.test(corsOrigin) || new URL(corsOrigin).origin !== corsOrigin)) {
  throw new Error('FATAL: CORS_ORIGIN must be an explicit web origin.');
}
const proxyHops = Number(process.env.TRUST_PROXY || 0);
if (!Number.isSafeInteger(proxyHops) || proxyHops < 0 || proxyHops > 5) {
  throw new Error('TRUST_PROXY must be an integer between 0 and 5.');
}

// Respect explicit service addresses: Docker uses service names, native dev uses localhost.
const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001';
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/voxmind';
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379/0';

const maxUploadSizeMb = Number(process.env.MAX_UPLOAD_SIZE_MB || 100);
if (!Number.isSafeInteger(maxUploadSizeMb) || maxUploadSizeMb < 1 || maxUploadSizeMb > 1000) {
  throw new Error('MAX_UPLOAD_SIZE_MB must be an integer between 1 and 1000.');
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '5000', 10),
  host: process.env.HOST || (isProduction ? '0.0.0.0' : '127.0.0.1'),
  nodeEnv,
  mongoUri,
  redisUrl,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  aiServiceUrl,
  uploadDir: process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads'),
  corsOrigin,
  maxUploadSizeMb,
  aiInternalSecret,
  trustProxy: proxyHops || false,
};
