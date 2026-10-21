import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Mic, FolderOpen, ArrowRight, Sparkles } from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { DEMO_RECORDINGS, DEMO_COLLECTIONS } from "@/lib/demo-data"

interface CommandSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandSearch({ open, onOpenChange }: CommandSearchProps) {
  const [query, setQuery] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onOpenChange])

  const filteredRecordings = DEMO_RECORDINGS.filter((r) =>
    r.title.toLowerCase().includes(query.toLowerCase())
  )

  const filteredCollections = DEMO_COLLECTIONS.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  )

  const handleSelect = (href: string) => {
    onOpenChange(false)
    setQuery("")
    navigate(href)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border-border bg-surface-1 shadow-2xl">
        <DialogTitle className="sr-only">Quick Search Palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search across recordings, collections, and workspace destinations
        </DialogDescription>
        {/* Search Input Bar */}
        <div className="flex items-center border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-text-muted mr-3 shrink-0" />
          <input
            type="text"
            placeholder="Search recordings, transcripts, collections... (Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            autoFocus
          />
          <span className="text-[10px] font-mono text-text-muted bg-surface-2 px-1.5 py-0.5 rounded border border-border">
            ESC
          </span>
        </div>

        {/* Results Area */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-3">
          {/* Recordings */}
          {filteredRecordings.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                Recordings
              </div>
              <div className="space-y-0.5">
                {filteredRecordings.map((rec) => (
                  <button
                    key={rec.id}
                    onClick={() => handleSelect(`/app/recordings/${rec.id}`)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md text-left text-sm hover:bg-surface-2 group transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Mic className="h-4 w-4 text-accent shrink-0" />
                      <span className="text-text-primary truncate font-medium">
                        {rec.title}
                      </span>
                    </div>
                    <span className="text-xs text-text-muted group-hover:text-text-primary flex items-center gap-1 shrink-0 ml-2">
                      Jump <ArrowRight className="h-3 w-3" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Collections */}
          {filteredCollections.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                Collections
              </div>
              <div className="space-y-0.5">
                {filteredCollections.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => handleSelect("/app/collections")}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md text-left text-sm hover:bg-surface-2 group transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FolderOpen className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span className="text-text-primary truncate font-medium">
                        {col.name}
                      </span>
                    </div>
                    <span className="text-xs text-text-muted group-hover:text-text-primary flex items-center gap-1 shrink-0 ml-2">
                      View <ArrowRight className="h-3 w-3" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div>
            <div className="px-3 py-1.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
              Navigation
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => handleSelect("/app/ask")}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md text-left text-sm hover:bg-surface-2 group transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <span className="text-text-primary font-medium">Ask VoxMind (Cross-Library Query)</span>
                </div>
                <ArrowRight className="h-3 w-3 text-text-muted" />
              </button>
            </div>
          </div>

          {filteredRecordings.length === 0 && filteredCollections.length === 0 && (
            <div className="py-8 text-center text-sm text-text-muted">
              No recordings or collections match "{query}".
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
