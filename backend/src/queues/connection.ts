import { RedisOptions } from 'ioredis';
import { config } from '../config/index.js';

export function getRedisConnection(): RedisOptions {
  // Parse REDIS_URL into host, port, db
  try {
    const parsed = new URL(config.redisUrl);
    const dbMatch = parsed.pathname.match(/^\/(\d+)$/);
    const db = dbMatch ? parseInt(dbMatch[1], 10) : 0;

    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port || '6379', 10),
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      db,
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
    };
  } catch (_e) {
    return {
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }
}
