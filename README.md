# VoxMind — Local-First AI Voice Intelligence Platform

[![CI Pipeline](https://github.com/voxmind/voxmind/actions/workflows/ci.yml/badge.svg)](https://github.com/voxmind/voxmind/actions/workflows/ci.yml)
[![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%7C%20TypeScript%20%7C%20Vite%20%7C%20Tailwind-blue)](frontend)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express%20%7C%20TypeScript%20%7C%20MongoDB-green)](backend)
[![Queue](https://img.shields.io/badge/Queue-Redis%20%7C%20BullMQ-red)](backend/src/queues)
[![AI Service](https://img.shields.io/badge/AI%20Microservice-FastAPI%20%7C%20Whisper%20%7C%20Ollama-purple)](ai-service)
[![License](https://img.shields.io/badge/License-MIT-gray.svg)](LICENSE)

VoxMind is an enterprise-grade, local-first voice intelligence platform that transforms multi-speaker audio recordings into verified, actionable, and searchable intelligence. 

It executes transcription, executive summarization, decision extraction, and action item detection using local AI engines (`faster-whisper` and `Ollama`), accompanied by cross-recording semantic vector search (RAG) with precise, clickable audio timestamp citations.

All inference runs **100% locally on-premises** with zero external cloud API dependencies, ensuring complete enterprise data residency and compliance.

---

## Architecture Overview

```
                      +---------------------------------------+
                      |       React + TypeScript Client       |
                      |        Obsidian AI Design System      |
                      +-------------------+-------------------+
                                          |
                                 HTTP Range / JSON
                                          v
                      +-------------------+-------------------+
                      |   Node.js Express API (/api/v1)       |
                      |   JWT Auth & Strict Tenant Scoping    |
                      +---------+-------------------+---------+
                                |                   |
                 +--------------+                   +-------------+
                 v                                                v
      +--------------------+                           +--------------------+
      |  MongoDB Document  |                           | Redis + BullMQ     |
      |  & Vector Store    |                           | Background Worker  |
      +--------------------+                           +----------+---------+
                                                                  |
                                              +-------------------+-------------------+
                                              v                                       v
                                    +--------------------+                 +--------------------+
                                    | Python AI Service  |                 |    Ollama LLM      |
                                    | (FastAPI Microsvc) |                 | (Insights & RAG)   |
                                    +----------+---------+                 +--------------------+
                                               |
                               +---------------+---------------+
                               v                               v
                     +--------------------+          +--------------------+
                     |   faster-whisper   |          | sentence-transf.   |
                     | (Speech-to-Text)   |          | (all-MiniLM-L6-v2) |
                     +--------------------+          +--------------------+
```

---

## Directory Structure

```
VoxMind/
├── .github/
│   └── workflows/
│       └── ci.yml                  # GitHub Actions CI for Frontend, Backend, & AI Service
├── .gitignore                      # Git ignore rules for Python, Node, Audio & Env
├── .env.example                    # Root environment configuration template
├── docker-compose.yml              # Production container orchestration
├── README.md                       # Master platform documentation
├── ai-service/                     # Python Local AI Microservice (FastAPI)
│   ├── Dockerfile                  # Container definition with ffmpeg & PyTorch
│   ├── requirements.txt            # Microservice dependencies
│   ├── app/
│   │   ├── main.py                 # FastAPI application routes (/transcribe, /analyze, /rag)
│   │   └── schemas.py              # Pydantic v2 bidirectional request/response schemas
│   └── tests/
│       └── test_ai_service.py      # Contract & schema integration tests
├── backend/                        # Primary Application Backend (Node.js + Express)
│   ├── Dockerfile                  # Multi-stage production container build
│   ├── package.json                # Express, BullMQ, Mongoose, Vitest dependencies
│   ├── tsconfig.json               # Strict TypeScript configuration
│   └── src/
│       ├── app.ts                  # Express application factory & middleware
│       ├── server.ts               # HTTP server entrypoint
│       ├── config/                 # Environment configuration & JWT validation
│       ├── database/               # Mongoose schemas & MongoDB connection
│       ├── middleware/             # Auth, upload (Multer), logging (Pino), error handler
│       ├── modules/
│       │   ├── auth/               # JWT authentication, registration, profile updates
│       │   ├── recordings/         # Audio management, streaming, and metadata
│       │   ├── collections/        # Workspace grouping & collection tagging
│       │   ├── search/             # Semantic search & RAG question answering
│       │   ├── api-keys/           # Developer API keys (`vm_live_...`)
│       │   ├── usage/              # Token & audio processing usage ledger
│       │   └── diagnostics/        # Live infrastructure probes & system metrics
│       ├── queues/                 # BullMQ queues for audio processing & AI inference
│       ├── services/               # AI service client, token management, storage
│       └── tests/
│           └── api.test.ts         # Vitest integration test suite
├── backend-flask/                  # Preserved Reference Implementation (Flask + Celery)
├── frontend/                       # Web Client (React 19 + TypeScript + Vite)
│   ├── Dockerfile                  # Multi-stage Nginx production build
│   ├── nginx.conf                  # Reverse proxy configuration
│   ├── package.json                # Dependencies (Radix UI, TanStack Query, Lucide)
│   ├── vite.config.ts              # Code-splitting & path alias configuration
│   └── src/
│       ├── App.tsx                 # Root application setup with React Query & Routing
│       ├── index.css               # Obsidian AI CSS tokens (dark/light themes)
│       ├── components/             # Obsidian AI UI primitives & layout shells
│       ├── lib/                    # Typed API client with JWT and error envelopes
│       └── routes/                 # Lazy-loaded route views (/overview, /recordings, /ask)
└── scripts/                        # Utility & orchestration scripts
    ├── start-docker.ps1            # Windows PowerShell Docker Compose startup
    ├── start-docker.sh             # Linux/macOS Docker Compose startup
    └── verify-services.ps1         # Service connectivity & diagnostic verification
```

---

## Core Capabilities

### 1. Local Speech-to-Text Transcription (`faster-whisper`)
- Zero-cloud speech recognition using CTranslate2-optimized `faster-whisper`.
- Computes start/end millisecond timestamps, speaker identification, and confidence scores.
- Runs on CPU (`int8`) or NVIDIA GPU (`float16`/`int8_float16`).

### 2. Local AI Intelligence & Insights (`Ollama`)
- Executive summaries synthesized in structured Markdown.
- Automatic extraction of key takeaways, critical decisions, and action items with owners and deadlines.
- Interactive question-answering with transcript citations.

### 3. Vector Embeddings & Grounded Cross-Recording RAG
- Dialogue-aware transcript chunking preserving speaker context and timestamps.
- 384-dimensional embeddings generated locally using `sentence-transformers` (`all-MiniLM-L6-v2`).
- Vector search with cosine similarity and RAG synthesis grounded in transcript evidence with audio seek links.

### 4. Enterprise Security, Multi-Tenancy & Usage Ledger
- Cryptographically signed JWT authentication with fail-fast secret validation in production.
- Strict workspace isolation: all recordings, chunks, summaries, and collections are tenant-scoped.
- Granular usage tracking for audio seconds, LLM tokens (prompt + completion), and vector embeddings.
- Developer API keys (`vm_live_...`) with SHA-256 one-way hashing and instant revocation.

---

## Quickstart Guide

### Option A: Complete Docker Compose Orchestration (Recommended)

Ensure Docker Desktop or Docker Engine is running on your host machine.

```bash
# 1. Clone the repository
git clone https://github.com/voxmind/voxmind.git
cd VoxMind

# 2. Configure environment
cp .env.example .env

# 3. Pull Ollama model on host (if using host Ollama)
ollama pull llama3.2

# 4. Start all services
# On Linux/macOS:
./scripts/start-docker.sh --build

# On Windows (PowerShell):
.\scripts\start-docker.ps1 -Build
```

Once running:
- **Web UI:** `http://localhost:5173`
- **REST API:** `http://localhost:5000/api/v1`
- **API Health:** `http://localhost:5000/health`
- **AI Microservice:** `http://localhost:8000/health`

---

### Option B: Local Native Development

#### 1. Start Support Services
Ensure **MongoDB** (port 27017), **Redis** (port 6379), and **Ollama** (port 11434 with `llama3.2`) are running.

#### 2. Start Python AI Microservice
```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 3. Start Express Backend
```powershell
cd backend
npm install
npm run dev
```

#### 4. Start React Frontend
```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` to access the application.

---

## Automated Test Suites & CI/CD

VoxMind maintains 100% passing test suites across all layers of the stack:

```powershell
# 1. Frontend: Linting (oxlint) & TypeScript build
npm run lint --prefix frontend
npm run build --prefix frontend

# 2. Express Backend: Vitest integration test suite (17 tests)
npm run test --prefix backend

# 3. AI Microservice: Pytest contract & schema suite (11 tests)
$env:PYTHONPATH="ai-service"; pytest ai-service/tests/test_ai_service.py -v
```

### GitHub Actions CI
All commits and pull requests are automatically validated via `.github/workflows/ci.yml`:
- **Frontend CI:** Clean install with lockfile, `oxlint`, and `tsc -b && vite build`.
- **Backend CI:** Clean install, TypeScript compilation, and in-memory Vitest integration tests.
- **AI Service CI:** Clean install and Pytest contract verification without downloading multi-gigabyte models.

---

## Milestone History

| Milestone | Architecture / Objectives | Status |
|---|---|---|
| **Phase 1** | Obsidian AI Design System & UX Scaffolding | Completed |
| **Phase 2** | Application Shell, Navigable Routes, & Audio Player | Completed |
| **Phase 3** | Initial REST API & Relational Models (Flask reference) | Completed |
| **Phase 4** | Background Queue & Local faster-whisper Transcription | Completed |
| **Phase 5** | Ollama Local LLM Summaries, Key Decisions, & Action Items | Completed |
| **Phase 6** | Transcript Chunking, Embeddings, & Semantic RAG Search | Completed |
| **Phase 7** | Workspace Collections, API Keys, Usage Ledger, & Diagnostics | Completed |
| **Phase 8** | MERN Backend Migration (Node/Express/MongoDB/BullMQ) + FastAPI AI Service | Completed |
| **Phase 9A**| Critical Integration Fixes: Schema Normalization & Real Auth | Completed |
| **Phase 9B**| Production Readiness, Portfolio Showcase, CI/CD, & Final Polish | Completed |
