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

### 2. Backend Development

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
python wsgi.py
```

The REST API will be available at `http://localhost:5000/api/v1`.

### 3. Running Automated Tests

```powershell
# Frontend typecheck & build
npm run build --prefix frontend

# Frontend lint check
npm run lint --prefix frontend

# Backend test suite
cd backend
.\.venv\Scripts\pytest
```

---

## Implementation Roadmap

| Phase | Milestone | Status |
|---|---|---|
| **Phase 1** | **Architecture, Project Scaffolding & Obsidian Design System** | **Completed** |
| Phase 2 | Database Models, Alembic Migrations & JWT Tenant Security | Next |
| Phase 3 | Audio File Ingestion, Storage & Celery Transcription Pipeline | Pending |
| Phase 4 | Recording Workspace, Interactive Player & Ollama Insights | Pending |
| Phase 5 | Vector Chunking, Semantic Search & "Ask VoxMind" RAG | Pending |
| Phase 6 | Collections, Developer API Keys & Live Diagnostics Hub | Pending |
| Phase 7 | End-to-End Test Suite, Docker Compose & Final Hardening | Pending |
