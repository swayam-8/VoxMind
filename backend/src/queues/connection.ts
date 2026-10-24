import { RedisOptions } from 'ioredis';
import { config } from '../config/index.js';

export function getRedisConnection(): RedisOptions {
  // Parse REDIS_URL into host, port, db
  try {
    const parsed = new URL(config.redisUrl);
    if (!['redis:', 'rediss:'].includes(parsed.protocol)) throw new Error('Invalid Redis protocol');
    const dbMatch = parsed.pathname.match(/^\/(\d+)$/);
    const db = dbMatch ? parseInt(dbMatch[1], 10) : 0;

    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port || '6379', 10),
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
      db,
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
    };
  } catch (_e) {
    throw new Error('Invalid REDIS_URL. Use redis:// or rediss:// with a valid host and database.');
  }
}
