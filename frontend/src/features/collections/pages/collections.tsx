import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FolderOpen,
  Plus,
  ArrowRight,
  Trash2,
  Calendar,
  Loader2,
  FolderPlus,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

export function CollectionsPage() {
  const [collections, setCollections] = useState<ApiCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<ApiCollection | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState("#3159DF");

  useEffect(() => {
    let ignore = false;
    const init = async () => {
      try {
        setLoading(true);
        setLoadError(false);
        const res = await apiClient.getCollections();
        if (!ignore) setCollections(res.data || []);
      } catch {
        if (!ignore) setLoadError(true);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    void init();
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await apiClient.createCollection({
        name: name.trim(),
        description: description.trim() || undefined,
        color: selectedColor,
      });

      setCollections((prev) => [res.data, ...prev]);
      setName("");
      setDescription("");
      setDialogOpen(false);

      toast({
        title: "Collection Created",
        description: `"${res.data.name}" added to workspace.`,
        variant: "success",
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to create collection";
      toast({
        title: "Creation Failed",
        description: msg,
        variant: "danger",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, colName: string) => {
    setIsDeleting(true);
    try {
      await apiClient.deleteCollection(id);
      setDeleteTarget(null);
      setCollections((prev) => prev.filter((c) => c.id !== id));
      toast({
        title: "Collection Deleted",
        description: `"${colName}" was deleted. Recordings have been unassigned.`,
        variant: "danger",
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to delete collection";
      toast({
        title: "Delete Failed",
        description: msg,
        variant: "danger",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const COLOR_OPTIONS = [
    { label: "Cobalt", hex: "#3159DF" },
    { label: "Slate", hex: "#64748B" },
    { label: "Royal Blue", hex: "#3B82F6" },
    { label: "Amber", hex: "#F59E0B" },
    { label: "Rose Red", hex: "#EF4444" },
  ];

  return (
    <div className="feature-page space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="eyebrow mb-3">CURATED BY YOU</p>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              A place for every idea
            </h1>
            <Badge variant="outline" className="text-sm">
              {collections.length} Collections
            </Badge>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Give your projects, teams, and conversations a little room of their
            own.
          </p>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="shadow-sm"
        >
          <Plus className="w-5 h-5 mr-1.5" />
          New Collection
        </Button>
      </div>

      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center text-text-muted space-y-2">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
          <span className="text-sm">Loading collections...</span>
        </div>
      ) : loadError ? (
        <div
          className="library-empty rounded-2xl border border-border bg-surface-1"
          role="alert"
        >
          <AlertCircle size={32} className="text-danger mb-4" />
          <h3>We couldn’t load your collections.</h3>
          <p>Check that you’re signed in and your workspace is connected.</p>
          <Button
            variant="outline"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            <RefreshCw size={20} />
            Try again
          </Button>
        </div>
      ) : collections.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-2xl bg-surface-1/40 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-accent-subtle/50 text-accent flex items-center justify-center mx-auto">
            <FolderPlus className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              No collections yet
            </h3>
            <p className="text-sm text-text-muted mt-1 max-w-sm mx-auto">
              Create your first collection to group and organize recordings for
              executive reviews or client deliveries.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="mt-2 text-sm"
          >
            <Plus className="w-5 h-5 mr-1" /> Create Collection
          </Button>
        </div>
      ) : (
        /* Grid of Collections */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((col) => (
            <div
              key={col.id}
              className="flex flex-col justify-between p-5 rounded-xl bg-surface-1 border border-border hover:border-accent/40 transition-all space-y-4 group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div
                    style={{
                      backgroundColor: `${col.color}20`,
                      borderColor: `${col.color}40`,
                      color: col.color,
                    }}
                    className="h-10 w-10 rounded-lg border flex items-center justify-center shrink-0"
                  >
                    <FolderOpen className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="font-mono text-sm">
                      {col.recording_count ?? 0} recordings
                    </Badge>
                    <button
                      onClick={() => setDeleteTarget(col)}
                      className="p-1.5 text-text-muted hover:text-danger rounded transition-colors"
                      aria-label={`Delete ${col.name}`}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-text-primary group-hover:text-accent transition-colors">
                    {col.name}
                  </h3>
                  <p className="text-sm text-text-secondary line-clamp-2 mt-1">
                    {col.description || "No description provided."}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-border/50 flex items-center justify-between text-sm text-text-muted">
                <span className="flex items-center gap-1">
                  <Calendar className="w-5 h-5" />
                  {new Date(col.created_at).toLocaleDateString()}
                </span>
                <Link
                  to={`/app/recordings?collection_id=${col.id}`}
                  className="text-sm font-semibold text-accent hover:underline flex items-center gap-1"
                >
                  Browse Audio <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Collection Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md w-[calc(100vw-2rem)] sm:w-full border-border bg-surface-1 p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              Create New Collection
            </DialogTitle>
            <DialogDescription>
              Group related meetings, interviews, or project voice memos.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 pt-1">
            <div>
              <label
                htmlFor="collections-field-1"
                className="text-sm font-medium text-text-secondary mb-1.5 block"
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
                className="text-sm font-medium text-text-secondary mb-1.5 block"
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
              <label className="text-sm font-medium text-text-secondary mb-2 block">
                Color Tag
              </label>
              <div className="flex flex-wrap items-center gap-3">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setSelectedColor(c.hex)}
                    style={{ backgroundColor: c.hex }}
                    className={`h-9 w-9 rounded-full transition-transform cursor-pointer ${
                      selectedColor === c.hex
                        ? "ring-2 ring-text-primary ring-offset-2 ring-offset-surface-1 scale-110"
                        : "opacity-80 hover:opacity-100"
                    }`}
                    title={c.label}
                    aria-label={c.label}
                    aria-pressed={selectedColor === c.hex}
                  />
                ))}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={!name.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-1.5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Collection"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete collection?</DialogTitle>
            <DialogDescription>
              “{deleteTarget?.name}” will be removed. Your recordings will stay
              in your library.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isDeleting}
              onClick={() => setDeleteTarget(null)}
            >
              Keep collection
            </Button>
            <Button
              variant="destructive"
              isLoading={isDeleting}
              onClick={() => {
                if (deleteTarget)
                  void handleDelete(deleteTarget.id, deleteTarget.name);
              }}
            >
              Delete collection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
