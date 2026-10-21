import { useState, useMemo } from "react"
import { Link } from "react-router-dom"
import {
  Mic,
  Search,
  UploadCloud,
  LayoutGrid,
  List,
  Filter,
  ArrowUpDown,
  Clock,
  Trash2,
  Play,
  RotateCcw,
  Sparkles,
  AlertCircle,
  FolderOpen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { UploadDialog } from "@/components/audio/upload-dialog"
import { toast } from "@/hooks/use-toast"
import { DEMO_RECORDINGS, type DemoRecording } from "@/lib/demo-data"

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s > 0 ? `${s}s` : ""}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function RecordingsPage() {
  const [recordings, setRecordings] = useState<DemoRecording[]>(DEMO_RECORDINGS)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [durationFilter, setDurationFilter] = useState("all")
  const [sortBy, setSortBy] = useState("newest")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DemoRecording | null>(null)

  // Simulation states for design verification
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)

  // Filter and sort computation
  const filteredRecordings = useMemo(() => {
    return recordings
      .filter((rec) => {
        const matchesSearch =
          rec.title.toLowerCase().includes(search.toLowerCase()) ||
          rec.filename.toLowerCase().includes(search.toLowerCase()) ||
          rec.collectionName.toLowerCase().includes(search.toLowerCase())

        const matchesStatus =
          statusFilter === "all" || rec.status === statusFilter

        const matchesDuration =
          durationFilter === "all" ||
          (durationFilter === "short" && rec.durationSeconds < 600) ||
          (durationFilter === "medium" &&
            rec.durationSeconds >= 600 &&
            rec.durationSeconds <= 1800) ||
          (durationFilter === "long" && rec.durationSeconds > 1800)

        return matchesSearch && matchesStatus && matchesDuration
      })
      .sort((a, b) => {
        if (sortBy === "newest") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        }
        if (sortBy === "oldest") {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        }
        if (sortBy === "longest") {
          return b.durationSeconds - a.durationSeconds
        }
        if (sortBy === "shortest") {
          return a.durationSeconds - b.durationSeconds
        }
        if (sortBy === "title") {
          return a.title.localeCompare(b.title)
        }
        return 0
      })
  }, [recordings, search, statusFilter, durationFilter, sortBy])

  const handleDelete = () => {
    if (!deleteTarget) return
    setRecordings((prev) => prev.filter((r) => r.id !== deleteTarget.id))
    toast({
      title: "Recording Deleted",
      description: `"${deleteTarget.title}" was removed from the library.`,
      variant: "danger",
    })
    setDeleteTarget(null)
  }

  const handleUploadSuccess = (newRec: DemoRecording) => {
    setRecordings((prev) => [newRec, ...prev])
  }

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              Recordings Library
            </h1>
            <Badge variant="outline" className="text-xs">
              {recordings.length} Total
            </Badge>
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            Manage audio recordings, inspect whisper transcripts, and jump to AI workspaces.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Simulation Toggles for Visual States */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsLoading(!isLoading)}
            className="text-xs text-text-muted hover:text-text-primary"
            title="Toggle Skeleton Loading State"
          >
            {isLoading ? "End Skeleton" : "Simulate Loading"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHasError(!hasError)}
            className="text-xs text-text-muted hover:text-text-primary"
            title="Toggle Error State"
          >
            {hasError ? "Clear Error" : "Simulate Error"}
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

      {/* Filter and Control Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-surface-1 p-3.5 rounded-xl border border-border">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
          <Input
            placeholder="Search by title, filename, or collection..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-surface-2 border-border text-xs"
          />
        </div>

        {/* Filter Dropdowns & View Mode */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="w-36">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 text-xs">
                <Filter className="w-3 h-3 mr-1 text-text-muted" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="ready">Ready (Indexed)</SelectItem>
                <SelectItem value="transcribing">Transcribing</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Duration Filter */}
          <div className="w-36">
            <Select value={durationFilter} onValueChange={setDurationFilter}>
              <SelectTrigger className="h-9 text-xs">
                <Clock className="w-3 h-3 mr-1 text-text-muted" />
                <SelectValue placeholder="Duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Duration</SelectItem>
                <SelectItem value="short">&lt; 10 mins</SelectItem>
                <SelectItem value="medium">10 - 30 mins</SelectItem>
                <SelectItem value="long">&gt; 30 mins</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort Control */}
          <div className="w-36">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-9 text-xs">
                <ArrowUpDown className="w-3 h-3 mr-1 text-text-muted" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="longest">Longest Audio</SelectItem>
                <SelectItem value="shortest">Shortest Audio</SelectItem>
                <SelectItem value="title">Title (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-border rounded-md p-0.5 bg-surface-2">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
              className="h-8 w-8 rounded-sm"
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
              className="h-8 w-8 rounded-sm"
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {hasError ? (
        /* Error State */
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-danger/30 bg-surface-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-subtle text-danger border border-danger/20 mb-3">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-text-primary">
            Failed to Load Recordings
          </h3>
          <p className="max-w-sm mt-1 text-xs text-text-secondary">
            Could not communicate with the local persistence service. Please verify PostgreSQL status.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHasError(false)}
            className="mt-4"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Retry Connection
          </Button>
        </div>
      ) : isLoading ? (
        /* Skeleton Loading State */
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-4 rounded-xl border border-border bg-surface-1 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 w-1/2">
                <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                <div className="space-y-1.5 w-full">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredRecordings.length === 0 ? (
        /* No Results State */
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border bg-surface-1">
          <Search className="h-8 w-8 text-text-muted mb-2" />
          <h3 className="text-base font-semibold text-text-primary">
            No matching recordings found
          </h3>
          <p className="max-w-sm mt-1 text-xs text-text-secondary">
            No recordings match "{search}" with the selected filters.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSearch("")
              setStatusFilter("all")
              setDurationFilter("all")
            }}
            className="mt-4"
          >
            Reset All Filters
          </Button>
        </div>
      ) : viewMode === "list" ? (
        /* List Presentation View */
        <div className="space-y-2">
          {filteredRecordings.map((rec) => (
            <div
              key={rec.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-surface-1 border border-border hover:border-accent/40 transition-all gap-3 group"
            >
              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-text-secondary group-hover:text-accent transition-colors shrink-0 mt-0.5 sm:mt-0">
                  <Mic className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <Link
                    to={`/app/recordings/${rec.id}`}
                    className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors hover:underline block truncate"
                  >
                    {rec.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-text-muted">
                    <span className="flex items-center gap-1 text-text-secondary">
                      <FolderOpen className="h-3 w-3 text-accent" />
                      {rec.collectionName}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="h-3 w-3" />
                      {formatDuration(rec.durationSeconds)}
                    </span>
                    <span>•</span>
                    <span>{formatDate(rec.createdAt)}</span>
                    <span>•</span>
                    <span className="font-mono text-[11px] text-text-muted">
                      {(rec.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  </div>
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                <div>
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

                <div className="flex items-center gap-1.5">
                  <Link to={`/app/recordings/${rec.id}`}>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 text-xs font-medium"
                    >
                      <Play className="w-3.5 h-3.5 mr-1" /> Workspace
                    </Button>
                  </Link>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget(rec)}
                    className="h-8 w-8 text-text-muted hover:text-danger"
                    aria-label="Delete recording"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Grid Presentation View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecordings.map((rec) => (
            <div
              key={rec.id}
              className="flex flex-col justify-between p-5 rounded-xl bg-surface-1 border border-border hover:border-accent/40 transition-all space-y-4 group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-9 w-9 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-text-secondary group-hover:text-accent transition-colors">
                    <Mic className="h-4 w-4" />
                  </div>
                  <div>
                    {rec.status === "ready" && <Badge variant="success">Ready</Badge>}
                    {rec.status === "transcribing" && <Badge variant="warning">Transcribing</Badge>}
                    {rec.status === "queued" && <Badge variant="secondary">Queued</Badge>}
                    {rec.status === "failed" && <Badge variant="danger">Failed</Badge>}
                  </div>
                </div>

                <div>
                  <Link
                    to={`/app/recordings/${rec.id}`}
                    className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors hover:underline line-clamp-2"
                  >
                    {rec.title}
                  </Link>
                  <p className="text-xs text-text-muted mt-1 truncate">
                    {rec.filename}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-border/50 space-y-3">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="h-3 w-3" />
                    {formatDuration(rec.durationSeconds)}
                  </span>
                  <span>{formatDate(rec.createdAt)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Link to={`/app/recordings/${rec.id}`} className="flex-1">
                    <Button variant="secondary" size="sm" className="w-full text-xs">
                      <Sparkles className="w-3.5 h-3.5 mr-1 text-accent" /> Open Workspace
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget(rec)}
                    className="h-8 w-8 text-text-muted hover:text-danger"
                    aria-label="Delete recording"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-md border-border bg-surface-1">
          <DialogHeader>
            <DialogTitle>Delete Audio Recording?</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete "{deleteTarget?.title}"? All generated transcripts, decisions, and vector embeddings will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Recording
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audio Upload Dialog */}
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSuccess={handleUploadSuccess}
      />
    </div>
  )
}
