import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../database/connection.js';

let mongod: MongoMemoryServer;
const app = createApp();

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await connectDatabase(uri);
}, 180000);

afterAll(async () => {
  await disconnectDatabase();
  if (mongod) {
    await mongod.stop();
  }
});

describe('VoxMind Express API Test Suite', () => {
  let authToken = '';
  let workspaceId = '';
  let collectionId = '';
  let apiKeyId = '';
  let rawApiKey = '';

  it('GET /health returns healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('GET /api/v1/health returns database connected', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.database).toBe('connected');
  });

  it('POST /api/v1/auth/register creates a user and workspace', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'test@voxmind.dev',
      password: 'password1234',
      fullName: 'Test Engineer',
    });

    expect(res.status).toBe(201);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.user.email).toBe('test@voxmind.dev');
    expect(res.body.workspace.id).toBeDefined();

    authToken = res.body.access_token;
    workspaceId = res.body.workspace.id;
  });

  it('POST /api/v1/auth/login authenticates with valid credentials', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'test@voxmind.dev',
      password: 'password1234',
    });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.user.email).toBe('test@voxmind.dev');
  });

  it('GET /api/v1/auth/me returns current user profile', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test@voxmind.dev');
    expect(res.body.workspace.id).toBe(workspaceId);
  });

  it('POST /api/v1/auth/register rejects duplicate email with 409', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'test@voxmind.dev',
      password: 'password1234',
      fullName: 'Duplicate Engineer',
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_EXISTS');
  });

  it('POST /api/v1/auth/login rejects invalid credentials with 401', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'test@voxmind.dev',
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('PATCH /api/v1/auth/me updates profile full name', async () => {
    const res = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        fullName: 'Principal AI Architect',
      });

    expect(res.status).toBe(200);
    expect(res.body.user.fullName).toBe('Principal AI Architect');

    // Confirm GET /auth/me reflects the update
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authToken}`);
    expect(meRes.body.user.fullName).toBe('Principal AI Architect');
  });

  it('PATCH /api/v1/auth/me rotates user password securely', async () => {
    // Fails if currentPassword is wrong
    const failRes = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        currentPassword: 'wrongcurrentpassword',
        newPassword: 'newsecurepassword1234',
      });
    expect(failRes.status).toBe(400);

    // Succeeds with correct currentPassword
    const okRes = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        currentPassword: 'password1234',
        newPassword: 'newsecurepassword1234',
      });
    expect(okRes.status).toBe(200);

    // Old password should fail login
    const oldLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'test@voxmind.dev',
      password: 'password1234',
    });
    expect(oldLogin.status).toBe(401);

    // New password should succeed login and return a fresh token
    const newLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'test@voxmind.dev',
      password: 'newsecurepassword1234',
    });
    expect(newLogin.status).toBe(200);
    authToken = newLogin.body.access_token;
  });

  it('POST /api/v1/collections creates a new collection', async () => {
    const res = await request(app)
      .post('/api/v1/collections')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Executive Strategy',
        description: 'High-level architectural decisions and roadmap.',
        color: '#6366f1',
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Executive Strategy');
    expect(res.body.id).toBeDefined();
    collectionId = res.body.id;
  });

  it('GET /api/v1/collections lists collections', async () => {
    const res = await request(app)
      .get('/api/v1/collections')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.collections).toBeInstanceOf(Array);
    expect(res.body.collections.length).toBeGreaterThan(0);
    expect(res.body.collections[0].name).toBe('Executive Strategy');
  });

  it('GET /api/v1/recordings lists recordings with pagination', async () => {
    const res = await request(app)
      .get('/api/v1/recordings')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.recordings).toBeInstanceOf(Array);
    expect(res.body.total).toBe(0);
  });

  it('POST /api/v1/api-keys generates a secure API key', async () => {
    const res = await request(app)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Testing Key',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.raw_key).toMatch(/^vm_live_/);
    expect(res.body.key_prefix).toBeDefined();

    apiKeyId = res.body.id;
    rawApiKey = res.body.raw_key;
  });

  it('API key can authenticate against protected endpoints', async () => {
    const res = await request(app)
      .get('/api/v1/recordings')
      .set('X-API-Key', rawApiKey);

    expect(res.status).toBe(200);
    expect(res.body.recordings).toBeInstanceOf(Array);
  });

  it('DELETE /api/v1/api-keys/:id revokes the API key', async () => {
    const res = await request(app)
      .delete(`/api/v1/api-keys/${apiKeyId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.is_revoked).toBe(true);

    // Revoked key should now be rejected
    const authRes = await request(app)
      .get('/api/v1/recordings')
      .set('X-API-Key', rawApiKey);

    expect(authRes.status).toBe(401);
  });

  it('GET /api/v1/usage returns usage accounting metrics', async () => {
    const res = await request(app)
      .get('/api/v1/usage')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(res.body.by_resource).toBeDefined();
  });

  it('GET /api/v1/diagnostics returns comprehensive diagnostics', async () => {
    const res = await request(app).get('/api/v1/diagnostics');
    expect(res.status).toBe(200);
    expect(res.body.database.type).toBe('MongoDB');
    expect(res.body.database.status).toBe('connected');
    expect(res.body.system).toBeDefined();
  });
});
