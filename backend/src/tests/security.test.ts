import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { config } from '../config/index.js';
import { connectDatabase, disconnectDatabase } from '../database/connection.js';
import { User } from '../database/models/User.js';
import { Recording } from '../database/models/Recording.js';
import { Collection } from '../database/models/Collection.js';
import { WorkspaceMembership } from '../database/models/WorkspaceMembership.js';
import { ApiKey } from '../database/models/ApiKey.js';
import { TokenService } from '../services/tokenService.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { errorHandler } from '../middleware/errorHandler.js';

vi.mock('../queues/audioQueue.js', () => ({ audioQueue: { add: vi.fn(async () => ({ id: 'job' })) } }));
vi.mock('../queues/aiQueue.js', () => ({ aiQueue: { add: vi.fn(async () => ({ id: 'analysis-job' })) } }));
const app = createApp();
let mongo: MongoMemoryServer;
let root: string;
let owner: any, other: any;
let recordingId: string;
let readKey: string, writeKey: string;
const originalUploadDir = config.uploadDir;
const audio = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVEfmt '), Buffer.alloc(48)]);
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDatabase(mongo.getUri());
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'voxmind-security-'));
  config.uploadDir = root;
  const register = async (email: string) => (await request(app).post('/api/v1/auth/register').send({ email, password: 'Strong-password-123', fullName: 'Security Test' })).body.data;
  owner = await register('owner@example.test'); other = await register('other@example.test');
  await fs.writeFile(path.join(root, 'recording.wav'), audio);
  const rec = await Recording.create({ workspaceId: owner.workspace.id, userId: owner.user.id, title: 'Private recording', filename: 'recording.wav', storagePath: path.join(root, 'recording.wav'), fileSizeBytes: audio.length, mimeType: 'audio/wav', status: 'completed' });
  recordingId = rec._id;
  const key = async (level: string) => (await request(app).post('/api/v1/api-keys').set(auth(owner.access_token)).send({ name: `Test ${level}`, access_level: level })).body.data.raw_key;
  readKey = await key('read'); writeKey = await key('write');
}, 180000);
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  config.uploadDir = originalUploadDir;
  await disconnectDatabase(); await mongo?.stop();
  if (root) await fs.rm(root, { recursive: true, force: true });
});

