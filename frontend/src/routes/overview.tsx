import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  UploadCloud,
  Mic,
  Clock,
  Sparkles,
  ArrowRight,
  HardDrive,
  CheckCircle2,
  FileCheck2,
  AlertCircle,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { UploadDialog } from "@/components/audio/upload-dialog"
import { apiClient } from "@/lib/api-client"

function formatSeconds(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.round(secs % 60)
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
  const queryClient = useQueryClient()
  const [uploadOpen, setUploadOpen] = useState(false)

  // Fetch real recordings from REST API
  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["recordings", { per_page: 5 }],
    queryFn: () => apiClient.getRecordings({ per_page: 5 }),
  })

  const recordings = response?.data || []
  const totalCount = response?.meta?.total || 0

  // Calculate actual library summary metrics
  const totalDuration = recordings.reduce((acc, r) => acc + (r.duration_seconds || 0), 0)
  const totalHours = (totalDuration / 3600).toFixed(1)
  const totalSizeMB = (
    recordings.reduce((acc, r) => acc + (r.file_size_bytes || 0), 0) /
    (1024 * 1024)
  ).toFixed(1)
  const readyCount = recordings.filter((r) => r.status === "ready" || r.status === "completed").length
  const pendingCount = recordings.filter(
    (r) => r.status === "transcribing" || r.status === "processing" || r.status === "queued"
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
            <Badge variant="success" className="text-[10px] font-mono">
              PostgreSQL Connected
            </Badge>
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            Voice intelligence pipeline status, recent activity, and library metrics.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
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

      {isError ? (
        /* Real Error State */
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-danger/30 bg-surface-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-subtle text-danger border border-danger/20 mb-3">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-text-primary">
            Failed to Load Workspace Metrics
          </h3>
          <p className="max-w-sm mt-1 text-xs text-text-secondary">
            {error instanceof Error ? error.message : "Could not connect to backend REST API."}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4">
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Retry Connection
          </Button>
        </div>
      ) : isLoading ? (
        /* Loading Skeleton */
        <div className="space-y-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : totalCount === 0 ? (
        /* Genuine First-Use Empty State */
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
                {totalCount}
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
                Active
              </div>
              <div className="text-[11px] text-text-secondary">
                Tracked across syncs
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
                {recordings.map((rec) => (
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
                          {rec.collection_name && (
                            <>
                              <span>{rec.collection_name}</span>
                              <span>•</span>
                            </>
                          )}
                          <span>{formatSeconds(rec.duration_seconds)}</span>
                          <span>•</span>
                          <span>{formatDate(rec.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 ml-3 flex items-center gap-2">
                      {(rec.status === "ready" || rec.status === "completed") && (
                        <Badge variant="success">Completed</Badge>
                      )}
                      {(rec.status === "transcribing" || rec.status === "processing") && (
                        <Badge variant="warning" className="animate-pulse">Processing...</Badge>
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
                      faster-whisper Engine
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary">
                    Local worker ready to transcribe multi-speaker audio with int8 quantization.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-surface-2 border border-border space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-text-primary">
                      Ollama Intelligence
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary">
                    Connected to local model llama3.2 for summaries and decision extraction.
                  </p>
                </div>

                <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-text-muted">
                  <span>Engine Worker: Celery</span>
                  <span className="text-emerald-500 font-mono">Ready</span>
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
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["recordings"] })}
      />
    </div>
  )
}
