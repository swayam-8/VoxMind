# VoxMind — Local-First AI Voice Intelligence Platform

VoxMind is an enterprise-grade, local-first voice intelligence platform that transforms multi-speaker audio recordings into verified, actionable, and searchable intelligence. 

It executes transcription, executive summarization, decision extraction, and action item detection using local AI engines (`faster-whisper` and `Ollama`), accompanied by cross-recording semantic vector search (RAG) with precise, clickable audio timestamp citations.

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
                      |      Flask REST API (/api/v1)         |
                      |   JWT Auth & Strict Tenant Scoping    |
                      +---------+-------------------+---------+
                                |                   |
                 +--------------+                   +-------------+
                 v                                                v
      +--------------------+                           +--------------------+
      | PostgreSQL (Models)|                           | Redis + Celery     |
      |   Alembic Migr.    |                           | Background Worker  |
      +--------------------+                           +----------+---------+
                                                                  |
                                              +-------------------+-------------------+
                                              v                                       v
                                    +--------------------+                 +--------------------+
                                    |   faster-whisper   |                 |    Ollama LLM      |
                                    | (Speech-to-Text)   |                 | (Insights & RAG)   |
                                    +--------------------+                 +--------------------+
```

---

## Directory Structure

```
VoxMind/
├── .gitignore                      # Git ignore rules for Python, Node, Audio & Env
├── docker-compose.yml              # Production-ready container orchestration
├── README.md                       # Master platform documentation
├── backend/
│   ├── .env.example                # Sample backend environment configuration
│   ├── Dockerfile                  # Container definition for Flask API & Celery
│   ├── pyproject.toml              # Pytest, Black, and Mypy configuration
│   ├── requirements.txt            # Production Python dependencies
│   ├── requirements-dev.txt        # Development and testing dependencies
│   ├── wsgi.py                     # Application entry point
│   ├── app/
│   │   ├── __init__.py             # Flask application factory (create_app)
│   │   ├── config.py               # Development, Testing, and Production configs
│   │   ├── extensions.py           # SQLAlchemy, Migrate, and CORS instances
│   │   ├── api/
│   │   │   ├── __init__.py         # API Blueprint registration
│   │   │   └── v1/
│   │   │       ├── __init__.py     # /api/v1 Blueprint
│   │   │       ├── health.py       # Live diagnostic & liveness probes
│   │   │       └── errors.py       # Centralized JSON error handling
│   │   ├── models/                 # SQLAlchemy ORM models
│   │   │   ├── __init__.py
│   │   │   └── base.py             # UUID primary key and timestamp base model
│   │   ├── schemas/                # Input validation and serialization schemas
│   │   │   ├── __init__.py
│   │   │   └── common.py           # Pagination parameters and query filters
│   │   ├── services/               # Core business logic layer
│   │   │   ├── __init__.py
│   │   │   └── health_service.py   # Authentic infrastructure connectivity checks
│   │   └── jobs/                   # Background asynchronous task workers
│   │       ├── __init__.py
│   │       └── celery_app.py       # Celery worker factory
│   └── tests/                      # Automated test suite
│       ├── __init__.py
│       ├── conftest.py             # Pytest fixtures and test client configuration
│       └── test_health.py          # Liveness and envelope validation tests
└── frontend/
    ├── .env.example                # Sample frontend environment configuration
    ├── Dockerfile                  # Production Nginx container build
    ├── nginx.conf                  # Nginx reverse proxy configuration
    ├── package.json                # Dependencies and npm scripts
    ├── tsconfig.json               # TypeScript project references
    ├── tsconfig.app.json           # Strict TypeScript configuration
    ├── vite.config.ts              # Vite configuration with @ path alias & proxy
    └── src/
        ├── index.css               # Obsidian AI CSS tokens (dark/light themes)
        ├── App.tsx                 # Root application setup with React Query & Routing
        ├── main.tsx                # React DOM root mounting
        ├── types/
        │   └── index.ts            # Domain entity types (Recording, User, etc.)
        ├── lib/
        │   ├── utils.ts            # Class merging utility (clsx + tailwind-merge)
        │   └── api-client.ts       # Typed Fetch client with JWT and envelope handling
        ├── contexts/
        │   └── theme-context.tsx   # Dark/Light theme provider with localStorage
        ├── hooks/
        │   └── use-toast.ts        # Toast notifications dispatcher
        ├── components/
        │   ├── ui/                 # Accessible Obsidian component primitives
        │   │   ├── button.tsx      # Button with loading spinner & variants
        │   │   ├── input.tsx       # Text input with helper text & error states
        │   │   ├── select.tsx      # Accessible Radix select dropdown
        │   │   ├── dialog.tsx      # Accessible Radix modal dialog
        │   │   ├── tooltip.tsx     # Radix hover tooltip
        │   │   ├── badge.tsx       # Semantic status badges
        │   │   ├── skeleton.tsx    # Smooth pulse loading placeholder
        │   │   ├── tabs.tsx        # Radix tabbed navigation
        │   │   ├── dropdown-menu.tsx# Radix context & dropdown menus
        │   │   └── toast.tsx       # Floating toast notifications host
        │   ├── layout/
        │   │   ├── app-shell.tsx   # Responsive shell with drawer & sidebar
        │   │   ├── sidebar.tsx     # Navigation sidebar with workspace links
        │   │   ├── header.tsx      # Sticky header with breadcrumbs & engine status
        │   │   └── theme-toggle.tsx# Dropdown menu to switch Dark/Light/System theme
        │   └── showcase/
        │       └── component-showcase.tsx # Live design system validator
        └── routes/
            ├── index.tsx           # React Router route registry
            ├── overview.tsx        # Overview dashboard landing
            ├── showcase.tsx        # Design system verification screen
            ├── recordings.tsx      # Recordings library (Phase 3/4)
            ├── ask.tsx             # Ask VoxMind RAG view (Phase 5)
            ├── collections.tsx     # Collections management (Phase 6)
            ├── integrations.tsx    # Developer API keys (Phase 6)
            ├── settings.tsx        # System preferences & AI settings (Phase 6)
            └── not-found.tsx       # 404 handler