describe('workspace authorization and credentials', () => {
  it('rejects a valid signed token for a workspace the caller does not belong to', async () => {
    const token = TokenService.sign({ userId: other.user.id, email: other.user.email, workspaceId: owner.workspace.id });
    const res = await request(app).get('/api/v1/recordings').set(auth(token));
    expect(res.status).toBe(403);
  });
  it('blocks cross-workspace recording access, edits and downloads', async () => {
    expect((await request(app).get(`/api/v1/recordings/${recordingId}`).set(auth(other.access_token))).status).toBe(404);
    expect((await request(app).patch(`/api/v1/recordings/${recordingId}`).set(auth(other.access_token)).send({ title: 'Stolen' })).status).toBe(404);
    expect((await request(app).get(`/api/v1/recordings/${recordingId}/audio`).set(auth(other.access_token))).status).toBe(404);
  });
  it('does not accept full login tokens or API keys in URL query strings', async () => {
    expect((await request(app).get(`/api/v1/recordings?token=${owner.access_token}`)).status).toBe(401);
    expect((await request(app).get(`/api/v1/recordings/${recordingId}/audio?token=${owner.access_token}`)).status).toBe(401);
  });
  it('removes access immediately when a current membership is deleted', async () => {
    const membership = await WorkspaceMembership.findOne({ workspaceId: owner.workspace.id, userId: owner.user.id });
    await WorkspaceMembership.deleteOne({ _id: membership!._id });
    try {
      expect((await request(app).get('/api/v1/recordings').set(auth(owner.access_token))).status).toBe(403);
      expect((await request(app).get('/api/v1/recordings').set(auth(writeKey))).status).toBe(403);
    } finally { await WorkspaceMembership.create({ workspaceId: owner.workspace.id, userId: owner.user.id, role: 'owner' }); }
  });
  it('rejects JWTs signed with a different algorithm or token purpose', async () => {
    for (const token of [jwt.sign({ userId: owner.user.id }, config.jwtSecret, { algorithm: 'HS384' }), jwt.sign({ purpose: 'recording-audio', userId: owner.user.id }, config.jwtSecret)]) {
      expect((await request(app).get('/api/v1/recordings').set(auth(token))).status).toBe(401);
    }
  });
  it('denies viewer writes before accepting a file or changing data', async () => {
    const membership = await WorkspaceMembership.findOneAndUpdate({ userId: owner.user.id, workspaceId: owner.workspace.id }, { role: 'viewer' }, { new: true });
    try {
      expect((await request(app).get('/api/v1/recordings').set(auth(owner.access_token))).status).toBe(200);
      expect((await request(app).delete(`/api/v1/recordings/${recordingId}`).set(auth(owner.access_token))).status).toBe(403);
      expect((await request(app).post('/api/v1/recordings').set(auth(owner.access_token)).attach('file', audio, 'safe.wav')).status).toBe(403);
      expect((await request(app).post('/api/v1/collections').set(auth(owner.access_token)).send({ name: 'Denied' })).status).toBe(403);
    } finally { await WorkspaceMembership.updateOne({ _id: membership!._id }, { role: 'owner' }); }
  });
  it('enforces API key read/write permissions and blocks credential management', async () => {
    expect((await request(app).get('/api/v1/recordings').set(auth(readKey))).status).toBe(200);
    expect((await request(app).patch(`/api/v1/recordings/${recordingId}`).set(auth(readKey)).send({ title: 'Denied' })).status).toBe(403);
    expect((await request(app).patch(`/api/v1/recordings/${recordingId}`).set(auth(writeKey)).send({ title: 'Private recording' })).status).toBe(200);
    for (const endpoint of ['/api/v1/api-keys', '/api/v1/meeting-integrations/zoom/connect']) {
      expect((await request(app).post(endpoint).set(auth(writeKey)).send({ name: 'Forbidden key' })).status).toBe(403);
    }
    expect((await request(app).patch('/api/v1/auth/me').set(auth(writeKey)).send({ fullName: 'Changed' })).status).toBe(403);
  });
  it('rechecks membership for an API key instead of upgrading it to admin', async () => {
    const membership = await WorkspaceMembership.findOneAndUpdate({ userId: owner.user.id }, { role: 'viewer' }, { new: true });
    try { expect((await request(app).delete(`/api/v1/recordings/${recordingId}`).set(auth(writeKey))).status).toBe(403); }
    finally { await WorkspaceMembership.updateOne({ _id: membership!._id }, { role: 'owner' }); }
  });
  it('expires and revokes API keys immediately', async () => {
    const key = await ApiKey.findOne({ name: 'Test read' });
    await ApiKey.updateOne({ _id: key!._id }, { expiresAt: new Date(0) });
    expect((await request(app).get('/api/v1/recordings').set(auth(readKey))).status).toBe(401);
    await ApiKey.updateOne({ _id: key!._id }, { expiresAt: null, isRevoked: true });
    expect((await request(app).get('/api/v1/recordings').set(auth(readKey))).status).toBe(401);
    await ApiKey.updateOne({ _id: key!._id }, { isRevoked: false });
  });
  it('rejects disabled accounts at login and for existing tokens', async () => {
    await User.updateOne({ _id: other.user.id }, { isActive: false });
    try {
      expect((await request(app).post('/api/v1/auth/login').send({ email: other.user.email, password: 'Strong-password-123' })).status).toBe(401);
      expect((await request(app).get('/api/v1/recordings').set(auth(other.access_token))).status).toBe(401);
    } finally { await User.updateOne({ _id: other.user.id }, { isActive: true }); }
  });
  it('stores salted password hashes and ignores attempts to assign privileged account fields', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({ email: 'safe-signup@example.test', password: 'Hash-this-password-123', fullName: 'New user', isSuperuser: true, googleId: 'injected-google-id' });
    expect(response.status).toBe(201);
    const user = await User.findById(response.body.data.user.id);
    expect(user!.passwordHash).toMatch(/^\$2[aby]\$/); expect(user!.passwordHash).not.toBe('Hash-this-password-123');
    expect(user!.isSuperuser).toBe(false); expect(user!.googleId).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });
  it('rejects passwords that bcrypt would silently truncate', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'unicode@example.test', password: '🔐'.repeat(20) });
    expect(res.status).toBe(400);
  });
});

