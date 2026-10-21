import { Link } from "react-router-dom"
import {
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Radio,
  FileCheck2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function OverviewPage() {
  return (
    <div className="space-y-8">
      {/* Welcome / Phase 1 Status Banner */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface-1 p-6 sm:p-8">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="violet" className="font-mono text-xs">
              Phase 1 Completed
            </Badge>
            <span className="text-xs text-text-muted">
              Architecture & Obsidian Design Foundation
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
            VoxMind AI Voice Intelligence
          </h2>

          <p className="text-sm text-text-secondary leading-relaxed">
            The foundation for local-first audio transcription, executive synthesis, structured decisions, and cross-recording semantic retrieval is now operational. Explore the interactive design system showcase to inspect component states, tokens, and responsive layout behavior.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <Link to="/showcase">
              <Button variant="default" size="md">
                <Layers className="w-4 h-4 mr-1.5" />
                Explore Component Showcase
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
            <a
              href="#architecture-pillars"
              className="inline-flex"
            >
              <Button variant="secondary" size="md">
                View Architectural Pillars
              </Button>
            </a>
          </div>
        </div>

        {/* Ambient subtle decorative radial glow */}
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
      </div>

      {/* Architectural Pillars Grid */}
      <div id="architecture-pillars" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            Core Architectural Guarantees
          </h3>
          <span className="text-xs text-text-muted">Obsidian AI Foundation</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-lg border border-border bg-surface-1 p-5 space-y-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-subtle text-accent border border-accent/20">
              <Cpu className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-semibold text-text-primary">Local-First AI</h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              Powered by local faster-whisper and Ollama inference. Processing remains entirely on authorized infrastructure.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface-1 p-5 space-y-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-subtle text-accent border border-accent/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-semibold text-text-primary">Tenant Isolation</h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              Strict user-scoped database boundaries with JWT authentication and Argon2/Bcrypt password hashing.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface-1 p-5 space-y-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-subtle text-accent border border-accent/20">
              <Radio className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-semibold text-text-primary">No Fabricated States</h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              UI states reflect actual underlying worker and network states. Real error diagnostics rather than simulated progress.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface-1 p-5 space-y-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-subtle text-accent border border-accent/20">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-semibold text-text-primary">Evidence Citations</h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              Summaries, decisions, and RAG answers link directly to precise transcript timestamps with instant audio playback seeking.
            </p>
          </div>
        </div>
      </div>

      {/* Roadmap overview card */}
      <div className="rounded-lg border border-border bg-surface-1 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <h4 className="text-sm font-semibold text-text-primary">Implementation Progress</h4>
          </div>
          <span className="text-xs font-mono text-accent">Phase 1 of 7</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-md bg-surface-2 border border-accent/30">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-accent">Phase 1: Architecture & Design</span>
              <Badge variant="violet" className="text-[10px]">Active</Badge>
            </div>
            <p className="text-text-secondary">Scaffolding, tokens, accessible primitives, API boundaries.</p>
          </div>

          <div className="p-3 rounded-md bg-surface-2 border border-border opacity-70">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-text-primary">Phase 2: Auth & Database</span>
              <span className="text-text-muted">Next</span>
            </div>
            <p className="text-text-secondary">Alembic migrations, PostgreSQL models, JWT auth flow.</p>
          </div>

          <div className="p-3 rounded-md bg-surface-2 border border-border opacity-70">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-text-primary">Phase 3: Ingestion & Whisper</span>
              <span className="text-text-muted">Planned</span>
            </div>
            <p className="text-text-secondary">Audio uploads, Celery pipeline, faster-whisper STT.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