```

---

## Obsidian AI Design System

The interface uses the **Obsidian AI** design system:
- **Canvas Foundation**: `#0D0E11` (dark graphite)
- **Elevated Surfaces**:
  - `surface-1`: `#14161C` (cards, sidebar, modals)
  - `surface-2`: `#1C1F27` (nested elements, inputs, selects)
  - `surface-3`: `#252A36` (hover highlights, active tab indicators)
- **Restrained Violet Accent**: `#8B5CF6` / `#7C3AED` with subtle `12%` alpha glow (`rgba(139, 92, 246, 0.12)`)
- **Semantic Colors**: Emerald for success (`#10B981`), Amber for warning (`#F59E0B`), Rose for errors (`#EF4444`).
- **Complete Light Theme**: High-contrast porcelain base (`#F8FAFC`), crisp white cards (`#FFFFFF`), and refined slate borders (`#E2E8F0`).

---

## Quickstart Guide

### 1. Frontend Development

```powershell
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.  
Navigate to `http://localhost:5173/showcase` to interact with the **Obsidian AI Component Showcase**.

### 2. Backend Development & Worker Execution

```powershell
# 1. Start Redis (via Docker or local service)
docker run -d --name voxmind-redis -p 6379:6379 redis:7-alpine

# 2. Start local Ollama & Pull the model (Phase 5)
# Ensure Ollama is running at http://localhost:11434
ollama pull llama3.2

# 3. Run Database Migrations / Seed data
cd backend
.\.venv\Scripts\flask db upgrade
# (Optional) seed demo data:
.\.venv\Scripts\python seed.py

# 4. Start Flask REST API Server
.\.venv\Scripts\python wsgi.py

# 5. Start Celery Background Worker (separate terminal)
# Handles transcription (faster-whisper) + AI intelligence analysis (Ollama)
# On Windows, use threads pool:
.\.venv\Scripts\celery -A celery_worker.celery worker --loglevel=info --pool=threads --concurrency=2
# On Linux / macOS / Docker:
celery -A celery_worker.celery worker --loglevel=info --concurrency=2 -Ofair
```

The REST API will be available at `http://localhost:5000/api/v1`.
Interactive Swagger UI documentation is available at `http://localhost:5000/api/v1/docs`.

### 3. Running Automated Tests

```powershell
# Frontend typecheck & production build
npm run build --prefix frontend

# Frontend lint check
npm run lint --prefix frontend

# Backend test suite (50 Pytest tests covering health, uploads, faster-whisper, Ollama insights, pgvector semantic retrieval, and Phase 7 workspace features)
$env:PYTHONPATH="backend"; .\backend\.venv\Scripts\pytest backend\tests -v

# Backend code hygiene (Flake8 linter)
.\backend\.venv\Scripts\flake8 --config backend/.flake8 backend/app backend/tests
```

### 4. Running the Entire Stack with Docker Compose

```powershell
# Spin up PostgreSQL (pgvector), Redis, Flask REST API, Celery Worker, and Frontend
docker compose up -d --build

# View worker logs (transcription, Ollama, & vector indexing pipeline)
docker compose logs -f celery_worker
```

---

## Implementation Roadmap