describe('private audio delivery', () => {
  const ticket = async () => (await request(app).post(`/api/v1/recordings/${recordingId}/audio-ticket`).set(auth(owner.access_token))).body.data.ticket;
  it('issues a recording-bound ticket and preserves byte-range playback', async () => {
    const media = await ticket();
    const response = await request(app).get(`/api/v1/recordings/${recordingId}/audio?ticket=${media}`).set('Range', 'bytes=0-11');
    expect(response.status).toBe(206); expect(response.headers['content-range']).toBe(`bytes 0-11/${audio.length}`);
    expect(response.headers['cache-control']).toContain('no-store');
    expect((await request(app).get('/api/v1/recordings').set(auth(media))).status).toBe(401);
    expect((await request(app).get(`/api/v1/recordings/wrong-id/audio?ticket=${media}`)).status).toBe(401);
  });
  it('rejects expired media tickets', async () => {
    const media = jwt.sign({ purpose: 'recording-audio', userId: owner.user.id, workspaceId: owner.workspace.id, recordingId }, config.jwtSecret, { issuer: 'voxmind', audience: 'voxmind-audio', expiresIn: -1 });
    expect((await request(app).get(`/api/v1/recordings/${recordingId}/audio?ticket=${media}`)).status).toBe(401);
  });
  it('invalidates audio tickets when their source API key is revoked', async () => {
    const response = await request(app).post(`/api/v1/recordings/${recordingId}/audio-ticket`).set(auth(writeKey));
    expect(response.status).toBe(200);
    const key = await ApiKey.findOne({ name: 'Test write' });
    await ApiKey.updateOne({ _id: key!._id }, { isRevoked: true });
    try { expect((await request(app).get(`/api/v1/recordings/${recordingId}/audio?ticket=${response.body.data.ticket}`)).status).toBe(401); }
    finally { await ApiKey.updateOne({ _id: key!._id }, { isRevoked: false }); }
  });
  it('handles out-of-range and suffix ranges without crashing', async () => {
    const media = await ticket();
    expect((await request(app).get(`/api/v1/recordings/${recordingId}/audio?ticket=${media}`).set('Range', 'bytes=999999-')).status).toBe(416);
    expect((await request(app).get(`/api/v1/recordings/${recordingId}/audio?ticket=${media}`).set('Range', 'bytes=-8')).status).toBe(206);
  });
  it('rejects a stored path or symlink outside recording storage', async () => {
    const outside = path.join(os.tmpdir(), `voxmind-outside-${Date.now()}`);
    await fs.writeFile(outside, 'private server data');
    const link = path.join(root, 'outside.wav'); await fs.symlink(outside, link);
    try {
      await Recording.updateOne({ _id: recordingId }, { storagePath: link });
      expect((await request(app).get(`/api/v1/recordings/${recordingId}/audio`).set(auth(owner.access_token))).status).toBe(404);
    } finally { await Recording.updateOne({ _id: recordingId }, { storagePath: path.join(root, 'recording.wav') }); await fs.rm(outside); await fs.rm(link); }
  });
});

