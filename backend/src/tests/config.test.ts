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


describe('production security configuration', () => {
  it('rejects public JWT placeholders and wildcard browser origins', async () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('AI_INTERNAL_SECRET', 'b'.repeat(64));
    vi.stubEnv('JWT_SECRET', 'your-secure-random-32-plus-character-secret-key-here');
    await expect(import('../config/index.js')).rejects.toThrow('JWT_SECRET');
    vi.resetModules(); vi.stubEnv('JWT_SECRET', 'a'.repeat(64)); vi.stubEnv('CORS_ORIGIN', '*');
    await expect(import('../config/index.js')).rejects.toThrow('CORS_ORIGIN');
  });
  it('requires a separate internal AI credential and validates proxy configuration', async () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('JWT_SECRET', 'a'.repeat(64)); vi.stubEnv('AI_INTERNAL_SECRET', '');
    await expect(import('../config/index.js')).rejects.toThrow('AI_INTERNAL_SECRET');
    vi.resetModules(); vi.stubEnv('AI_INTERNAL_SECRET', 'b'.repeat(64)); vi.stubEnv('CORS_ORIGIN', 'https://meetingbrief.example'); vi.stubEnv('TRUST_PROXY', 'true');
    await expect(import('../config/index.js')).rejects.toThrow('TRUST_PROXY');
  });
});