| Phase | Milestone | Status |
|---|---|---|
| **Phase 1** | **Architecture, Project Scaffolding & Obsidian Design System** | **Completed** |
| **Phase 2** | **Application Shell, Premium Routes & Interactive Audio Player** | **Completed** |
| **Phase 3** | **Flask REST API, SQLAlchemy Models & Alembic Migrations** | **Completed** |
| **Phase 4** | **Celery Background Queue + Local faster-whisper Transcription** | **Completed** |
| **Phase 5** | **Ollama Local LLM Summarization, Action Items, Decisions & Grounded Q&A** | **Completed** |
| **Phase 6** | **Vector Chunking, pgvector Semantic Search & Cross-Recording RAG Engine** | **Completed** |
| **Phase 7** | **Production Hardening, Collections, Developer API Keys, Usage Ledger, Diagnostics Hub & pgvector HNSW** | **Completed** |

---

## Phase 7: Production Hardening, Scalability & Advanced Workspace Features

### 1. Workspace Collections
- **Full CRUD REST API** (`/api/v1/collections`): create, inspect, update, and delete collections scoped strictly to the calling workspace.
- **Recording Assignment & Filtering**: assign recordings to collections, unassign on collection deletion without deleting audio assets, and filter recordings by collection in the library.
- **Reactive UI**: interactive management in `/app/collections` with color tags, recording counts, and navigation into filtered recordings.

### 2. Developer API Keys & Dual-Mode Authentication
- **Programmatic Secret Keys**: cryptographically random keys prefixed with `vm_live_` (e.g. `vm_live_a1b2c3d4...`).
- **Cryptographic Storage**: only the SHA-256 hash is persisted in the database; raw secret keys are displayed only once upon generation.
- **Dual-Mode Authentication Middleware (`@require_auth`)**:
  - Accepts `Authorization: Bearer vm_live_...` or `X-API-Key: vm_live_...`
  - Accepts `Authorization: Bearer <jwt_token>`
  - Automatically updates `last_used_at` timestamp on active API keys.
  - Safe revocation preventing compromised or legacy keys from accessing tenant data.

### 3. AI Token & Resource Usage Accounting
- **Persistent Usage Ledger (`api_usage_records`)**: logs every programmatic API request and background AI task with duration, token counts, and model metadata.
- **Speech-to-Text Accounting**: tracks audio seconds and converted hours processed by `faster-whisper`.
- **LLM Token Accounting**: calculates and records prompt tokens, completion tokens, and total tokens consumed by `Ollama` for summaries and grounded question answering.
- **Embedding Tracking**: counts chunk volume and tokens vectorized for semantic search.
- **Aggregated Endpoint (`GET /api/v1/usage`)**: returns workspace totals, monthly quotas, breakdown by resource type (`transcription`, `summary`, `qa`, `rag`, `embedding`), model usage, and recent history.

### 4. Real-Time Multi-Service Diagnostics Hub
- **Deep Infrastructure Evaluation (`GET /api/v1/diagnostics`)**:
  - **Database**: PostgreSQL / SQLite connectivity and query latency (ms).
  - **Vector Storage**: verifies `pgvector` extension and `HNSW` vector index status.
  - **Redis & Celery**: evaluates broker responsiveness, active worker count, and registered worker names.
  - **faster-whisper**: inspects speech-to-text library, ffmpeg binary, and active compute device (`cpu`/`cuda`).
  - **Ollama**: connects to local inference engine, queries available downloaded models, and verifies configured model readiness.
  - **Sentence-Transformers**: validates local embedding model pipeline and vector dimensions (384-dim).
  - **Storage**: inspects volume directory path, total capacity, and available free gigabytes.
- **Interactive UI**: live diagnostics card grid on `/app/settings` with a real-time "Refresh Diagnostics" trigger.

### 5. PostgreSQL pgvector Scalability & HNSW Indexing

VoxMind utilizes PostgreSQL `pgvector` with **HNSW (Hierarchical Navigable Small World)** indexing on `transcript_chunks.embedding` using cosine distance (`vector_cosine_ops`):

```sql
CREATE INDEX IF NOT EXISTS ix_transcript_chunks_embedding_hnsw 
ON transcript_chunks 
USING hnsw (embedding vector_cosine_ops);
```

#### Why HNSW over IVFFlat or Exact Sequential Scan?

| Dimension | Exact Scan (`Flat`) | IVFFlat | HNSW (`vector_cosine_ops`) |
|---|---|---|---|
| **Recall / Accuracy** | 100% | 85% – 95% (depends on `probes`) | **98% – 99.5%** |
| **Query Latency** | Degrades linearly $O(N)$ | Fast $O(\sqrt{N})$ | **Sub-millisecond $O(\log N)$** |
| **Training Requirement** | None | Requires pre-training (minimum vectors) | **None (index immediately active)** |
| **Incremental Updates** | Instant | Degrades without periodic `REINDEX` | **Maintains graph quality gracefully** |
| **Build / Memory Cost** | Zero build time | Low memory | Moderate build memory (justified by query speed) |

For VoxMind's workspace workloads—where recordings and dialogue chunks are ingested continuously over time—HNSW provides instant recall, zero training friction, and sub-millisecond retrieval without performance degradation.
