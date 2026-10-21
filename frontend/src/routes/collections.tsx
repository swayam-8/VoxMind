import { useState } from "react"
import { Link } from "react-router-dom"
import {
  FolderOpen,
  Plus,
  ArrowRight,
  Trash2,
  Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { DEMO_COLLECTIONS, type DemoCollection } from "@/lib/demo-data"

export function CollectionsPage() {
  const [collections, setCollections] = useState<DemoCollection[]>(DEMO_COLLECTIONS)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedColor, setSelectedColor] = useState("#8B5CF6")

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const newCol: DemoCollection = {
      id: `col-${Date.now().toString(36)}`,
      name,
      description: description || "No description provided.",
      color: selectedColor,
      recordingCount: 0,
      createdAt: new Date().toISOString(),
    }

    setCollections((prev) => [...prev, newCol])
    setName("")
    setDescription("")
    setDialogOpen(false)

    toast({
      title: "Collection Created",
      description: `"${newCol.name}" added to workspace.`,
      variant: "success",
    })
  }

  const handleDelete = (id: string, colName: string) => {
    setCollections((prev) => prev.filter((c) => c.id !== id))
    toast({
      title: "Collection Deleted",
      description: `"${colName}" was deleted. Recordings have been unassigned.`,
      variant: "danger",
    })
  }

  const COLOR_OPTIONS = [
    { label: "Obsidian Violet", hex: "#8B5CF6" },
    { label: "Emerald", hex: "#10B981" },
    { label: "Royal Blue", hex: "#3B82F6" },
    { label: "Amber", hex: "#F59E0B" },
    { label: "Rose Red", hex: "#EF4444" },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              Collections
            </h1>
            <Badge variant="outline" className="text-xs">
              {collections.length} Collections
            </Badge>
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            Organize recordings into project workspaces, team channels, and research groups.
          </p>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Collection
        </Button>
      </div>

      {/* Grid of Collections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {collections.map((col) => (
          <div
            key={col.id}
            className="flex flex-col justify-between p-5 rounded-xl bg-surface-1 border border-border hover:border-accent/40 transition-all space-y-4 group"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div
                  style={{ backgroundColor: `${col.color}20`, borderColor: `${col.color}40`, color: col.color }}
                  className="h-10 w-10 rounded-lg border flex items-center justify-center shrink-0"
                >
                  <FolderOpen className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="font-mono text-xs">
                    {col.recordingCount} recordings
                  </Badge>
                  <button
                    onClick={() => handleDelete(col.id, col.name)}
                    className="p-1.5 text-text-muted hover:text-danger rounded transition-colors"
                    aria-label="Delete collection"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-text-primary group-hover:text-accent transition-colors">
                  {col.name}
                </h3>
                <p className="text-xs text-text-secondary line-clamp-2 mt-1">
                  {col.description}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs text-text-muted">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(col.createdAt).toLocaleDateString()}
              </span>
              <Link
                to="/app/recordings"
                className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
              >
                Browse Audio <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Create Collection Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md border-border bg-surface-1">
          <DialogHeader>
            <DialogTitle>Create New Collection</DialogTitle>
            <DialogDescription>
              Group related meetings, interviews, or project voice memos.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 pt-1">
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                Collection Name
              </label>
              <Input
                placeholder="e.g. Q4 Executive Leadership Syncs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                Description (Optional)
              </label>
              <Input
                placeholder="Brief purpose of this audio workspace..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text-secondary mb-2 block">
                Color Tag
              </label>
              <div className="flex items-center gap-3">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setSelectedColor(c.hex)}
                    style={{ backgroundColor: c.hex }}
                    className={`h-7 w-7 rounded-full transition-transform cursor-pointer ${
                      selectedColor === c.hex
                        ? "ring-2 ring-text-primary ring-offset-2 ring-offset-surface-1 scale-110"
                        : "opacity-80 hover:opacity-100"
                    }`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="default" disabled={!name.trim()}>
                Create Collection
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
