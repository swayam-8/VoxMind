import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Mic,
  Search,
  Upload,
  LayoutGrid,
  List,
  Filter,
  ArrowUpDown,
  Play,
  RotateCw,
  RotateCcw,
  AlertCircle,
  FolderOpen,
  MoreHorizontal,
  FileAudio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UploadDialog } from "@/features/recordings/components/upload-dialog";
import { toast } from "@/hooks/use-toast";
import { apiClient, type ApiRecording } from "@/lib/api-client";
import { PageTransition } from "@/components/layout/page-transition";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s > 0 ? `${s}s` : ""}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function RecordingsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const collectionFilter = searchParams.get("collection_id") || "all";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [order, setOrder] = useState<"desc" | "asc">("desc");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiRecording | null>(null);

  // Collections query
  const { data: collectionsRes } = useQuery({
    queryKey: ["collections"],
    queryFn: () => apiClient.getCollections(),
  });
  const collections = collectionsRes?.data || [];

  // Recordings query with live status polling
  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "recordings",
      {
        search,
        status: statusFilter,
        collection_id: collectionFilter,
        sort_by: sortBy,
        order,
      },
    ],
    queryFn: () =>
      apiClient.getRecordings({
        search,
        status: statusFilter,
        collection_id: collectionFilter,
        sort_by: sortBy,
        order,
      }),
    refetchInterval: (query) => {
      const recs = query.state.data?.data || [];
      const hasActive = recs.some(
        (r) =>
          r.status === "queued" ||
          r.status === "processing" ||
          r.status === "transcribing"
      );
      return hasActive ? 2500 : false;
    },
  });

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: (id: string) => apiClient.retryRecording(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
      toast({
        title: "Transcription Re-enqueued",
        description: "The background queue has scheduled speech-to-text processing.",
        variant: "success",
      });
    },
    onError: (err) => {
      toast({
        title: "Retry Failed",
        description: err instanceof Error ? err.message : "Could not re-enqueue transcription",
        variant: "danger",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteRecording(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
      toast({
        title: "Recording Deleted",
        description: "The audio asset and related metadata were removed.",
        variant: "default",
      });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast({
        title: "Deletion Failed",
        description: err instanceof Error ? err.message : "Could not delete recording",
        variant: "danger",
      });
    },
  });

  const recordings = response?.data || [];
  const totalCount = response?.meta?.total || 0;

  return (
    <PageTransition className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="eyebrow text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
            THE CONVERSATION ARCHIVE
          </p>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
              Meetings
            </h1>
            <Badge variant="outline" className="text-xs font-mono">
              {totalCount} Total
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-text-secondary">
            Manage, review, and act on your recorded meeting intelligence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => setUploadOpen(true)}
            className="shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
          >
            <Upload className="w-4 h-4 mr-1.5" />
            Upload Meeting
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-0 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <Input
            placeholder="Search by title or filename..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search recordings"
            className="pl-9 h-9 text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-text-primary"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="w-32">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger aria-label="Filter by status" className="h-9 text-xs">
                <Filter className="w-3.5 h-3.5 mr-1 text-text-muted shrink-0" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="ready">Completed</SelectItem>
                <SelectItem value="transcribing">Transcribing</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Collection Filter */}
          <div className="w-36">
            <Select
              value={collectionFilter}
              onValueChange={(val) => {
                const next = new URLSearchParams(searchParams);
                if (val === "all") {
                  next.delete("collection_id");
                } else {
                  next.set("collection_id", val);
                }
                setSearchParams(next);
              }}
            >
              <SelectTrigger aria-label="Filter by collection" className="h-9 text-xs">
                <FolderOpen className="w-3.5 h-3.5 mr-1 text-text-muted shrink-0" />
                <SelectValue placeholder="Collection" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Collections</SelectItem>
                {collections.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sort Control */}
          <div className="w-36">
            <Select
              value={sortBy}
              onValueChange={(val) => {
                setSortBy(val);
                setOrder(val === "title" ? "asc" : "desc");
              }}
            >
              <SelectTrigger aria-label="Sort recordings" className="h-9 text-xs">
                <ArrowUpDown className="w-3.5 h-3.5 mr-1 text-text-muted shrink-0" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Date Created</SelectItem>
                <SelectItem value="duration_seconds">Duration</SelectItem>
                <SelectItem value="file_size_bytes">File Size</SelectItem>
                <SelectItem value="title">Title (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* View Mode Toggle */}
          <div className="inline-flex rounded-md border border-border bg-surface-2 p-0.5 ml-auto">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded transition-all ${
                viewMode === "list"
                  ? "bg-surface-1 text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                  : "text-text-muted hover:text-text-primary"
              }`}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded transition-all ${
                viewMode === "grid"
                  ? "bg-surface-1 text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                  : "text-text-muted hover:text-text-primary"
              }`}
              aria-label="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isError ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-danger/30 bg-surface-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-danger-subtle text-danger mb-3">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-text-primary">
            Failed to Load Recordings
          </h3>
          <p className="max-w-sm mt-1 text-xs text-text-secondary">
            {error instanceof Error ? error.message : "Could not connect to the backend API."}
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
        <div className="rounded-lg border border-border bg-surface-1 p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-md" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-6 w-20 rounded" />
            </div>
          ))}
        </div>
      ) : recordings.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-14 text-center rounded-lg border border-dashed border-border bg-surface-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-text-muted mb-3 border border-border">
            <Mic className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-text-primary">
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
        /* Attio-Style Records Table */
        <div className="rounded-lg border border-border bg-surface-1 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-text-muted font-medium">
                  <th className="py-2.5 px-4 font-medium">Meeting Title</th>
                  <th className="py-2.5 px-3 font-medium">Recorded Date</th>
                  <th className="py-2.5 px-3 font-medium">Duration</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-3 font-medium">Collection</th>
                  <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recordings.map((rec) => (
                  <tr
                    key={rec.id}
                    className="group hover:bg-surface-2/60 transition-colors cursor-pointer"
                    onClick={(e) => {
                      // Don't navigate if clicking action button or dropdown
                      if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("a")) return;
                      window.location.assign(`/app/recordings/${rec.id}`);
                    }}
                  >
                    {/* Meeting Title Column */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-md bg-surface-2 border border-border flex items-center justify-center text-text-secondary group-hover:text-accent group-hover:bg-accent-subtle transition-colors shrink-0">
                          <Play size={11} fill="currentColor" />
                        </span>
                        <div className="min-w-0">
                          <Link
                            to={`/app/recordings/${rec.id}`}
                            className="font-medium text-text-primary group-hover:text-accent transition-colors hover:underline block truncate max-w-xs sm:max-w-md"
                          >
                            {rec.title}
                          </Link>
                          <div className="flex items-center gap-1.5 text-[11px] text-text-muted mt-0.5">
                            <span className="truncate">{rec.filename}</span>
                            {rec.source_provider && (
                              <span className="capitalize text-[10px] px-1 py-0 rounded bg-surface-2">
                                {rec.source_provider}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-3 text-text-secondary whitespace-nowrap">
                      {formatDate(rec.created_at)}
                    </td>

                    {/* Duration */}
                    <td className="py-3 px-3 font-mono text-text-secondary whitespace-nowrap">
                      {formatDuration(rec.duration_seconds)}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {["ready", "completed"].includes(rec.status) ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
                          <span className="w-1.5 h-1.5 rounded-full bg-success" />
                          Ready
                        </span>
                      ) : ["transcribing", "processing"].includes(rec.status) ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning">
                          <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                          Processing…
                        </span>
                      ) : rec.status === "queued" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-muted">
                          <span className="w-1.5 h-1.5 rounded-full bg-text-muted" />
                          Queued
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-danger">
                          <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                          Failed
                        </span>
                      )}
                    </td>

                    {/* Collection */}
                    <td className="py-3 px-3 text-text-secondary whitespace-nowrap">
                      {rec.collection_name ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-text-secondary bg-surface-2 px-2 py-0.5 rounded border border-border/80">
                          <FolderOpen size={11} className="text-accent" />
                          {rec.collection_name}
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {rec.status === "failed" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              retryMutation.mutate(rec.id);
                            }}
                            isLoading={retryMutation.isPending}
                            className="h-7 text-xs font-medium text-warning border-warning/30 hover:bg-warning-subtle"
                            title="Retry Transcription"
                          >
                            <RotateCw className="w-3.5 h-3.5 mr-1" /> Retry
                          </Button>
                        )}

                        <Link to={`/app/recordings/${rec.id}`} onClick={(e) => e.stopPropagation()}>
                          <Button variant="secondary" size="sm" className="h-7 text-xs font-medium">
                            <Play className="w-3 h-3 mr-1 text-accent" /> Open
                          </Button>
                        </Link>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-text-muted hover:text-text-primary"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal size={14} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 text-xs">
                            <DropdownMenuItem
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/app/recordings/${rec.id}`);
                                toast({ title: "Link copied", description: "Meeting link copied to clipboard." });
                              }}
                            >
                              Copy link
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(rec)}
                              className="text-danger focus:text-danger"
                            >
                              Delete recording
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Attio-Style Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recordings.map((rec) => (
            <div
              key={rec.id}
              className="group rounded-lg border border-border bg-surface-1 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-accent/40 transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="w-8 h-8 rounded-md bg-surface-2 border border-border flex items-center justify-center text-text-muted group-hover:text-accent group-hover:bg-accent-subtle transition-colors shrink-0">
                    <FileAudio size={16} />
                  </span>
                  <Badge
                    variant={
                      ["ready", "completed"].includes(rec.status)
                        ? "success"
                        : ["transcribing", "processing"].includes(rec.status)
                        ? "warning"
                        : rec.status === "failed"
                        ? "danger"
                        : "secondary"
                    }
                    className="text-[10px] capitalize"
                  >
                    {rec.status === "ready" ? "Ready" : rec.status}
                  </Badge>
                </div>

                <Link
                  to={`/app/recordings/${rec.id}`}
                  className="font-medium text-sm text-text-primary group-hover:text-accent transition-colors hover:underline block mt-2.5 line-clamp-2"
                >
                  {rec.title}
                </Link>

                <p className="text-xs text-text-muted mt-1 truncate">
                  {rec.filename}
                </p>
              </div>

              <div className="pt-3 border-t border-border/80 flex items-center justify-between text-xs text-text-muted">
                <span className="font-mono">{formatDuration(rec.duration_seconds)}</span>
                <span>{formatDate(rec.created_at)}</span>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete recording?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.title}&rdquo;? This will permanently remove the audio file, transcript, and AI summaries.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              isLoading={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["recordings"] });
        }}
      />
    </PageTransition>
  );
}
