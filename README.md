# MeetingBrief

Turn meeting recordings into searchable transcripts, summaries, decisions, action items, and answers.

MeetingBrief includes a public landing page, email/password accounts, Google sign-in, a recording workspace, meeting-provider imports, and a documented API. The existing database names, browser storage keys, Docker project and volumes retain their original identifiers so renaming the project does not hide existing data.

## Run locally

Install **Node.js 22.12+** and start **Docker Desktop** (or Docker Engine with Compose). From the project root:

```sh
npm start
```

Open **http://localhost:5173**. The root URL shows the landing page. Create an account or sign in to open your workspace.

The launcher generates missing local secrets, builds the services, and starts MongoDB, Redis, Ollama, the Python inference service, the backend and the web client. Ollama’s model downloads in the background on first start; summaries and answers become available after it finishes. Whisper and embedding weights download when first used. Allow several GB of downloads, at least 15 GB of Docker disk space and 8 GB of memory.

```sh
npm stop       # Stop services and preserve data
npm run logs   # Follow service logs
npm start      # Start again, or rebuild after pulling changes
```

To create a new checkout while the repository still has its previous slug:

```sh
git clone https://github.com/swayam-8/VoxMind.git meetingbrief
cd meetingbrief
npm start
```

The GitHub repository can be renamed to `meetingbrief` in **Settings → General → Repository name**. Public website branding is already MeetingBrief. Compose deliberately keeps its original project name for data compatibility.

## What works

- Upload supported audio/video recordings and track asynchronous transcription.
- Play audio, search timestamped transcripts and jump to evidence.
- Review summaries, takeaways, explicit decisions and action items; save task completion.
- Ask about a recording or search across your workspace. Recording questions and answers persist per user.
- Export all four insight sections, including saved Q&A, to a printable PDF report. Markdown exports include the transcript.
- Connect Zoom, Google Meet/Drive and Webex to import completed cloud recordings once the operator configures the provider apps.
- Create expiring read-only or read/write API keys and use the REST API from your server.
- Sign in with a password or Google. Existing password accounts link Google in Settings after confirming their password.

## Customer instructions stay in the product

Open **Guides & API** at **/app/docs** for working cURL, PowerShell, Node.js and Python examples, processing states, permissions, errors, provider requirements and connection troubleshooting. Download the OpenAPI contract at **/api/v1/openapi.json**.

The customer connection flow is **Connect → authorize with the provider → browse recordings → import**. Customers do not create OAuth applications or supply client secrets. Connecting an account does not join, start or record a meeting.

## Google sign-in and meeting-provider setup

Google sign-in is disabled until its OAuth credentials are configured. Register a Google OAuth web application, then set these private server values in the root `.env` for Docker:

```dotenv
GOOGLE_AUTH_CLIENT_ID=your-client-id
GOOGLE_AUTH_CLIENT_SECRET=your-client-secret
AUTH_API_BASE_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5173
```

Allow this local redirect URL:

```
http://localhost:5000/api/v1/auth/google/callback
```

For deployment, use your public HTTPS origin for both URL settings and the corresponding HTTPS callback. Google identity uses `openid email profile`; Drive access for meeting imports is authorized separately. If the identity-specific credential values are empty, the backend can reuse `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

Meeting imports additionally need the provider’s client ID/secret and exact callbacks. See the operator instructions in **/app/docs**, or [meeting integration configuration](docs/meeting-integrations.md). Run `npm start` after changing configuration. Never put credentials in `VITE_` variables or commit `.env` files.

## Proposed next architecture

A transcript-only hybrid design would run speech-to-text on the customer’s device and send approved transcript text to hosted intelligence. It is not implemented by the current upload flow. See [the hybrid architecture proposal](docs/hybrid-architecture.md) for data boundaries, browser/desktop tradeoffs, provider-import constraints and delivery steps.

## Architecture

```
Browser / API customer
        │
        ▼
Nginx → Express API → MongoDB
             │
             ▼
         Redis / BullMQ
             │
             ▼
     Private FastAPI service → Whisper / embeddings / Ollama
```

The API verifies current workspace membership and permissions. Uploads and analysis run through background workers. Files are private local storage in the default stack. Production requires HTTPS, private infrastructure, authenticated databases, storage encryption/backups, operational limits and provider app approval; the local Compose stack is not an unrestricted public SaaS deployment.

```
frontend/src/
  app/                      Routes and providers
  components/               Shared controls, brand and navigation
  features/auth/            Password and Google sign-in, account linking
  features/marketing/       Public landing and privacy pages
  features/recordings/      Uploads, transcript, insights, player and reports
  features/integrations/    Meeting imports, API keys and customer guides
  features/settings/        Account, appearance and password settings
  styles/                   Shared tokens and feature styles
backend/src/
  middleware/               Authentication, authorization, limits and uploads
  modules/                  Auth, recordings, collections, search, keys and docs
  database/                 MongoDB models
  queues/                   Background workers
  services/                 AI client, storage and provider OAuth/downloads
  tests/                    API, security, OAuth and processing regression tests
ai-service/
  app/                      Private inference endpoints and services
  tests/                    Inference contracts, normalization and security
scripts/                    Startup, verification and optional legacy migration
```

The obsolete Flask/Celery backend and duplicate tests were removed. A separate optional SQLite-to-Mongo migration utility remains; its Python dependency is in `scripts/requirements-migration.txt`.

## Security and validation

Passwords use salted bcrypt hashes. JWTs are restricted to the expected algorithm, issuer, audience and purpose; password changes invalidate older sessions and revoke API keys. Google sign-in uses PKCE, nonce validation, one-time browser-bound state and Google’s official ID-token verifier. API keys are hashed, expire and respect current membership and their read/write setting. Audio URLs use recording-specific short-lived tickets instead of full login tokens.

Uploads and request sizes are bounded. Inputs are validated, user searches are literal text, storage paths cannot escape the recording root, internal inference requests require a separate secret, and production rate limits share Redis. The web server sends security headers and CSP. Dependency audits run in CI.

Read [security and deployment](docs/security-and-deployment.md) for specific safeguards, upgrade behavior, production requirements and remaining limitations. No security review can guarantee that software is unhackable.

Useful checks after installing the development dependencies:

```sh
npm test
npm test --prefix backend
npm run build --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
npm run test:report --prefix frontend
npm run test:insights --prefix frontend
npm run test:layout --prefix frontend
npm run test:product --prefix frontend
npm run test:meetings --prefix frontend
npm audit --prefix backend
npm audit --prefix frontend
```

Browser tests use `VOXMIND_BASE_URL` to choose a server. Product/meeting checks require the local backend; insight/layout checks mock API responses. Python development dependencies are in `ai-service/requirements-dev.txt`; run `python -m pytest tests` from that service directory and audit its installed environment with `pip-audit`.

Automated provider tests use controlled responses. Live Google/Zoom/Meet/Webex consent and model inference need separately configured accounts and models; test passing does not imply those external systems were verified.
