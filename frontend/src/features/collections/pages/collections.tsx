import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  ArrowRight,
  Trash2,
  Calendar,
  FolderPlus,
  AlertCircle,
  RefreshCw,
  Folder,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { apiClient, type ApiCollection } from "@/lib/api-client";
import { PageTransition } from "@/components/layout/page-transition";

export function CollectionsPage() {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<ApiCollection | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState("#3159DF");

  // TanStack Query for collections
  const {
    data: collectionsRes,
    isLoading: loading,
    isError: loadError,
    refetch,
  } = useQuery({
    queryKey: ["collections"],
    queryFn: () => apiClient.getCollections(),
  });

  const collections = collectionsRes?.data || [];

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; color: string }) =>
      apiClient.createCollection(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      setName("");
      setDescription("");
      setDialogOpen(false);
      toast({
        title: "Collection Created",
        description: `"${res.data.name}" added to workspace.`,
        variant: "success",
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to create collection";
      toast({
        title: "Creation Failed",
        description: msg,
        variant: "danger",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteCollection(id),
    onSuccess: () => {
      const deletedName = deleteTarget?.name || "Collection";
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      setDeleteTarget(null);
      toast({
        title: "Collection Deleted",
        description: `"${deletedName}" was deleted. Recordings have been unassigned.`,
        variant: "default",
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to delete collection";
      toast({
        title: "Delete Failed",
        description: msg,
        variant: "danger",
      });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      color: selectedColor,
    });
  };

  const COLOR_OPTIONS = [
    { label: "Cobalt", hex: "#3159DF" },
    { label: "Slate", hex: "#64748B" },
    { label: "Royal Blue", hex: "#3B82F6" },
    { label: "Amber", hex: "#F59E0B" },
    { label: "Rose Red", hex: "#EF4444" },
  ];

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="eyebrow text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
            CURATED BY YOU
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
              A place for every idea
            </h1>
            <Badge variant="outline" className="text-xs font-mono">
              {collections.length} Collections
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-text-secondary">
            Give your projects, teams, and conversations a dedicated room of their own.
          </p>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Collection
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="p-5 rounded-lg border border-border bg-surface-1 space-y-3">
              <Skeleton className="w-9 h-9 rounded-md" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div
          className="p-12 text-center rounded-lg border border-border bg-surface-1"
          role="alert"
        >
          <AlertCircle size={32} className="text-danger mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-text-primary">
            We couldn’t load your collections.
          </h3>
          <p className="text-xs text-text-muted mt-1 mb-4">
            Check that you’re signed in and your workspace is connected.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw size={14} className="mr-1.5" />
            Try again
          </Button>
        </div>
      ) : collections.length === 0 ? (
        <div className="p-14 text-center border border-dashed border-border rounded-lg bg-surface-1 space-y-3">
          <div className="w-12 h-12 rounded-full bg-surface-2 text-text-muted flex items-center justify-center mx-auto mb-2 border border-border">
            <FolderPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              No collections yet
            </h3>
            <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
              Create your first collection to group and organize recordings for executive reviews or client deliverables.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="mt-2 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Create Collection
          </Button>
        </div>
      ) : (
        /* Grid of Collections */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((col) => (
            <div
              key={col.id}
              className="flex flex-col justify-between p-4 rounded-lg bg-surface-1 border border-border hover:border-accent/40 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all space-y-3 group"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div
                    style={{
                      backgroundColor: `${col.color}15`,
                      borderColor: `${col.color}35`,
                      color: col.color,
                    }}
                    className="h-8 w-8 rounded-md border flex items-center justify-center shrink-0"
                  >
                    <Folder className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {col.recording_count ?? 0} recordings
                    </Badge>
                    <button
                      onClick={() => setDeleteTarget(col)}
                      className="p-1 text-text-muted hover:text-danger rounded transition-colors"
                      aria-label={`Delete ${col.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
                    {col.name}
                  </h3>
                  <p className="text-xs text-text-secondary line-clamp-2 mt-0.5">
                    {col.description || "No description provided."}
                  </p>
                </div>
              </div>

              <div className="pt-2.5 border-t border-border flex items-center justify-between text-xs text-text-muted">
                <span className="flex items-center gap-1 text-[11px]">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(col.created_at).toLocaleDateString()}
                </span>
                <Link
                  to={`/app/recordings?collection_id=${col.id}`}
                  className="text-xs font-medium text-accent hover:underline flex items-center gap-0.5"
                >
                  Browse Audio <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Collection Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md w-[calc(100vw-2rem)] sm:w-full border-border bg-surface-1 p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-semibold text-text-primary">
              Create New Collection
            </DialogTitle>
            <DialogDescription className="text-xs text-text-secondary">
              Group related meetings, interviews, or project voice memos.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 pt-1">
            <div>
              <label
                htmlFor="collections-field-1"
                className="text-xs font-medium text-text-secondary mb-1 block"
              >
                Collection Name
              </label>
              <Input
                id="collections-field-1"
                placeholder="e.g. Q4 Executive Leadership Syncs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label
                htmlFor="collections-field-2"
                className="text-xs font-medium text-text-secondary mb-1 block"
              >
                Description (Optional)
              </label>
              <Input
                id="collections-field-2"
                placeholder="Brief purpose of this audio workspace..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text-secondary mb-2 block">
                Color Tag
              </label>
              <div className="flex flex-wrap items-center gap-2.5">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setSelectedColor(c.hex)}
                    style={{ backgroundColor: c.hex }}
                    className={`h-7 w-7 rounded-full transition-transform cursor-pointer ${
                      selectedColor === c.hex
                        ? "ring-2 ring-accent ring-offset-2 scale-110"
                        : "opacity-80 hover:opacity-100 hover:scale-105"
                    }`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                isLoading={createMutation.isPending}
                disabled={!name.trim()}
              >
                Create Collection
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-md border-border bg-surface-1 p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-semibold text-text-primary">
              Delete collection?
            </DialogTitle>
            <DialogDescription className="text-xs text-text-secondary">
              This will remove the &ldquo;{deleteTarget?.name}&rdquo; collection. Recordings within it will remain safe in your library.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
            >
              Keep collection
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
    </PageTransition>
  );
}
