import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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
  RotateCw,
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
import { apiClient, type ApiRecording } from "@/lib/api-client"

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
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
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState("created_at")
  const [order, setOrder] = useState<"desc" | "asc">("desc")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ApiRecording | null>(null)

  // Real backend query via TanStack Query with live polling during processing
  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["recordings", { search, status: statusFilter, sort_by: sortBy, order }],
    queryFn: () =>
      apiClient.getRecordings({
        search,
        status: statusFilter,
        sort_by: sortBy,
        order,
      }),
    refetchInterval: (query) => {
      const recs = query.state.data?.data || []
      const hasActive = recs.some(
        (r) => r.status === "queued" || r.status === "processing" || r.status === "transcribing"
      )
      return hasActive ? 2500 : false
    },
  })

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: (id: string) => apiClient.retryRecording(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recordings"] })
      toast({
        title: "Transcription Re-enqueued",
        description: "The background queue has scheduled speech-to-text processing.",
        variant: "success",
      })
    },
    onError: (err) => {
      toast({
        title: "Retry Failed",
        description: err instanceof Error ? err.message : "Could not re-enqueue transcription",
        variant: "danger",
      })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteRecording(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recordings"] })
      toast({
        title: "Recording Deleted",
        description: "The audio asset and related metadata were removed.",
        variant: "default",
      })
      setDeleteTarget(null)
    },
    onError: (err) => {
      toast({
        title: "Deletion Failed",
        description: err instanceof Error ? err.message : "Could not delete recording",
        variant: "danger",
      })
    },
  })

  const recordings = response?.data || []
  const totalCount = response?.meta?.total || 0

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
              {totalCount} Total
            </Badge>
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            Manage audio assets, inspect speech transcripts, and jump into AI workspaces.
          </p>
        </div>

        <div className="flex items-center gap-2">
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
            placeholder="Search by title or filename..."
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

          {/* Sort Control */}
          <div className="w-36">
            <Select
              value={sortBy}
              onValueChange={(val) => {
                setSortBy(val)
                setOrder(val === "title" ? "asc" : "desc")
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <ArrowUpDown className="w-3 h-3 mr-1 text-text-muted" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Date Created</SelectItem>
                <SelectItem value="duration_seconds">Audio Duration</SelectItem>
                <SelectItem value="file_size_bytes">File Size</SelectItem>
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
      {isError ? (
        /* Real Error State */
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-danger/30 bg-surface-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-subtle text-danger border border-danger/20 mb-3">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-text-primary">
            Failed to Load Recordings
          </h3>
          <p className="max-w-sm mt-1 text-xs text-text-secondary">
            {error instanceof Error ? error.message : "Could not connect to the backend REST API."}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="mt-4"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Retry Connection
          </Button>
        </div>
      ) : isLoading ? (
        /* Real Skeleton Loading State */
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
      ) : recordings.length === 0 ? (
        /* Genuine Empty / No Results State */
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border bg-surface-1">
          <Mic className="h-10 w-10 text-text-muted mb-3" />
          <h3 className="text-base font-semibold text-text-primary">
            {search ? `No recordings match "${search}"` : "No recordings yet"}
          </h3>
          <p className="max-w-sm mt-1 text-xs text-text-secondary">
            {search
              ? "Try adjusting your search terms or filter settings."
              : "Upload an audio recording to initiate transcription and AI insight extraction."}
          </p>
          <Button
            variant="default"
            size="sm"
            onClick={() => (search ? setSearch("") : setUploadOpen(true))}
            className="mt-4"
          >
            {search ? "Clear Search" : "Upload Audio"}
          </Button>
        </div>
      ) : viewMode === "list" ? (
        /* List Presentation View */
        <div className="space-y-2">
          {recordings.map((rec) => (
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
                    {rec.collection_name && (
                      <>
                        <span className="flex items-center gap-1 text-text-secondary">
                          <FolderOpen className="h-3 w-3 text-accent" />
                          {rec.collection_name}
                        </span>
                        <span>•</span>
                      </>
                    )}
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="h-3 w-3" />
                      {formatDuration(rec.duration_seconds)}
                    </span>
                    <span>•</span>
                    <span>{formatDate(rec.created_at)}</span>
                    <span>•</span>
                    <span className="font-mono text-[11px] text-text-muted">
                      {(rec.file_size_bytes / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  </div>
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                <div className="flex items-center gap-2">
                  {(rec.status === "ready" || rec.status === "completed") && (
                    <Badge variant="success">Completed</Badge>
                  )}
                  {(rec.status === "transcribing" || rec.status === "processing") && (
                    <Badge variant="warning" className="animate-pulse">
                      Processing...
                    </Badge>
                  )}
                  {rec.status === "queued" && (
                    <Badge variant="secondary">Queued</Badge>
                  )}
                  {rec.status === "failed" && (
                    <Badge variant="danger">Failed</Badge>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {rec.status === "failed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => retryMutation.mutate(rec.id)}
                      isLoading={retryMutation.isPending}
                      className="h-8 text-xs font-medium text-warning border-warning/30 hover:bg-warning-subtle"
                      title="Retry Transcription"
                    >
                      <RotateCw className="w-3.5 h-3.5 mr-1" /> Retry
                    </Button>
                  )}

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
          {recordings.map((rec) => (
            <div
              key={rec.id}
              className="flex flex-col justify-between p-5 rounded-xl bg-surface-1 border border-border hover:border-accent/40 transition-all space-y-4 group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-9 w-9 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-text-secondary group-hover:text-accent transition-colors">
                    <Mic className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(rec.status === "ready" || rec.status === "completed") && (
                      <Badge variant="success">Completed</Badge>
                    )}
                    {(rec.status === "transcribing" || rec.status === "processing") && (
                      <Badge variant="warning" className="animate-pulse">
                        Processing...
                      </Badge>
                    )}
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
                    {formatDuration(rec.duration_seconds)}
                  </span>
                  <span>{formatDate(rec.created_at)}</span>
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
              Are you sure you want to permanently delete "{deleteTarget?.title}"? All generated transcripts, decisions, and files will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              isLoading={deleteMutation.isPending}
            >
              Delete Recording
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audio Upload Dialog */}
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["recordings"] })}
      />
    </div>
  )
}
