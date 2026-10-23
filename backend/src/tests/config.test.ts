import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('service addresses', () => {
  it('preserves Docker service names for database, Redis and AI connections', async () => {
    vi.stubEnv('MONGO_URI', 'mongodb://mongo:27017/voxmind');
    vi.stubEnv('REDIS_URL', 'redis://redis:6379/0');
    vi.stubEnv('AI_SERVICE_URL', 'http://ai_service:8000');
    const { config } = await import('../config/index.js');
    expect(config.mongoUri).toBe('mongodb://mongo:27017/voxmind');
    expect(config.redisUrl).toBe('redis://redis:6379/0');
    expect(config.aiServiceUrl).toBe('http://ai_service:8000');
  });

  it('preserves explicit native development addresses', async () => {
    vi.stubEnv('MONGO_URI', 'mongodb://localhost:27017/voxmind');
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379/0');
    vi.stubEnv('AI_SERVICE_URL', 'http://127.0.0.1:8001');
    const { config } = await import('../config/index.js');
    expect(config.mongoUri).toBe('mongodb://localhost:27017/voxmind');
    expect(config.redisUrl).toBe('redis://localhost:6379/0');
    expect(config.aiServiceUrl).toBe('http://127.0.0.1:8001');
  });
});
