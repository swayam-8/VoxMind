import { rateLimit, type Options } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';
import { config } from '../config/index.js';
import { AppError } from './errorHandler.js';
import type { AuthenticatedRequest } from './auth.js';

let redis: Redis | undefined;
export function createRateLimiter(name: string, limit: number, windowMs: number, perWorkspace = false) {
  const options: Partial<Options> = {
    windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { success: false, code: 'RATE_LIMITED', message: 'Too many requests. Wait before trying again.' },
  };
  if (perWorkspace) options.keyGenerator = (req) => (req as AuthenticatedRequest).workspaceId!;
  if (config.nodeEnv === 'production') {
    if (!redis) {
      redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 2000 });
      redis.on('error', () => {});
    }
    options.store = new RedisStore({ prefix: `voxmind:limit:${name}:`, sendCommand: async (...args) => {
      try { const [command, ...parameters] = args; return await redis!.call(command, ...parameters) as any; }
      catch { throw new AppError('Request protection is temporarily unavailable', 503, 'RATE_LIMIT_UNAVAILABLE'); }
    } });
  }
  return rateLimit(options);
}

// Tests exercise custom low limits separately; normal test fixtures share one IP.
const test = config.nodeEnv === 'test';
export const apiRateLimit = createRateLimiter('api', test ? 10000 : 300, 60000);
export const loginRateLimit = createRateLimiter('login', test ? 10000 : 20, 15 * 60000);
export const registrationRateLimit = createRateLimiter('registration', test ? 10000 : 10, 60 * 60000);
export const expensiveRateLimit = createRateLimiter('inference', test ? 10000 : 20, 60000, true);
export const uploadRateLimit = createRateLimiter('upload', test ? 10000 : 10, 60 * 60000, true);
