import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Mic, ArrowRight, Sparkles, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { apiClient, type ApiSearchMatch } from "@/lib/api-client";

interface CommandSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function CommandSearch({ open, onOpenChange }: CommandSearchProps) {
  const [query, setQuery] = useState("");
  const [passageResults, setPassageResults] = useState<ApiSearchMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

  // Fetch real recordings
  const { data: recData } = useQuery({
    queryKey: ["recordings"],
    queryFn: () => apiClient.getRecordings({ per_page: 50 }),
    enabled: open && !!localStorage.getItem("voxmind_access_token"),
  });
  const recordings = recData?.data || [];

  // Global hotkey: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  // Debounced semantic search
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) return;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiClient.search(trimmed, {
          limit: 4,
          mode: "hybrid",
        });
        setPassageResults(res.data.results || []);
      } catch (err) {
        console.error("Command search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  const filteredRecordings = recordings.filter((r) =>
    r.title.toLowerCase().includes(query.toLowerCase()),
  );

  const handleSelect = (href: string) => {
    onOpenChange(false);
    setQuery("");
    navigate(href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-[calc(100vw-2rem)] sm:w-full p-0 overflow-hidden border-border bg-surface-1 shadow-2xl">
        <DialogTitle className="sr-only">Quick Search Palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search across recordings, transcripts, and semantic audio passages
        </DialogDescription>

        {/* Search Input Bar */}
        <div className="flex items-center border-b border-border px-5 py-5">
          <Search className="h-6 w-6 text-text-muted mr-4 shrink-0" />
          <input
            type="text"
            aria-label="Search recordings and transcripts"
            placeholder="Search recordings, spoken passages, or questions... (Esc to close)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim().length < 3) {
                setPassageResults([]);
              }
            }}
            className="w-full bg-transparent text-base text-text-primary placeholder:text-text-muted focus:outline-none"
            autoFocus
          />
          <span className="text-xs font-mono text-text-muted bg-surface-2 px-1.5 py-0.5 rounded border border-border">
            ESC
          </span>
        </div>

        {/* Results Area */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-3">
          {/* Spoken Transcript Passages (Semantic Search Results) */}
          {passageResults.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-semibold text-accent uppercase tracking-wider flex items-center justify-between">
                <span>Spoken Transcript Passages</span>
                {isSearching && (
                  <span className="text-xs animate-pulse">Searching...</span>
                )}
              </div>
              <div className="space-y-1">
                {passageResults.map((match) => (
                  <button
                    key={match.chunk_id}
                    onClick={() =>
                      handleSelect(
                        `/app/recordings/${match.recording_id}?t=${match.start_time}`,
                      )
                    }
                    className="w-full p-2.5 rounded-lg border border-border bg-surface-2/60 hover:bg-surface-2 hover:border-accent/40 text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-semibold text-text-primary truncate">
                        {match.recording_title}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-xs text-accent bg-accent-subtle px-1.5 py-0.5 rounded shrink-0">
                        <Clock className="w-2.5 h-2.5" />[
                        {formatTime(match.start_time)}]
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary line-clamp-2 italic">
                      "{match.text.replace(/\n/g, " ")}"
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recordings Match */}
          {filteredRecordings.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
                Recordings
              </div>
              <div className="space-y-0.5">
                {filteredRecordings.slice(0, 5).map((rec) => (
                  <button
                    key={rec.id}
                    onClick={() => handleSelect(`/app/recordings/${rec.id}`)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md text-left text-sm hover:bg-surface-2 group transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Mic className="h-5 w-5 text-accent shrink-0" />
                      <span className="text-text-primary truncate font-medium">
                        {rec.title}
                      </span>
                    </div>
                    <span className="text-sm text-text-muted group-hover:text-text-primary flex items-center gap-1 shrink-0 ml-2">
                      Jump <ArrowRight className="h-5 w-5" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div>
            <div className="px-3 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
              AI Tools
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => handleSelect("/app/ask")}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md text-left text-sm hover:bg-surface-2 group transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="h-5 w-5 text-accent" />
                  <span className="text-text-primary font-medium">
                    Ask MeetingBrief (Evidence RAG)
                  </span>
                </div>
                <ArrowRight className="h-5 w-5 text-text-muted" />
              </button>
            </div>
          </div>

          {query.trim().length > 0 &&
            filteredRecordings.length === 0 &&
            passageResults.length === 0 &&
            !isSearching && (
              <div className="py-8 text-center text-sm text-text-muted">
                No recordings or transcript passages match "{query}".
              </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
