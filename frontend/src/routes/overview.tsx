import { useState } from "react"
import { Link } from "react-router-dom"
import {
  UploadCloud,
  Mic,
  Clock,
  Sparkles,
  ArrowRight,
  HardDrive,
  CheckCircle2,
  FileCheck2,
  Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { UploadDialog } from "@/components/audio/upload-dialog"
import { DEMO_RECORDINGS, type DemoRecording } from "@/lib/demo-data"

function formatSeconds(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}m ${s > 0 ? `${s}s` : ""}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function OverviewPage() {
  const [recordings, setRecordings] = useState<DemoRecording[]>(DEMO_RECORDINGS)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [showEmptyState, setShowEmptyState] = useState(false)

  const handleUploadSuccess = (newRec: DemoRecording) => {
    setRecordings((prev) => [newRec, ...prev])
  }

  // Calculate actual library summary metrics
  const totalDuration = recordings.reduce((acc, r) => acc + r.durationSeconds, 0)
  const totalHours = (totalDuration / 3600).toFixed(1)
  const totalSizeMB = (
    recordings.reduce((acc, r) => acc + r.fileSizeBytes, 0) /
    (1024 * 1024)
  ).toFixed(1)
  const readyCount = recordings.filter((r) => r.status === "ready").length
  const pendingCount = recordings.filter(
    (r) => r.status === "transcribing" || r.status === "queued"
  ).length

  return (
    <div className="space-y-8">
      {/* Page Heading & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              Workspace Overview
            </h1>
            <Badge variant="violet" className="text-[10px] font-mono">
              Demo Fixtures
            </Badge>
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            Local voice intelligence pipeline status, recent activity, and library metrics.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEmptyState(!showEmptyState)}
            className="text-xs"
          >
            <Eye className="w-3.5 h-3.5 mr-1 text-text-muted" />
            {showEmptyState ? "Show Populated View" : "Simulate First-Use"}
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => setUploadOpen(true)}
            className="shadow-sm"
          >
            <UploadCloud className="w-4 h-4 mr-1.5" />
            Upload Audio
          </Button>
        </div>
      </div>

      {showEmptyState ? (
        /* Empty Library First-Use State */
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border bg-surface-1/60">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-subtle text-accent border border-accent/20 mb-4">
            <Mic className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-bold text-text-primary">
            No audio recordings in your workspace
          </h3>
          <p className="max-w-md mt-1.5 text-sm text-text-secondary">
            Upload your first meeting recording, user interview, or voice memo to initiate local speech-to-text and AI synthesis.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="default" onClick={() => setUploadOpen(true)}>
              <UploadCloud className="w-4 h-4 mr-1.5" />
              Upload Audio File
            </Button>
            <Button variant="secondary" onClick={() => setShowEmptyState(false)}>
              Load Sample Recordings
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Prominent Ask VoxMind Entry Point Card */}
          <div className="relative overflow-hidden rounded-xl border border-accent/30 bg-surface-1 p-5 sm:p-6 shadow-xs">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="max-w-2xl space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent-subtle text-accent border border-accent/30">
                    <Sparkles className="h-3 w-3" />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                    Cross-Library Voice Intelligence
                  </span>
                </div>
                <h3 className="text-lg font-bold text-text-primary tracking-tight">
                  Ask VoxMind across your authorized recordings
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Query architectural decisions, action items, and technical benchmarks across all recordings with verified audio timestamp links.
                </p>
              </div>

              <Link to="/app/ask" className="shrink-0">
                <Button variant="default" size="md">
                  Open Query Workspace <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
            </div>
            {/* Subtle violet background glow */}
            <div className="absolute right-0 top-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
          </div>

          {/* Library Summary Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border bg-surface-1 p-4.5 space-y-2">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-xs font-medium">Recordings</span>
                <Mic className="h-4 w-4 text-accent" />
              </div>
              <div className="text-2xl font-bold text-text-primary tracking-tight">
                {recordings.length}
              </div>
              <div className="text-[11px] text-text-secondary">
                {readyCount} indexed, {pendingCount} in queue
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface-1 p-4.5 space-y-2">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-xs font-medium">Audio Analyzed</span>
                <Clock className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-text-primary tracking-tight">
                {totalHours} hrs
              </div>
              <div className="text-[11px] text-text-secondary">
                {formatSeconds(totalDuration)} total audio
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface-1 p-4.5 space-y-2">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-xs font-medium">Local Storage</span>
                <HardDrive className="h-4 w-4 text-text-secondary" />
              </div>
              <div className="text-2xl font-bold text-text-primary tracking-tight">
                {totalSizeMB} MB
              </div>
              <div className="text-[11px] text-text-secondary">
                Self-hosted media store
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface-1 p-4.5 space-y-2">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-xs font-medium">Extracted Actions</span>
                <FileCheck2 className="h-4 w-4 text-accent" />
              </div>
              <div className="text-2xl font-bold text-text-primary tracking-tight">
                3 Pending
              </div>
              <div className="text-[11px] text-text-secondary">
                Across recent engineering syncs
              </div>
            </div>
          </div>

          {/* Activity & Recent Recordings Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Recordings List (2 cols) */}
            <div className="lg:col-span-2 rounded-xl border border-border bg-surface-1 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Mic className="h-4 w-4 text-accent" />
                  Recent Recordings
                </h3>
                <Link
                  to="/app/recordings"
                  className="text-xs text-accent hover:underline flex items-center gap-1 font-medium"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="space-y-2">
                {recordings.slice(0, 4).map((rec) => (
                  <Link
                    key={rec.id}
                    to={`/app/recordings/${rec.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-surface-2/50 border border-border hover:border-accent/40 hover:bg-surface-2 transition-all group"
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-surface-1 border border-border flex items-center justify-center text-text-secondary group-hover:text-accent transition-colors shrink-0">
                        <Mic className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">
                          {rec.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
                          <span>{rec.collectionName}</span>
                          <span>•</span>
                          <span>{formatSeconds(rec.durationSeconds)}</span>
                          <span>•</span>
                          <span>{formatDate(rec.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 ml-3 flex items-center gap-2">
                      {rec.status === "ready" && (
                        <Badge variant="success">Ready</Badge>
                      )}
                      {rec.status === "transcribing" && (
                        <Badge variant="warning">Transcribing</Badge>
                      )}
                      {rec.status === "queued" && (
                        <Badge variant="secondary">Queued</Badge>
                      )}
                      {rec.status === "failed" && (
                        <Badge variant="danger">Failed</Badge>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Processing Activity & Engine Status (1 col) */}
            <div className="rounded-xl border border-border bg-surface-1 p-5 space-y-4">
              <div className="border-b border-border/50 pb-3">
                <h3 className="text-sm font-semibold text-text-primary">
                  Processing Queue & Activity
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Local background worker dispatch log
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-surface-2 border border-border space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-text-primary">
                      rec_03: standup_sprint14.m4a
                    </span>
                    <Badge variant="warning" className="text-[10px]">
                      Processing
                    </Badge>
                  </div>
                  <p className="text-xs text-text-secondary">
                    faster-whisper int8 STT extraction running on CPU.
                  </p>
                  <div className="h-1 w-full bg-surface-3 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 w-3/4 animate-pulse" />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-surface-2 border border-border space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-text-primary">
                      rec_01: eng_arch_q4_sync.mp3
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary">
                    Transcribed in 3.4s, 6 segments & 2 decisions generated via Ollama.
                  </p>
                </div>

                <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-text-muted">
                  <span>Engine Worker: Celery</span>
                  <span className="text-emerald-500 font-mono">1 active / 1 idle</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Upload Dialog */}
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSuccess={handleUploadSuccess}
      />
    </div>
  )
}
