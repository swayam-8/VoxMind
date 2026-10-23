# VoxMind — Local-First AI Voice Intelligence Platform

[![CI Pipeline](https://github.com/voxmind/voxmind/actions/workflows/ci.yml/badge.svg)](https://github.com/voxmind/voxmind/actions/workflows/ci.yml)
[![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%7C%20TypeScript%20%7C%20Vite%20%7C%20Tailwind%20v4-6366F1)](frontend)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express%20%7C%20TypeScript%20%7C%20MongoDB-10B981)](backend)
[![Queue](https://img.shields.io/badge/Queue-Redis%20%7C%20BullMQ-EF4444)](backend/src/queues)
[![AI Service](https://img.shields.io/badge/AI%20Microservice-FastAPI%20%7C%20faster--whisper%20%7C%20SentenceTransformers-8B5CF6)](ai-service)
[![LLM](https://img.shields.io/badge/LLM-Local%20Ollama%20%28llama3.2%29-EC4899)](https://ollama.com)
[![Theme](https://img.shields.io/badge/Design-Listening%20Room-0C0D12)](frontend/src/index.css)
[![License](https://img.shields.io/badge/License-MIT-gray.svg)](LICENSE)

VoxMind is an enterprise-grade, **local-first voice intelligence platform** that ingests multi-speaker audio recordings, transcribes them on-premises, and extracts executive summaries, concrete decisions, and assigned action items — all backed by cross-recording semantic vector search (RAG) with millisecond-accurate audio citation playback.

All AI inference runs **100% locally on-premises** using CTranslate2-optimized `faster-whisper`, `SentenceTransformers`, and local `Ollama` (`llama3.2`). **Zero audio, transcripts, or customer data ever leave your infrastructure.**

---

## Architecture Overview

VoxMind employs an asynchronous, polyglot microservices architecture designed to decouple high-throughput web I/O from compute-intensive machine learning workloads.

```
                              +---------------------------------------+
                              |      React 19 + TypeScript Client     |
                              |         "Midnight Studio" Theme       |
                              +-------------------+-------------------+
                                                  |
                                HTTP 206 Partial Content / REST JSON
                                                  v
                              +-------------------+-------------------+
                              |   Node.js Express API (/api/v1)       |
                              |   JWT Auth & Strict Multi-Tenancy     |
                              +---------+-------------------+---------+
                                        |                   |
                         +--------------+                   +-------------+
                         v                                                v
              +--------------------+                           +--------------------+
              |  MongoDB Document  |                           | Redis + BullMQ     |
              |  & Vector Store    |                           | Background Queues  |
              +--------------------+                           +----------+---------+
                                                                          |
                                                      +-------------------+-------------------+
                                                      v                                       v
                                            +--------------------+                 +--------------------+
                                            | Python AI Service  |                 |    Ollama LLM      |
                                            | (FastAPI Microsvc) |                 | (llama3.2 Runner)  |
                                            +----------+---------+                 +--------------------+
                                                       |
                                       +---------------+---------------+
                                       v                               v
                             +--------------------+          +--------------------+
                             |   faster-whisper   |          | sentence-transf.   |
                             | (CTranslate2 int8) |          | (all-MiniLM-L6-v2) |
                             +--------------------+          +--------------------+
```

### High-Level Data Flow

1. **Audio Ingestion & Streaming**: Audio files (WAV, MP3, M4A, WebM) are uploaded through an authenticated multipart form into encrypted storage. An HTTP 206 Partial Content Range streaming engine enables instantaneous playback without pre-loading full multi-gigabyte recordings.
2. **Audio Queue (`audioQueue`)**: BullMQ offloads long-running speech-to-text jobs to Redis. Jobs feature exponential backoff, worker concurrency isolation, and status tracking.
3. **Local Speech-to-Text (`faster-whisper`)**: The FastAPI AI microservice loads a local CTranslate2 Whisper model with PyAV 14+ stream decoding and Silero VAD filtering, generating start/end millisecond timestamps, speaker tags, and confidence scores.
4. **AI Queue (`aiQueue`)**: Upon transcription completion, transcript segments trigger the intelligence pipeline.
5. **Voice Intelligence (`Ollama`)**: Transcripts are passed to local `llama3.2` to generate Markdown executive summaries, structured decision logs with rationale, and actionable tasks with assignees and due dates. A JSON AST repair engine prevents pipeline breakage from output token truncations.
6. **Chunking & Vector Embeddings**: Transcripts are dialogue-chunked and embedded into 384-dimensional dense vectors via `all-MiniLM-L6-v2`. Chunks are stored in MongoDB with indexed cosine distance scores.
7. **Cross-Recording RAG Search**: Users query the workspace using natural language (`/api/v1/knowledge/ask`). The engine retrieves top-$k$ semantic chunks across all recordings, builds a grounded context window, and synthesizes answers with clickable audio timestamp links (`[01:24 - 01:58]`).

---

## Directory Structure

```
VoxMind/
├── .github/
│   └── workflows/
│       └── ci.yml                  # Unified GitHub Actions CI (Frontend, Backend, AI Service)
├── .gitignore                      # Git ignore rules for Python, Node, Audio & Secrets
├── .env.example                    # Global environment configuration template
├── docker-compose.yml              # Production Docker Compose orchestration
├── README.md                       # Master platform documentation
├── ai-service/                     # Python Local AI Microservice (FastAPI)
│   ├── Dockerfile                  # Container definition with ffmpeg, PyTorch & CTranslate2
│   ├── requirements.txt            # Microservice dependencies
│   ├── app/
│   │   ├── main.py                 # FastAPI application routes (/transcribe, /analyze, /rag)
│   │   ├── schemas.py              # Pydantic v2 bidirectional request/response schemas
│   │   └── services/
│   │       ├── transcription_service.py # faster-whisper CTranslate2 worker + PyAV patch
│   │       ├── ollama_service.py        # Ollama LLM client + JSON AST normalizer
│   │       ├── embedding_service.py     # SentenceTransformers all-MiniLM-L6-v2 engine
│   │       └── chunking_service.py      # Dialogue-aware semantic chunker
│   └── tests/
│       └── test_ai_service.py      # Contract & schema integration tests
├── backend/                        # Primary Application Backend (Node.js + Express)
│   ├── Dockerfile                  # Multi-stage production container build
│   ├── package.json                # Express, BullMQ, Mongoose, Vitest dependencies
│   ├── tsconfig.json               # Strict TypeScript configuration
│   └── src/
│       ├── app.ts                  # Express application factory & middleware chain
│       ├── server.ts               # HTTP server entrypoint
│       ├── config/                 # Environment validation & dual-mode host networking
│       ├── database/               # Mongoose schemas & MongoDB connection
│       │   └── models/             # Recording, Summary, TranscriptSegment, Chunk, ApiKey
│       ├── middleware/             # Auth (Bearer + Query token), Multer upload, Pino logger
│       ├── modules/
│       │   ├── auth/               # JWT authentication, registration, profile updates
│       │   ├── recordings/         # Range streaming, upload, metadata, delete
│       │   ├── collections/        # Workspace grouping & collection tagging
│       │   ├── search/             # Semantic vector search & RAG question answering
│       │   ├── api-keys/           # Developer API keys (vm_live_...) with SHA-256 hashing
│       │   ├── usage/              # Token & audio processing usage ledger
│       │   └── diagnostics/        # Live infrastructure probes & system metrics
│       ├── queues/                 # BullMQ queues for audio processing & AI inference
│       └── services/               # AI service client, token management, storage
├── frontend/                       # Responsive React + TypeScript client
│   ├── scripts/smoke-test.cjs      # Browser and real-session smoke checks
│   ├── vite.config.ts              # Vite dev server with API proxy
│   └── src/
│       ├── app/                    # Providers and lazy application routes
│       ├── features/               # Domain pages and feature components
│       │   ├── auth/               # Shared authentication layout and forms
│       │   ├── workspace/          # Overview and fallback pages
│       │   ├── recordings/         # Library, detail, audio player, upload, export
│       │   ├── collections/        # Collection management
│       │   ├── intelligence/       # Ask and semantic search
│       │   ├── integrations/       # API key management and examples
│       │   └── settings/           # Profile, preferences, and diagnostics
│       ├── components/             # Shared UI, layout, and brand visuals
│       ├── contexts/               # Shared context definitions
│       ├── hooks/                  # Reusable UI behavior
│       ├── lib/                    # Typed API client and utilities
│       └── styles/                 # Theme tokens and responsive layouts
└── scripts/                        # Utility & orchestration scripts
    ├── start-docker.ps1            # Windows PowerShell Docker Compose startup
    ├── start-docker.sh             # Linux/macOS Docker Compose startup
    └── verify-services.ps1         # Service connectivity & diagnostic verification
```

---

## Core Capabilities

### 1. Local Speech-to-Text Transcription (`faster-whisper`)
- **CTranslate2 Optimized**: Uses CTranslate2 int8 execution on CPU or FP16 on NVIDIA GPUs for up to 4x speedup over standard Whisper.
- **Native Multi-Lingual Support**: Automatically detects input languages (English, Hindi, Marathi, Spanish, etc.) and preserves native transcription with millisecond-accurate word/segment boundaries.
- **PyAV 14+ Streaming & VAD**: Uses Silero Voice Activity Detection (VAD) to filter out background noise and silence, with automatic fallback handling.

### 2. Voice Intelligence & Structured Extraction (`Ollama`)
- **Executive Summarization**: Automatically synthesizes dialogue into structured Markdown overview sections.
- **Decision Engine**: Identifies agreed architectural choices and meeting consensus, persisting decision context, source timestamps, and rationale.
- **Action Item Tracker**: Normalizes actionable tasks, assignees, deadlines, and completion states into MongoDB.
- **JSON AST Healing**: Employs an automated bracket-balancing and suffix-completion parser that gracefully repairs partial or token-truncated JSON from LLM generation.

### 3. Vector Embeddings & Grounded Cross-Recording RAG
- **Semantic Chunking**: Transcript segments are grouped into contextual conversational chunks without severing dialogue coherence.
- **384-Dimensional Vectors**: Local embeddings generated using `all-MiniLM-L6-v2` (`SentenceTransformers`).
- **Grounded Attribution**: Q&A queries retrieve relevant chunks across the user's workspace, prompting the local LLM with strict instructions to answer only from transcript evidence and include timestamp citations.

### 4. HTML5 Range Audio Streaming Engine
- Implements RFC 7233 HTTP 206 Partial Content range requests.
- Enables instant audio seeking and scrubbing on files of any length without downloading the entire media file.
- Supports Query Token authentication (`?token=...`) allowing standard HTML5 `<audio>` tags to securely stream authenticated media.

### 5. "Listening Room" Design System
- A warm, editorial workspace with a custom audio waveform signature, shared typography, and accessible navigation.
- White (`#FFFFFF`), graphite (`#191B23`), and blue (`#3159DF`) define the light theme; a coordinated dark theme and live system preference are also available.
- **Responsive layouts**: Browser smoke checks cover widths of 320, 390, 768, 1024, 1440, and 1920 pixels, including phone navigation, bounded dialogs, authentication forms, and the recording detail screen.

### 6. Enterprise Security & Developer Platform
- **Tenant Isolation**: Every recording, transcript segment, chunk, summary, and vector embedding is strictly scoped to `workspaceId`.
- **Developer API Keys**: Generate scoped API keys (`vm_live_...`) with one-way SHA-256 hashing and instantaneous revocation.
- **Granular Usage Ledger**: Tracks audio processing seconds, LLM prompt/completion tokens, and embedding computations per workspace.

---

## Interviewer / Engineering Highlights

| Architectural Decision | Implementation Rationale |
| :--- | :--- |
| **Why Polyglot Microservices?** | Node.js Express excels at async I/O, multipart file uploads, WebSockets, and HTTP Range partial-content streaming. Python (FastAPI) isolates PyTorch, CTranslate2, and SentenceTransformers, preventing Python's GIL from blocking API endpoints. |
| **Why BullMQ over In-Memory Queues?** | BullMQ provides Redis-backed persistent queues, exponential backoff retries, dead-letter job archiving, worker concurrency isolation, and horizontal worker scalability across separate nodes. |
| **Why Local Ollama & faster-whisper?** | Guarantees 100% data sovereignty for enterprise compliance (GDPR, HIPAA, SOC 2). Transcription and LLM intelligence run completely air-gapped without recurring cloud API fees or data leakage risks. |
| **HTTP 206 Range Streaming vs Static Files** | Directly serving multi-hundred megabyte recordings causes browser memory exhaustion and prevents instant seeking. HTTP 206 Range streaming sends only the requested byte windows on-demand. |
| **JSON AST Recovery Parser** | Open-source LLMs can occasionally truncate trailing JSON brackets on long responses. Our AST healing algorithm attempts incremental balance suffixes (`}`, `]}`, etc.) before raising errors, eliminating failed summary runs. |

---

## Quickstart Guide

### Option A: Complete Docker Compose Orchestration (Recommended)

Ensure Docker Desktop or Docker Engine is running on your machine.

```bash
# 1. Clone repository
git clone https://github.com/voxmind/voxmind.git
cd VoxMind

# 2. Configure environment
cp .env.example .env

# 3. Pull Ollama model on host (if using host Ollama instance)
ollama pull llama3.2

# 4. Start all services via script
# Linux / macOS:
./scripts/start-docker.sh --build

# Windows (PowerShell):
.\scripts\start-docker.ps1 -Build
```

Once initialized:
- **Web Client:** `http://localhost:5173`
- **REST API:** `http://localhost:5000/api/v1`
- **Health Check:** `http://localhost:5000/api/v1/health`
- **FastAPI Docs:** `http://localhost:8001/docs`

---

### Option B: Local Native Development

#### 1. Prerequisites
- **Node.js** >= 20.x
- **Python** >= 3.10
- **MongoDB** running on `localhost:27017`
- **Redis** running on `localhost:6379`
- **Ollama** running on `localhost:11434` (`ollama serve`, model: `llama3.2`)

#### 2. Start Python AI Microservice
```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
$env:PYTHONPATH="."
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
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

#### 5. Create your workspace
Open the registration screen to create a local account, then sign in. The frontend no longer silently authenticates with demo credentials.

---

## Automated Test Suites & CI/CD

VoxMind maintains passing test suites across all layers of the stack:

```powershell
# 1. Frontend: Linting & TypeScript Build
npm run lint --prefix frontend
npm run build --prefix frontend

# 2. Backend: Vitest Integration Test Suite
npm run test --prefix backend

# 3. AI Microservice: Pytest Contract & Schema Suite
$env:PYTHONPATH="ai-service"; pytest ai-service/tests/test_ai_service.py -v
```

### GitHub Actions CI
All commits and pull requests are validated via [`.github/workflows/ci.yml`](.github/workflows/ci.yml):
- **Frontend CI:** Clean install with lockfile, `oxlint`, and `tsc -b && vite build`.
- **Backend CI:** TypeScript compilation and in-memory Vitest integration tests.
- **AI Service CI:** Clean install and Pytest contract verification.

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
| **Phase 10**| Midnight Studio Redesign, HTTP 206 Audio Streaming, & Schema Resilience | Completed |

---

## License

This project is licensed under the [MIT License](LICENSE).
