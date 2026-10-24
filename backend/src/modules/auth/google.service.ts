import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { AppError } from '../../middleware/errorHandler.js';

export const authHash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
export function googleSettings() {
  const clientId = process.env.GOOGLE_AUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_AUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
  const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const api = (process.env.AUTH_API_BASE_URL || process.env.INTEGRATIONS_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
  for (const raw of [frontend, api]) {
    const url = new URL(raw);
    if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) {
      throw new AppError('Configure public HTTPS authentication URLs', 503, 'AUTH_NOT_CONFIGURED');
    }
  }
  return { clientId, clientSecret, frontend, callback: `${api}/api/v1/auth/google/callback`, configured: Boolean(clientId && clientSecret) };
}

export function googleAuthorization(state: string, verifier: string, nonce: string) {
  const settings = googleSettings();
  if (!settings.configured) throw new AppError('Google sign-in is not available yet. Use email and password.', 503, 'GOOGLE_NOT_CONFIGURED');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: settings.clientId, redirect_uri: settings.callback,
    response_type: 'code', scope: 'openid email profile', state, nonce,
    code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256', prompt: 'select_account',
  }).toString();
  return url.toString();
}

/** The official client verifies signature, issuer, audience and expiry. We additionally bind the nonce. */
export async function verifyGoogleCode(code: string, verifier: string, nonce: string) {
  const settings = googleSettings();
  try {
    const client = new OAuth2Client(settings.clientId, settings.clientSecret, settings.callback);
    const response = await client.getToken({ code, codeVerifier: verifier, redirect_uri: settings.callback });
    if (!response.tokens.id_token) throw new Error('Missing identity token');
    const ticket = await client.verifyIdToken({ idToken: response.tokens.id_token, audience: settings.clientId });
    const identity = ticket.getPayload();
    if (!identity || !identity.sub || !identity.email || identity.email_verified !== true ||
      (identity as typeof identity & { nonce?: string }).nonce !== nonce) throw new Error('Invalid identity');
    return { subject: identity.sub, email: identity.email.toLowerCase().trim(), name: (identity.name || identity.email.split('@')[0]).slice(0, 120) };
  } catch { throw new AppError('Google could not verify this sign-in. Please try again.', 401, 'GOOGLE_VERIFICATION_FAILED'); }
}