describe('input validation and resource protection', () => {
  it('rejects disguised uploads and removes temporary files', async () => {
    const before = await fs.readdir(root);
    const res = await request(app).post('/api/v1/recordings').set(auth(owner.access_token)).attach('file', Buffer.from('<html><script>alert(1)</script></html>'), { filename: 'attack.mp3', contentType: 'audio/mpeg' });
    expect(res.status).toBe(400); expect(res.body.code).toBe('INVALID_AUDIO_CONTENT');
    expect(await fs.readdir(root)).toEqual(before);
  });
  it('accepts real audio content and returns a recording ID for polling', async () => {
    const res = await request(app).post('/api/v1/recordings').set(auth(writeKey)).field('title', 'API upload').attach('file', audio, 'upload.wav');
    expect(res.status).toBe(201); expect(res.body.data.id).toBeTruthy(); expect(res.body.data.status).toBe('queued');
    expect((await request(app).get(`/api/v1/recordings/${res.body.data.id}`).set(auth(writeKey))).status).toBe(200);
  });
  it('rejects cross-workspace collection assignment and cleans rejected uploads', async () => {
    const foreign = await Collection.create({ workspaceId: other.workspace.id, createdById: other.user.id, name: 'Private project' });
    expect((await request(app).patch(`/api/v1/recordings/${recordingId}`).set(auth(owner.access_token)).send({ collection_id: foreign._id })).status).toBe(404);
    const before = await fs.readdir(root);
    expect((await request(app).post('/api/v1/recordings').set(auth(owner.access_token)).field('collection_id', foreign._id).attach('file', audio, 'reject.wav')).status).toBe(404);
    expect(await fs.readdir(root)).toEqual(before);
  });
  it('rejects NoSQL filter objects, unbounded pagination and malformed questions', async () => {
    for (const body of [{ query: { $ne: null } }, { query: 'hello', recording_id: { $ne: null } }, { query: 'hello', limit: 100000 }]) {
      expect((await request(app).post('/api/v1/search').set(auth(owner.access_token)).send(body)).status).toBe(400);
    }
    expect((await request(app).get('/api/v1/recordings?page_size=99999').set(auth(owner.access_token))).status).toBe(400);
    expect((await request(app).post('/api/v1/knowledge/ask').set(auth(owner.access_token)).send({ question: ['wrong'] })).status).toBe(400);
  });
  it('treats regex operators as literal text', async () => {
    const res = await request(app).get('/api/v1/recordings?search=.*').set(auth(owner.access_token));
    expect(res.status).toBe(200); expect(res.body.total).toBe(0);
  });
  it('rejects excessive JSON and compressed request bodies', async () => {
    expect((await request(app).post('/api/v1/auth/login').send({ junk: 'x'.repeat(270000) })).status).toBe(413);
    expect((await request(app).post('/api/v1/auth/login').set('Content-Type', 'application/json').set('Content-Encoding', 'gzip').send(Buffer.from('invalid compressed body'))).status).toBe(415);
  });
  it('does not expose diagnostics or unexpected server errors', async () => {
    expect((await request(app).get('/api/v1/diagnostics')).status).toBe(401);
    expect((await request(app).get('/api/v1/diagnostics').set(auth(owner.access_token))).status).toBe(403);
    const isolated = express(); isolated.get('/fail', () => { throw new Error('mongodb://admin:SECRET@example/private-path'); }); isolated.use(errorHandler);
    const result = await request(isolated).get('/fail'); expect(result.status).toBe(500); expect(JSON.stringify(result.body)).not.toContain('SECRET');
  });
  it('limits repeated requests even when callers spoof forwarded IPs', async () => {
    const limited = express(); limited.use(createRateLimiter('test', 2, 60000)); limited.get('/', (_req, res) => res.json({ ok: true }));
    expect((await request(limited).get('/')).status).toBe(200);
    expect((await request(limited).get('/')).status).toBe(200);
    const res = await request(limited).get('/').set('X-Forwarded-For', '203.0.113.1');
    expect(res.status).toBe(429); expect(res.headers['retry-after']).toBeTruthy();
  });
  it('does not allow arbitrary browser origins', async () => {
    const response = await request(app).get('/api/v1/recordings').set(auth(owner.access_token)).set('Origin', 'https://attacker.example');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
  it('invalidates previous sessions and keys when changing a password', async () => {
    const res = await request(app).patch('/api/v1/auth/me').set(auth(other.access_token)).send({ currentPassword: 'Strong-password-123', newPassword: 'New-strong-password-456' });
    expect(res.status).toBe(200);
    expect(res.body.data.access_token).toBeTruthy();
    expect((await request(app).get('/api/v1/auth/me').set(auth(res.body.data.access_token))).status).toBe(200);
    expect((await request(app).get('/api/v1/auth/me').set(auth(other.access_token))).status).toBe(401);
  });
});
