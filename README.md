<div align="center">

# 🎙️ MeetingBrief

**Turn meeting recordings into searchable transcripts, summaries, decisions, action items, and conversational intelligence.**

An enterprise-grade, privacy-first meeting intelligence SaaS platform inspired by the craft, clarity, and refinement of Attio.

[![Node.js](https://img.shields.io/badge/Node.js-22.12+-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=flat)](#license)

</div>

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
  - [Prerequisites](#prerequisites)
  - [One-Command Local Stack (Recommended)](#one-command-local-stack-recommended)
  - [Standalone Development Mode](#standalone-development-mode)
- [Integrations & OAuth Setup](#-integrations--oauth-setup)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Security & Privacy](#-security--privacy)
- [Author & Maintainer](#-author--maintainer)

---

## 💡 Overview

**MeetingBrief** is an end-to-end meeting intelligence platform built for modern product and engineering teams. It processes recorded audio and video to extract actionable takeaways without requiring hours of manual review.

The frontend is crafted around an **Attio-inspired design system**, prioritizing calm neutral palettes, crisp typography, subtle borders, tactile interactions, and centralized task management.

---

## ✨ Key Features

| Capability | Description |
|---|---|
| **Attio-Inspired Workspace** | High-density, calm workspace featuring metrics strips, live background progress cards, and responsive light/dark themes. |
| **Searchable Transcripts** | Asynchronous speech-to-text with speaker labels, precise millisecond timestamps, and instant audio playback jumps. |
| **Structured Intelligence** | Automatically extracts executive summaries, key discussion points, explicit decisions, and post-meeting action items. |
| **Centralized Action Items Hub** | Dedicated task hub at `/app/actions` across all meetings with search, Open/Completed filters, and optimistic status updates. |
| **Conversational AI (Ask Brief)** | Ask natural-language questions across recordings with citation links back to timestamped transcript moments. |
| **Cloud Meeting Imports** | Seamlessly import completed recordings from **Zoom**, **Google Meet / Google Drive**, and **Cisco Webex**. |
| **Exportable Reports** | Generate printable PDF briefs and formatted Markdown summaries including full transcripts. |
| **Developer API & OpenAPI** | Scoped, expiring REST API keys with interactive documentation at `/app/docs` and OpenAPI 3.1 contracts. |

---

## 🏗️ System Architecture

```
                       ┌────────────────────────────────────────┐
                       │        Browser / API Consumers         │
                       └───────────────────┬────────────────────┘
                                           │
                                           ▼
                       ┌────────────────────────────────────────┐
                       │          Nginx Reverse Proxy           │
                       │           (Port 5173 / 80)             │
                       └───────────┬────────────────┬───────────┘
                                   │                │
            Static SPA Assets ┌────▼───┐        ┌───▼────┐ /api/v1/
                              │ React  │        │Express │
                              │ Client │        │  API   │ (Port 5000)
                              └────────┘        └───┬────┘
                                                    │
                             ┌──────────────────────┼──────────────────────┐
                             │                      │                      │
                             ▼                      ▼                      ▼
                     ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
                     │   MongoDB    │       │ Redis/BullMQ │       │ Local File / │
                     │  (Database)  │       │(Task Queues) │       │ Audio Storage│
                     └──────────────┘       └───────┬──────┘       └──────────────┘
                                                    │
                                                    ▼
                                            ┌──────────────┐
                                            │FastAPI Worker│
                                            │(Port 8000)   │
                                            └───────┬──────┘
                                                    │
                               ┌────────────────────┴───────────────────┐
                               ▼                                        ▼
                      ┌──────────────────┐                     ┌──────────────────┐
                      │ Faster-Whisper   │                     │  Local LLM /     │
                      │ (Transcription)  │                     │ Ollama / Gemma   │
                      └──────────────────┘                     └──────────────────┘
```

### Repository Structure

```
├── frontend/             # React 19, Vite, Tailwind CSS, TanStack Query, Motion
│   ├── src/app/          # Application router, layout wrappers, and providers
│   ├── src/components/   # Design system atoms, navigation shell, logo, headers
│   ├── src/features/     # Domain modules: auth, workspace, recordings, actions, docs
│   └── src/styles/       # Centralized Attio design tokens (tokens.css)
├── backend/              # Node.js 22, Express, TypeScript, Mongoose, BullMQ
│   ├── src/modules/      # Auth, recordings, action-items, collections, search, API keys
│   ├── src/queues/       # Asynchronous audio processing & inference job queues
│   └── src/services/     # AI service client, storage adapters, meeting OAuth providers
├── ai-service/           # FastAPI, Python 3.11+, Faster-Whisper, PyTorch, Ollama
│   └── app/              # Private inference endpoints, audio chunking, embeddings
├── scripts/              # Local Docker orchestrator, seeding, smoke test runners
└── docker-compose.yml    # Production-ready multi-container local stack
```

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, TanStack Query v5, Radix UI primitives, Motion (`motion/react`), Lucide Icons.
- **Backend**: Node.js 22, Express, TypeScript, MongoDB (Mongoose), Redis (BullMQ queues), Pino logger.
- **AI & Audio Engine**: Python 3.11, FastAPI, Faster-Whisper, PyTorch, Hugging Face Transformers, Ollama.
- **Infrastructure**: Docker Compose, Nginx, MinIO/Local Storage.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js**: `v22.12.0` or higher
- **Docker Desktop** (or Docker Engine with Compose v2) running
- **Resources**: At least 8 GB RAM and 15 GB free disk space (for local Whisper weights & LLM models)

### One-Command Local Stack (Recommended)

From the repository root:

```bash
# 1. Clone the repository
git clone https://github.com/swayam-8/VoxMind.git meetingbrief
cd meetingbrief

# 2. Launch the complete local stack
npm start
```

Once ready, open **[http://localhost:5173](http://localhost:5173)** in your browser.

- Sign up for a new workspace or log in with your credentials.
- The startup script automatically provisions `.env`, MongoDB, Redis, the AI service, backend, and the frontend container.
- Initial model weights download seamlessly in the background.

#### Management Commands

```bash
npm stop        # Stop all containers while preserving database and recordings
npm run logs    # Stream live logs from all services
npm start       # Resume services or rebuild after pulling updates
```

---

### Standalone Development Mode

To run individual services outside Docker for live development:

#### 1. Frontend Development Server
```bash
cd frontend
npm install
npm run dev
```
Accessible at: **http://localhost:5173**

#### 2. Backend API Server
```bash
cd backend
npm install
npm run dev
```
API running on: **http://localhost:5000**

#### 3. AI Inference Service
```bash
cd ai-service
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 🔑 Integrations & OAuth Setup

Google Sign-In and meeting provider imports are enabled by configuring environment variables in the root `.env`:

```dotenv
# Google Authentication (Workspace Sign-In)
GOOGLE_AUTH_CLIENT_ID=your-google-client-id
GOOGLE_AUTH_CLIENT_SECRET=your-google-client-secret
AUTH_API_BASE_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5173

# Meeting Providers (Cloud Recording Imports)
ZOOM_CLIENT_ID=your-zoom-client-id
ZOOM_CLIENT_SECRET=your-zoom-client-secret

GOOGLE_CLIENT_ID=your-google-drive-client-id
GOOGLE_CLIENT_SECRET=your-google-drive-client-secret

WEBEX_CLIENT_ID=your-webex-client-id
WEBEX_CLIENT_SECRET=your-webex-client-secret
```

*For complete setup instructions and redirect URL requirements, view the internal guide at `/app/docs` or read [`docs/meeting-integrations.md`](docs/meeting-integrations.md).*

---

## 🧪 Testing & Quality Assurance

MeetingBrief maintains an automated test suite across units, layout responsiveness, and full end-to-end user journeys:

```bash
# Backend unit & integration test suite (Vitest)
npm test --prefix backend

# Frontend compilation & type verification
npm run build --prefix frontend

# End-to-end responsiveness & layout suite (7 viewports, light & dark modes)
npm run test:layout --prefix frontend

# Insights, polling, and action-items regression suite
npm run test:insights --prefix frontend

# Customer journey, auth, and documentation smoke test
npm run test:product --prefix frontend

# Security audit on dependencies
npm audit --prefix backend
npm audit --prefix frontend
```

---

## 🔒 Security & Privacy

- **Password Security**: Salted bcrypt password hashing with configurable cost factors.
- **JWT Hardening**: Cryptographically signed tokens with strict issuer, audience, and algorithm enforcement.
- **Scoped API Keys**: SHA-256 hashed keys with selectable read-only or read/write scopes and auto-expiry.
- **Audio Access Tickets**: Audio streaming uses short-lived, single-recording tickets instead of long-lived auth credentials.
- **Content Security**: Defensive CSP, strictly typed inputs, sanitized search queries, and rate-limiting backed by Redis.

*For detailed security controls and deployment instructions, refer to [`docs/security-and-deployment.md`](docs/security-and-deployment.md).*

---

## 👤 Author & Maintainer

MeetingBrief is created and actively maintained by:

**Swayam Sonawane**
- GitHub: [@swayam-8](https://github.com/swayam-8)
- Repository: [swayam-8/VoxMind](https://github.com/swayam-8/VoxMind)

---

## 📄 License

This software and its source code are proprietary. All rights reserved.
