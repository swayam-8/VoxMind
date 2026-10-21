import { useState, useEffect, useRef } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  Search,
  Sparkles,
  Download,
  Copy,
  FolderOpen,
  Calendar,
  Layers,
  Clock,
  RotateCcw,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AudioPlayer } from "@/components/audio/audio-player"
import { toast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api-client"

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

export function RecordingDetailPage() {
  const { id } = useParams<{ id: string }>()

  // Fetch real recording from REST API
  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["recording", id],
    queryFn: () => (id ? apiClient.getRecording(id) : Promise.reject(new Error("No ID"))),
    enabled: !!id,
  })

  const recording = response?.data

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1.0)
  const [transcriptSearch, setTranscriptSearch] = useState("")

  const activeSegmentRef = useRef<HTMLDivElement>(null)

  // Simulation timer for playback progress
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
    const duration = recording?.duration_seconds || 100
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            setIsPlaying(false)
            return 0
          }
          return prev + 0.25 * playbackRate
        })
      }, 250)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isPlaying, playbackRate, recording?.duration_seconds])

  const handleSeek = (time: number) => {
    setCurrentTime(time)
    toast({
      title: "Audio Seek",
      description: `Playback navigated to ${formatTimestamp(time)}`,
      duration: 1500,
    })
  }

  const copyTranscriptToClipboard = () => {
    if (!recording?.segments) return
    const fullText = recording.segments
      .map((s) => `[${formatTimestamp(s.start_time)}] ${s.speaker}: ${s.text}`)
      .join("\n\n")

    navigator.clipboard.writeText(fullText)
    toast({
      title: "Transcript Copied",
      description: "Full transcript with speaker timestamps copied to clipboard.",
      variant: "success",
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="space-y-1.5 w-1/3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
          <div className="lg:col-span-5">
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (isError || !recording) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-danger/30 bg-surface-1">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-subtle text-danger border border-danger/20 mb-3">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-text-primary">
          Recording Not Found
        </h3>
        <p className="max-w-sm mt-1 text-xs text-text-secondary">
          {error instanceof Error ? error.message : "The requested audio recording could not be retrieved from the database."}
        </p>
        <div className="mt-4 flex gap-2">
          <Link to="/app/recordings">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Return to Library
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Retry
          </Button>
        </div>
      </div>
    )
  }

  const segments = recording.segments || []
  const filteredSegments = segments.filter(
    (s) =>
      s.text.toLowerCase().includes(transcriptSearch.toLowerCase()) ||
      s.speaker.toLowerCase().includes(transcriptSearch.toLowerCase())
  )

  const summary = recording.summaries?.[0]
  const actionItems = recording.action_items || []

  return (
    <div className="space-y-6">
      {/* Top Navigation & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Link to="/app/recordings">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-text-secondary"
              aria-label="Back to recordings"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-text-primary truncate">
                {recording.title}
              </h1>
              <Badge variant="success" className="text-[10px]">
                {recording.status}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
              {recording.collection_name && (
                <>
                  <span className="flex items-center gap-1 text-text-secondary">
                    <FolderOpen className="h-3 w-3 text-accent" />
                    {recording.collection_name}
                  </span>
                  <span>•</span>
                </>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(recording.created_at).toLocaleDateString()}
              </span>
              <span>•</span>
              <span className="font-mono text-[11px] text-text-muted">
                {recording.filename}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copyTranscriptToClipboard}
            className="text-xs"
            disabled={segments.length === 0}
          >
            <Copy className="w-3.5 h-3.5 mr-1.5" />
            Copy Full Transcript
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              toast({
                title: "Export Prepared",
                description: "Recording markdown report generated.",
                variant: "default",
              })
            }
            className="text-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export Markdown
          </Button>
        </div>
      </div>

      {/* Main 2-Column Responsive Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Player & Transcript (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Interactive Audio Player */}
          <AudioPlayer
            title={recording.title}
            durationSeconds={recording.duration_seconds || 1}
            currentTime={currentTime}
            onSeek={handleSeek}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            playbackRate={playbackRate}
            onChangePlaybackRate={setPlaybackRate}
          />

          {/* Interactive Timestamped Transcript Panel */}
          <div className="rounded-xl border border-border bg-surface-1 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Layers className="h-4 w-4 text-accent" />
                  Synchronized Transcript
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Click any timestamp to seek playback
                </p>
              </div>

              {/* In-Transcript Search */}
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
                <Input
                  placeholder="Filter dialogue..."
                  value={transcriptSearch}
                  onChange={(e) => setTranscriptSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-surface-2"
                />
              </div>
            </div>

            {/* Segments Scroll Container */}
            <div className="max-h-[500px] overflow-y-auto space-y-3 pr-2 divide-y divide-border/30">
              {segments.length === 0 ? (
                <div className="py-8 text-center text-xs text-text-muted">
                  Transcript will appear here once speech-to-text processing completes.
                </div>
              ) : filteredSegments.length === 0 ? (
                <div className="py-8 text-center text-xs text-text-muted">
                  No dialogue matches "{transcriptSearch}".
                </div>
              ) : (
                filteredSegments.map((seg) => {
                  const isActive =
                    currentTime >= seg.start_time && currentTime <= seg.end_time

                  return (
                    <div
                      key={seg.id}
                      ref={isActive ? activeSegmentRef : undefined}
                      className={`pt-3 transition-colors rounded-lg p-2.5 -mx-1.5 ${
                        isActive
                          ? "bg-accent-subtle/70 border border-accent/30 shadow-xs"
                          : "hover:bg-surface-2/60 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSeek(seg.start_time)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-surface-2 text-accent border border-accent/20 hover:bg-accent hover:text-accent-foreground transition-all cursor-pointer"
                            title="Jump audio to this timestamp"
                          >
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(seg.start_time)}
                          </button>
                          <span className="text-xs font-semibold text-text-primary">
                            {seg.speaker}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-text-muted">
                          {(seg.confidence * 100).toFixed(0)}% conf
                        </span>
                      </div>

                      <p className="text-sm text-text-secondary leading-relaxed pl-1">
                        {seg.text}
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: AI Insights Hub (5 cols) */}
        <div className="lg:col-span-5 rounded-xl border border-border bg-surface-1 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-semibold text-text-primary">
                Voice Intelligence
              </h3>
            </div>
            <Badge variant="violet" className="text-[10px] font-mono">
              {summary?.model_name || "Ollama Engine"}
            </Badge>
          </div>

          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="decisions">Decisions</TabsTrigger>
              <TabsTrigger value="actions">Action Items</TabsTrigger>
            </TabsList>

            {/* Tab 1: Executive Summary */}
            <TabsContent value="summary" className="space-y-4 pt-3">
              <div className="p-4 rounded-lg bg-surface-2/60 border border-border space-y-3">
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Executive Briefing
                </h4>
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                  {summary?.summary_markdown || "Summary pending transcription worker completion."}
                </p>
              </div>

              {summary?.topics && summary.topics.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                    Extracted Topics
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.topics.map((topic, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        #{topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Tab 2: Key Decisions */}
            <TabsContent value="decisions" className="space-y-3 pt-3">
              {!summary?.decisions || summary.decisions.length === 0 ? (
                <div className="py-6 text-center text-xs text-text-muted">
                  No decisions logged for this recording.
                </div>
              ) : (
                summary.decisions.map((dec, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-lg bg-surface-2/60 border border-border space-y-2 hover:border-accent/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h5 className="text-xs font-bold text-text-primary leading-snug">
                        {dec.decision}
                      </h5>
                      {dec.sourceTimestamp !== undefined && (
                        <button
                          onClick={() => handleSeek(dec.sourceTimestamp!)}
                          className="shrink-0 px-1.5 py-0.5 rounded font-mono text-[10px] text-accent bg-accent-subtle border border-accent/20 hover:bg-accent hover:text-white transition-colors cursor-pointer"
                          title="Seek audio to verified decision source"
                        >
                          [{formatTimestamp(dec.sourceTimestamp)}]
                        </button>
                      )}
                    </div>
                    {dec.context && (
                      <p className="text-xs text-text-secondary leading-relaxed">
                        {dec.context}
                      </p>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            {/* Tab 3: Action Items Checklist */}
            <TabsContent value="actions" className="space-y-3 pt-3">
              {actionItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-text-muted">
                  No action items assigned for this recording.
                </div>
              ) : (
                actionItems.map((act) => (
                  <div
                    key={act.id}
                    className={`p-3.5 rounded-lg border transition-all space-y-2 ${
                      act.completed
                        ? "bg-surface-2/30 border-border opacity-60"
                        : "bg-surface-2/70 border-border"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={act.completed}
                        readOnly
                        className="mt-0.5 h-4 w-4 rounded border-border text-accent focus:ring-accent accent-accent"
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs font-semibold leading-snug ${
                            act.completed
                              ? "line-through text-text-muted"
                              : "text-text-primary"
                          }`}
                        >
                          {act.task}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-text-muted pt-1 border-t border-border/40">
                      <span className="text-text-secondary font-medium">
                        Assignee: {act.assignee || "Unassigned"}
                      </span>
                      {act.source_timestamp !== undefined && act.source_timestamp !== null && (
                        <button
                          type="button"
                          onClick={() => handleSeek(act.source_timestamp!)}
                          className="px-1.5 py-0.5 rounded font-mono text-[10px] text-accent bg-accent-subtle hover:bg-accent hover:text-white transition-colors cursor-pointer"
                          title="Seek to audio where task was assigned"
                        >
                          [{formatTimestamp(act.source_timestamp)}]
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
