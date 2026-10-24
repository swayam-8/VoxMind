# MeetingBrief security and deployment

MeetingBrief is the public product name. The existing `swayam-8/VoxMind` repository, database names, Docker container names, volumes, and browser storage keys remain stable so an update does not hide existing accounts or recordings.

## What was changed

- Removed the disconnected Flask/Celery application, duplicate Python backend tests, relational migrations, and unused UI/API controls. The active architecture is React → Express/Mongoose → BullMQ/Redis → private FastAPI/Ollama inference. The optional SQLite-to-Mongo migration utility remains under `scripts/` with its own Python requirements.
- Current workspace membership is checked for every session, API key, and media ticket. Removed members lose access; API keys no longer acquire administrator permissions. Viewer roles cannot mutate recordings or collections.
- Keys are stored as SHA-256 hashes and shown once at creation. New keys use `mb_live_`; existing `vm_live_` keys remain accepted. Keys default to read-only, expire after 90 days by default, and can be created for 1–365 days. Read/write keys are required for uploads and mutations. Existing keys without an access level are treated as read-only. API keys cannot manage passwords, other keys, or OAuth account connections.
- Passwords are salted bcrypt hashes. New passwords are limited to 72 UTF-8 bytes to prevent bcrypt truncation. Password changes invalidate older JWT sessions, revoke API keys, and issue a replacement token for the active browser. Inactive users cannot sign in. JWTs require HS256, the expected issuer/audience, and a session purpose. Legacy JWTs without these claims require a fresh sign-in after updating.
- Full login tokens and API keys are rejected in query strings. Browser audio uses a 15-minute ticket bound to one recording and rechecks account status, membership, password version and the source API key’s revocation/expiry. Direct server clients can stream with an authorization header. Storage paths are canonicalized and confined to the upload root; byte ranges use Express/send rather than unchecked manual parsing.
- Uploads have multipart limits, MIME/header validation, generated filenames and restricted file permissions. Invalid uploads and uploads to foreign collections are cleaned up. File signatures are an early check, not a malware or complete codec-validity guarantee.
- Request bodies, pagination, question sizes, bulk lists and search results are bounded. Search input is escaped as literal text. Search/RAG filters reject object-valued selectors. AI/search requests and uploads have workspace limits; authentication and general API requests have IP limits.
- Production request limits share Redis across backend instances and fail closed when the store is unavailable. Test/development use an in-process store. The reverse proxy overwrites client-supplied forwarding headers. Do not expose a backend that trusts proxy headers directly to the internet.
- The private AI service requires a separate random internal key, bounds actual request bytes, disables browser CORS/docs, confines local audio paths and restricts FFmpeg protocols. The shared recordings volume is read-only for the AI container. Database, Redis, backend and AI host ports bind to loopback by default.
- The web server sends a restrictive Content Security Policy, anti-framing and MIME-sniffing protection, no-referrer policy and revalidation headers. Report printing uses event listeners instead of inline scripts. APIs return no-store headers; unexpected errors do not disclose exception messages to callers. Deployment diagnostics require a service-operator account. Customer settings no longer expose host configuration or fake controls. Request logs omit query strings and credentials; database connection strings are not logged during startup.
- Updated vulnerable Node dependencies and Python model-cache/build-tool dependencies; added dependency audit steps to CI. Audit results are a snapshot and do not prove the absence of vulnerabilities.

## Google sign-in

In Google Cloud, create an OAuth **web application**. Enable identity scopes `openid email profile`. Configure the consent screen and production publishing/verification requirements for your audience. Store credentials in your deployment’s secret manager:

```
GOOGLE_AUTH_CLIENT_ID=...
GOOGLE_AUTH_CLIENT_SECRET=...
AUTH_API_BASE_URL=https://your-product.example
FRONTEND_URL=https://your-product.example
```

The application can reuse `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` if the identity-specific values are empty. Add the exact redirect URL:

```
https://your-product.example/api/v1/auth/google/callback
```

For local Docker testing use `http://localhost:5000/api/v1/auth/google/callback` and `FRONTEND_URL=http://localhost:5173`. Restart the backend after changing credentials. Credentials are never entered into the browser bundle.

Sign-in uses authorization code flow, PKCE, a nonce, a one-time ten-minute database state, and an HttpOnly browser cookie. Google’s official client verifies the ID token’s signature, issuer, audience and expiration; the application verifies the nonce and verified email claim. Tokens do not travel in redirect URLs: a one-time 60-second HttpOnly exchange cookie completes sign-in through a POST request. Google sign-in requests no Drive access.

An existing password account is never silently linked on email match. Its owner signs in normally, confirms the current password in Settings, and connects Google. Google-only accounts cannot disconnect their only sign-in method. Google’s subject ID is the stable account identity; names and email claims do not grant access to another existing account.

## Deployment boundaries

The default Compose stack is intended for local operation, not an internet deployment without configuration. Before public launch:

1. Serve the frontend and `/api` on one public HTTPS origin behind a TLS gateway. Configure the service URLs and exact CORS origin. Public product documentation is `/app/docs`; OpenAPI is `/api/v1/openapi.json`.
2. Keep database, Redis, AI, Ollama and worker networks private. Use authenticated managed MongoDB/Redis, TLS connections (`mongodb+srv://` / `rediss://` as appropriate), persistent backups and separate production credentials. Do not enable database authentication on an existing unauthenticated volume without planning its user migration.
3. Set CPU/memory/disk/request-concurrency limits and admission/billing controls based on measured transcription costs. Rate limiting alone does not prevent distributed abuse or cap total inference spend. Add bot/email verification and operational alerts before unrestricted registration.
4. Store audio on private, encrypted production storage with clear retention, backup and deletion policies. Local filesystem recordings are **not encrypted by this application**. A shared object-storage implementation is needed before scaling storage across multiple hosts.
5. Keep the JWT, AI internal key and integration encryption key private and stable. Rotate exposed credentials deliberately; rotating the integration encryption key without migrating saved ciphertext breaks existing provider connections. `npm start` generates missing local keys and preserves existing ones.
6. Register and publish production Zoom/Google/Webex OAuth applications once for the service. Provider verification and authorized test accounts are required for live validation. Connecting a meeting provider never joins or records a live call automatically.
7. Complete account-recovery email, production monitoring, backup recovery tests, business contact/privacy terms, provider data-deletion requirements and an independent security review before selling access. The in-app privacy page describes implemented behavior; it is not a substitute for operator-specific legal terms.

The browser currently stores its bearer session in local storage. CSP and safe rendering reduce exposure, but an XSS vulnerability would still put that session at risk. A future migration to short-lived access tokens with rotating HttpOnly refresh sessions would further reduce this risk. Do not claim the service is unhackable or independently certified.

## Verification

Run `npm test`, backend tests/build, frontend build/lint/report/browser checks, Python tests, `npm audit` in both Node packages and `pip-audit` against the installed Python environment. Security tests cover cross-workspace access, removed roles, expired/revoked keys, disguised uploads, path/symlink escape, audio ticket misuse, validation, byte ranges, password session invalidation and rate limits. Google and meeting-provider tests mock provider responses; live account consent and real model inference must be checked separately.
