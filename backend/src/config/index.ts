import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env if present
dotenv.config();

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

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '5000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv,
  mongoUri: process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/voxmind',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379/0',
  jwtSecret: process.env.JWT_SECRET || 'voxmind-jwt-super-secret-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000',
  uploadDir: process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads'),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  maxUploadSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '100', 10),
};
