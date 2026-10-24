import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../database/connection.js';
import { User } from '../database/models/User.js';
import { Workspace } from '../database/models/Workspace.js';
import { WorkspaceMembership } from '../database/models/WorkspaceMembership.js';
import { GoogleLoginState } from '../modules/auth/google.models.js';
import { authHash } from '../modules/auth/google.service.js';
import { TokenService } from '../services/tokenService.js';
const app = createApp();
let mongo: MongoMemoryServer;
let nonce = '';
let identity = { sub: 'google-user-1', email: 'google-user@example.test', name: 'Google User', email_verified: true };
let owner: any;
beforeAll(async () => {
  vi.stubEnv('GOOGLE_AUTH_CLIENT_ID', 'fixture-google-client'); vi.stubEnv('GOOGLE_AUTH_CLIENT_SECRET', 'fixture-google-secret');
  vi.stubEnv('FRONTEND_URL', 'http://localhost:5173'); vi.stubEnv('AUTH_API_BASE_URL', 'http://localhost:5000');
  mongo = await MongoMemoryServer.create(); await connectDatabase(mongo.getUri());
  owner = (await request(app).post('/api/v1/auth/register').send({ email: 'password-user@example.test', password: 'Correct-password-123', fullName: 'Password User' })).body.data;
}, 180000);
beforeEach(() => {
  identity = { sub: 'google-user-1', email: 'google-user@example.test', name: 'Google User', email_verified: true };
  vi.spyOn(OAuth2Client.prototype, 'getToken').mockResolvedValue({ tokens: { id_token: 'fixture-id-token' } } as any);
  vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockImplementation(async () => ({ getPayload: () => ({ ...identity, nonce }) }) as any);
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { await disconnectDatabase(); await mongo?.stop(); vi.unstubAllEnvs(); });
const begin = async (link = false) => {
  const response = link ? await request(app).post('/api/v1/auth/google/connect').set('Authorization', `Bearer ${owner.access_token}`).send({ currentPassword: 'Correct-password-123' }) : await request(app).get('/api/v1/auth/google/start');
  expect(response.status).toBe(link ? 200 : 303);
  const location = new URL(link ? response.body.data.authorize_url : response.headers.location);
  const state = location.searchParams.get('state')!;
  const stored = await GoogleLoginState.findOne({ stateHash: authHash(state) });
  nonce = stored!.nonce;
  const cookie = response.headers['set-cookie'][0].split(';')[0];
  return { response, location, state, stored, cookie };
};
const callback = (flow: Awaited<ReturnType<typeof begin>>, suffix = '&code=fixture-code') => request(app).get(`/api/v1/auth/google/callback?state=${flow.state}${suffix}`).set('Cookie', flow.cookie);

describe('Google sign-in and account linking', () => {
  it('exposes only availability, never OAuth secrets', async () => {
    const res = await request(app).get('/api/v1/auth/google/config');
    expect(res.body.data).toEqual({ configured: true }); expect(JSON.stringify(res.body)).not.toContain('fixture-google-secret');
  });
  it('uses a browser-bound state, PKCE, nonce, and identity-only scopes', async () => {
    const flow = await begin();
    expect(flow.location.origin).toBe('https://accounts.google.com');
    expect(flow.location.searchParams.get('scope')).toBe('openid email profile');
    expect(flow.location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(flow.location.searchParams.get('code_challenge')).toBe(crypto.createHash('sha256').update(flow.stored!.verifier).digest('base64url'));
    expect(flow.response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(flow.location.searchParams.get('redirect_uri')).toBe('http://localhost:5000/api/v1/auth/google/callback');
  });
  it('rejects a callback from another browser before token exchange', async () => {
    const flow = await begin();
    const res = await request(app).get(`/api/v1/auth/google/callback?state=${flow.state}&code=fixture-code`);
    expect(res.headers.location).toContain('reason=OAUTH_STATE_INVALID'); expect(OAuth2Client.prototype.getToken).not.toHaveBeenCalled();
  });
  it('handles cancellation and prevents replay of used state', async () => {
    const flow = await begin();
    expect((await callback(flow, '&error=access_denied')).headers.location).toContain('reason=OAUTH_ACCESS_DENIED');
    expect((await callback(flow)).headers.location).toContain('reason=OAUTH_STATE_INVALID');
  });
  it('creates a Google account and exchanges a short-lived HttpOnly cookie for JWT without URL tokens', async () => {
    const flow = await begin(); const result = await callback(flow);
    expect(result.headers.location).toBe('http://localhost:5173/auth/google/complete');
    expect(result.headers.location).not.toMatch(/token|access_token|ticket=/);
    const cookie = result.headers['set-cookie'].find((value: string) => value.startsWith('mb_google_exchange='));
    expect(cookie).toContain('HttpOnly');
    const session = await request(app).post('/api/v1/auth/google/session').set('Cookie', cookie.split(';')[0]).send({});
    expect(session.status).toBe(200);
    expect(TokenService.verify(session.body.data.access_token).userId).toBe(session.body.data.user.id);
    const user = await User.findOne({ googleId: identity.sub }); expect(user!.passwordHash).toBeNull();
    expect(await WorkspaceMembership.countDocuments({ userId: user!._id })).toBe(1);
    expect((await request(app).post('/api/v1/auth/google/session').set('Cookie', cookie.split(';')[0]).send({})).status).toBe(401);
    expect(OAuth2Client.prototype.getToken).toHaveBeenCalledWith(expect.objectContaining({ codeVerifier: flow.stored!.verifier }));
    expect(OAuth2Client.prototype.verifyIdToken).toHaveBeenCalledWith({ idToken: 'fixture-id-token', audience: 'fixture-google-client' });
  });
  it('reuses the existing Google account and workspace on subsequent sign-in', async () => {
    const before = await User.countDocuments(); const workspaces = await Workspace.countDocuments();
    expect((await callback(await begin())).headers.location).toContain('/auth/google/complete');
    expect(await User.countDocuments()).toBe(before); expect(await Workspace.countDocuments()).toBe(workspaces);
  });
  it('does not auto-link an existing password account just because email matches', async () => {
    identity = { ...identity, sub: 'new-google-subject', email: 'password-user@example.test' };
    const result = await callback(await begin());
    expect(result.headers.location).toContain('reason=GOOGLE_LINK_REQUIRED');
    expect((await User.findById(owner.user.id))!.googleId).toBeUndefined();
  });
  it('requires authentication and password confirmation before linking', async () => {
    expect((await request(app).post('/api/v1/auth/google/connect').send({})).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/google/connect').set('Authorization', `Bearer ${owner.access_token}`).send({ currentPassword: 'wrong' })).status).toBe(401);
  });
  it('links Google to the authenticated password account without creating another account', async () => {
    identity = { ...identity, sub: 'linked-google-user', email: 'password-user@example.test' };
    const before = await User.countDocuments();
    expect((await callback(await begin(true))).headers.location).toContain('/app/settings?google=linked');
    expect((await User.findById(owner.user.id))!.googleId).toBe('linked-google-user');
    expect(await User.countDocuments()).toBe(before);
    const flow = await begin(); expect((await callback(flow)).headers.location).toContain('/auth/google/complete');
  });
  it('rejects unverified email, mismatched nonce and provider failures', async () => {
    identity.email_verified = false;
    expect((await callback(await begin())).headers.location).toContain('reason=GOOGLE_VERIFICATION_FAILED');
    identity.email_verified = true;
    const flow = await begin(); nonce = 'wrong-nonce';
    expect((await callback(flow)).headers.location).toContain('reason=GOOGLE_VERIFICATION_FAILED');
    vi.mocked(OAuth2Client.prototype.getToken).mockRejectedValueOnce(new Error('private-provider-secret'));
    const failed = await callback(await begin()); expect(failed.headers.location).not.toContain('private-provider-secret');
  });
  it('rejects expired state and missing session exchange cookies', async () => {
    const flow = await begin(); await GoogleLoginState.updateOne({ stateHash: authHash(flow.state) }, { expiresAt: new Date(0) });
    expect((await callback(flow)).headers.location).toContain('reason=OAUTH_STATE_INVALID');
    expect((await request(app).post('/api/v1/auth/google/session').send({})).status).toBe(401);
  });
  it('does not let a Google-only account remove its only sign-in method', async () => {
    const user = await User.findOne({ googleId: 'google-user-1' }); const membership = await WorkspaceMembership.findOne({ userId: user!._id });
    const token = TokenService.sign({ userId: user!._id, email: user!.email, workspaceId: membership!.workspaceId });
    expect((await request(app).delete('/api/v1/auth/google/connection').set('Authorization', `Bearer ${token}`)).status).toBe(400);
  });
});
