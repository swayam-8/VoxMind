import crypto from 'node:crypto';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireSession, type AuthenticatedRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { loginRateLimit } from '../../middleware/rateLimit.js';
import { User } from '../../database/models/User.js';
import { Workspace } from '../../database/models/Workspace.js';
import { WorkspaceMembership } from '../../database/models/WorkspaceMembership.js';
import { TokenService } from '../../services/tokenService.js';
import { GoogleLoginState, GoogleLoginExchange } from './google.models.js';
import { authHash, googleSettings, googleAuthorization, verifyGoogleCode } from './google.service.js';

const router = Router();
const run = (fn: (req: AuthenticatedRequest, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { void fn(req, res).catch(next); };
const stateCookie = 'mb_google_state';
const exchangeCookie = 'mb_google_exchange';
function cookies(path: string, maxAge: number) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: googleSettings().callback.startsWith('https:'), path, maxAge };
}
function readCookie(req: Request, name: string) {
  const value = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  try { return value ? decodeURIComponent(value.slice(name.length + 1)) : ''; } catch { return ''; }
}
async function begin(req: AuthenticatedRequest, res: Response, purpose: 'login' | 'link') {
  if (!googleSettings().configured) throw new AppError('Google sign-in is not available yet. Use email and password.', 503, 'GOOGLE_NOT_CONFIGURED');
  const state = crypto.randomBytes(32).toString('base64url');
  const verifier = crypto.randomBytes(48).toString('base64url');
  const nonce = crypto.randomBytes(32).toString('base64url');
  await GoogleLoginState.create({ stateHash: authHash(state), verifier, nonce, purpose,
    ...(req.user ? { userId: req.user._id, tokenVersion: req.user.tokenVersion ?? 0 } : {}), expiresAt: new Date(Date.now() + 600000) });
  res.cookie(stateCookie, state, cookies('/api/v1/auth/google/callback', 600000));
  return googleAuthorization(state, verifier, nonce);
}
router.get('/config', (_req, res) => res.json({ success: true, data: { configured: googleSettings().configured } }));
router.get('/start', loginRateLimit, run(async (req, res) => res.redirect(303, await begin(req, res, 'login'))));
router.get('/connection', authenticate, requireSession, run(async (req, res) => res.json({ success: true, data: {
  configured: googleSettings().configured, connected: Boolean(req.user!.googleId), has_password: Boolean(req.user!.passwordHash),
} })));
router.post('/connect', authenticate, requireSession, loginRateLimit, run(async (req, res) => {
  if (req.user!.passwordHash) {
    const body = z.object({ currentPassword: z.string().min(1).max(256) }).parse(req.body);
    if (!(await req.user!.checkPassword(body.currentPassword))) throw new AppError('Current password is incorrect', 401, 'INVALID_PASSWORD');
  }
  res.json({ success: true, data: { authorize_url: await begin(req, res, 'link') } });
}));
router.delete('/connection', authenticate, requireSession, run(async (req, res) => {
  if (!req.user!.passwordHash) throw new AppError('Keep Google connected: it is your only sign-in method.', 400, 'SIGN_IN_METHOD_REQUIRED');
  const body = z.object({ currentPassword: z.string().min(1).max(256) }).parse(req.body);
  if (!(await req.user!.checkPassword(body.currentPassword))) throw new AppError('Current password is incorrect', 401, 'INVALID_PASSWORD');
  await User.updateOne({ _id: req.user!._id }, { $unset: { googleId: 1 } });
  res.json({ success: true, data: { connected: false } });
}));
router.get('/callback', run(async (req, res) => {
  let purpose = 'login';
  let destination = new URL('/login', googleSettings().frontend);
  try {
    const state = z.string().min(32).max(256).parse(req.query.state);
    const browser = readCookie(req, stateCookie);
    if (!browser || !crypto.timingSafeEqual(Buffer.from(authHash(browser)), Buffer.from(authHash(state)))) throw new AppError('Sign-in request expired', 400, 'OAUTH_STATE_INVALID');
    const pending = await GoogleLoginState.findOneAndDelete({ stateHash: authHash(state), expiresAt: { $gt: new Date() } });
    if (!pending) throw new AppError('Sign-in request expired', 400, 'OAUTH_STATE_INVALID');
    purpose = pending.purpose;
    if (purpose === 'link') destination = new URL('/app/settings', googleSettings().frontend);
    if (req.query.error) throw new AppError('Google access was not granted', 400, 'OAUTH_ACCESS_DENIED');
    const code = z.string().min(1).max(4096).parse(req.query.code);
    const identity = await verifyGoogleCode(code, pending.verifier, pending.nonce);
    if (purpose === 'link') {
      const user = await User.findById(pending.userId);
      if (!user?.isActive || (user.tokenVersion ?? 0) !== pending.tokenVersion) throw new AppError('Sign in again before connecting Google', 401, 'INVALID_TOKEN');
      const linked = await User.findOne({ googleId: identity.subject });
      if ((linked && linked._id !== user._id) || (user.googleId && user.googleId !== identity.subject)) throw new AppError('This Google account is already connected', 409, 'GOOGLE_ALREADY_LINKED');
      user.googleId = identity.subject; await user.save();
      destination.searchParams.set('google', 'linked');
    } else {
      let user = await User.findOne({ googleId: identity.subject });
      if (!user) {
        // Never silently attach Google to an existing password account by matching email.
        if (await User.exists({ email: identity.email })) throw new AppError('Sign in with your password, then connect Google in Settings.', 409, 'GOOGLE_LINK_REQUIRED');
        user = await User.create({ email: identity.email, fullName: identity.name, googleId: identity.subject });
        const workspace = await Workspace.create({ name: `${identity.name}'s Workspace`, slug: `ws-${user._id}`, createdBy: user._id, isPersonal: true });
        await WorkspaceMembership.create({ userId: user._id, workspaceId: workspace._id, role: 'owner' });
      }
      if (!user.isActive || !(await WorkspaceMembership.exists({ userId: user._id }))) throw new AppError('Account unavailable', 401, 'USER_DISABLED');
      const exchange = crypto.randomBytes(32).toString('base64url');
      await GoogleLoginExchange.create({ ticketHash: authHash(exchange), userId: user._id, tokenVersion: user.tokenVersion ?? 0, expiresAt: new Date(Date.now() + 60000) });
      res.cookie(exchangeCookie, exchange, cookies('/api/v1/auth/google/session', 60000));
      destination = new URL('/auth/google/complete', googleSettings().frontend);
    }
  } catch (error) {
    destination.searchParams.set('google', 'error');
    destination.searchParams.set('reason', error instanceof AppError ? error.code : 'GOOGLE_VERIFICATION_FAILED');
  }
  res.clearCookie(stateCookie, cookies('/api/v1/auth/google/callback', 0));
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer');
  return res.redirect(303, destination.toString());
}));
router.post('/session', loginRateLimit, run(async (req, res) => {
  const raw = readCookie(req, exchangeCookie);
  res.clearCookie(exchangeCookie, cookies('/api/v1/auth/google/session', 0));
  if (!raw) throw new AppError('Sign-in expired. Start again.', 401, 'GOOGLE_SESSION_EXPIRED');
  const exchange = await GoogleLoginExchange.findOneAndDelete({ ticketHash: authHash(raw), expiresAt: { $gt: new Date() } });
  const user = exchange ? await User.findById(exchange.userId) : null;
  if (!user?.isActive || (user.tokenVersion ?? 0) !== exchange!.tokenVersion) throw new AppError('Sign-in expired. Start again.', 401, 'GOOGLE_SESSION_EXPIRED');
  const membership = await WorkspaceMembership.findOne({ userId: user._id });
  const workspace = membership ? await Workspace.findById(membership.workspaceId) : null;
  if (!membership || !workspace) throw new AppError('Workspace access unavailable', 403, 'WORKSPACE_FORBIDDEN');
  const payload = { access_token: TokenService.sign({ userId: user._id, email: user.email, workspaceId: workspace._id, tokenVersion: user.tokenVersion ?? 0 }),
    user: { id: user._id, email: user.email, fullName: user.fullName, isActive: user.isActive },
    workspace: { id: workspace._id, name: workspace.name, slug: workspace.slug, role: membership.role } };
  res.json({ success: true, data: payload });
}));
export const googleAuthRoutes = router;
