import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  Send,
  Clock,
  Mic,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ExternalLink,
  Search,
  XCircle,
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
import { apiClient, type ApiSearchMatch } from "@/lib/api-client";

interface MessageEvidence {
  recordingId: string;
  recordingTitle: string;
  timestampSeconds: number;
  timestampLabel: string;
  quote: string;
  similarity: number;
}

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  createdAt: string;
  evidence?: MessageEvidence[];
  sufficientEvidence?: boolean;
}

const PROMPT_SUGGESTIONS = [
  "What are the key takeaways from my recent meetings?",
  "Which questions are still waiting for an answer?",
  "What did we agree to do next?",
  "List all action items and key decisions made recently.",
];

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function getFormattedTime(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

let messageCounter = 0;
function generateMessageId() {
  messageCounter += 1;
  return `msg-id-${Date.now()}-${messageCounter}`;
}

export function AskPage() {
  const [scope, setScope] = useState("all");
  const [mode, setMode] = useState<"rag" | "search">("rag");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchResults, setSearchResults] = useState<ApiSearchMatch[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch real recordings for scope dropdown
  const { data: recordingsData } = useQuery({
    queryKey: ["recordings"],
    queryFn: () => apiClient.getRecordings({ per_page: 50 }),
  });
  const recordings = recordingsData?.data || [];

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isThinking) return;

    if (!textToSend) setInput("");
    setIsThinking(true);
    setHasError(false);
    setErrorMessage("");

    const targetScopeIds = scope === "all" ? undefined : [scope];

    if (mode === "search") {
      try {
        const res = await apiClient.search(query, {
          recording_ids: targetScopeIds,
          limit: 12,
          mode: "hybrid",
        });
        setSearchResults(res.data.results || []);
      } catch (err: unknown) {
        console.error("Semantic search failed:", err);
        setHasError(true);
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Failed to execute semantic search",
        );
      } finally {
        setIsThinking(false);
      }
      return;
    }

    // RAG Mode
    const timeStr = getFormattedTime();
    const userMsg: ChatMessage = {
      id: generateMessageId(),
      sender: "user",
      text: query,
      createdAt: timeStr,
    };

    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await apiClient.askKnowledge(query, {
        recording_ids: targetScopeIds,
        max_passages: 5,
      });

      const data = res.data;
      const citations: MessageEvidence[] = (data.citations || []).map((c) => ({
        recordingId: c.recording_id,
        recordingTitle: c.recording_title,
        timestampSeconds: c.start_time,
        timestampLabel: formatTimestamp(c.start_time),
        quote: c.quote,
        similarity: c.score,
      }));

      const assistantMsg: ChatMessage = {
        id: generateMessageId(),
        sender: "assistant",
        text: data.answer,
        createdAt: getFormattedTime(),
        evidence: citations,
        sufficientEvidence: data.sufficient_evidence,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      console.error("Ask knowledge failed:", err);
      setHasError(true);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Local AI service timed out or unavailable",
      );
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="feature-page intelligence-page flex flex-col min-h-[calc(100dvh-14rem)] space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4 shrink-0">
        <div>
          <p className="eyebrow mb-3">YOUR SECOND MIND</p>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              Connect the dots
            </h1>
            <Badge variant="violet" className="text-xs">
              Grounded in your recordings
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-text-secondary">
            One question. A whole library of perspective.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode Switcher */}
          <div className="flex items-center bg-surface-2 p-0.5 rounded-lg border border-border">
            <button
              onClick={() => setMode("rag")}
              className={`px-2.5 py-1 text-sm font-medium rounded-md transition-colors ${
                mode === "rag"
                  ? "bg-accent text-accent-foreground shadow-xs"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              <Sparkles className="w-5 h-5 inline mr-1" />
              Ask AI
            </button>
            <button
              onClick={() => setMode("search")}
              className={`px-2.5 py-1 text-sm font-medium rounded-md transition-colors ${
                mode === "search"
                  ? "bg-accent text-accent-foreground shadow-xs"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              <Search className="w-5 h-5 inline mr-1" />
              Passages
            </button>
          </div>

          {/* Scope Selector */}
          <div className="w-56">
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="h-8.5 text-sm">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  Entire Library ({recordings.length})
                </SelectItem>
                {recordings.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-surface-1/50 p-4 sm:p-6 space-y-5">
        {mode === "rag" ? (
          /* RAG Stream */
          messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto py-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-subtle text-accent border border-accent/20 mb-3">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-text-primary">
                What would you like to know from your recordings?
              </h3>
              <p className="mt-1 text-sm text-text-secondary leading-relaxed">
                Explore your conversations, connect ideas, and follow answers
                back to the moment they were said.
              </p>

              <div className="mt-6 w-full space-y-2">
                <div className="text-xs font-semibold text-text-muted uppercase tracking-wider text-left pl-1">
                  Suggested Questions
                </div>
                {PROMPT_SUGGESTIONS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(prompt)}
                    className="w-full p-2.5 rounded-lg border border-border bg-surface-1 text-left text-sm text-text-primary hover:border-accent/40 hover:bg-surface-2 transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <span>{prompt}</span>
                    <ArrowRight className="h-5 w-5 text-text-muted group-hover:text-accent transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col min-w-0 ${
                  msg.sender === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`w-full max-w-full sm:max-w-2xl rounded-xl p-3.5 sm:p-4 space-y-2 min-w-0 ${
                    msg.sender === "user"
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "bg-surface-1 border border-border shadow-xs text-text-primary"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 text-xs opacity-70">
                    <span className="font-semibold uppercase tracking-wider">
                      {msg.sender === "user" ? "You" : "VoxMind Intelligence"}
                    </span>
                    <span>{msg.createdAt}</span>
                  </div>

                  <p className="text-sm sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {msg.text}
                  </p>

                  {/* Insufficient Evidence Notice */}
                  {msg.sender === "assistant" &&
                    msg.sufficientEvidence === false && (
                      <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400 flex items-center gap-1.5">
                        <XCircle className="w-5 h-5 shrink-0" />
                        <span className="break-words">
                          No matching verified evidence was found in the
                          selected recordings.
                        </span>
                      </div>
                    )}

                  {/* Evidence Panel with Timestamp Links */}
                  {msg.evidence && msg.evidence.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-2 text-left min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-accent uppercase tracking-wider">
                        <HelpCircle className="w-5 h-5 shrink-0" />
                        <span>
                          Verified Audio Evidence ({msg.evidence.length})
                        </span>
                      </div>

                      <div className="space-y-1.5 min-w-0">
                        {msg.evidence.map((ev, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-md bg-surface-2/70 border border-border text-sm space-y-1 min-w-0"
                          >
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <span className="font-medium text-text-primary truncate flex items-center gap-1 min-w-0">
                                <Mic className="w-5 h-5 text-accent shrink-0" />
                                <span className="truncate">
                                  {ev.recordingTitle}
                                </span>
                              </span>
                              <Link
                                to={`/app/recordings/${ev.recordingId}?t=${ev.timestampSeconds}`}
                                className="inline-flex items-center gap-1 font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-accent-subtle text-accent hover:bg-accent hover:text-white transition-colors shrink-0"
                                title="Listen to exact audio snippet"
                              >
                                <Clock className="w-5 h-5" />[
                                {ev.timestampLabel}]
                                <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                              </Link>
                            </div>
                            <p className="italic text-text-secondary break-words">
                              "{ev.quote}"
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )
        ) : /* Passage Search Results */
        searchResults.length === 0 && !isThinking ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto py-16">
            <Search className="h-10 w-10 text-text-muted mb-3 opacity-60" />
            <h3 className="text-sm font-semibold text-text-primary">
              Search Audio Passages Semantically
            </h3>
            <p className="text-sm text-text-muted mt-1">
              Enter any natural-language phrase or keyword above to find exact
              transcript timestamps across your recordings.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-text-muted flex items-center justify-between px-1">
              <span>Passages Found ({searchResults.length})</span>
              <span className="text-xs">Ranked by Vector Similarity</span>
            </div>
            {searchResults.map((item) => (
              <div
                key={item.chunk_id}
                className="p-3.5 rounded-xl border border-border bg-surface-1 hover:border-accent/40 transition-colors space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mic className="h-5 w-5 text-accent shrink-0" />
                    <span className="font-semibold text-sm text-text-primary truncate">
                      {item.recording_title}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-xs py-0 px-1 font-mono"
                    >
                      {Math.round(item.score * 100)}% match
                    </Badge>
                  </div>

                  <Link
                    to={`/app/recordings/${item.recording_id}?t=${item.start_time}`}
                    className="inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-0.5 rounded bg-accent-subtle text-accent hover:bg-accent hover:text-white transition-colors shrink-0"
                  >
                    <Clock className="w-5 h-5" />
                    {formatTimestamp(item.start_time)} -{" "}
                    {formatTimestamp(item.end_time)}
                    <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                  </Link>
                </div>

                <p className="text-sm text-text-secondary leading-relaxed bg-surface-2/60 p-2.5 rounded-md font-mono whitespace-pre-wrap">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Thinking Skeleton */}
        {isThinking && (
          <div className="flex flex-col items-start max-w-xl">
            <div className="rounded-xl border border-border bg-surface-1 p-4 w-full space-y-2.5 animate-pulse">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent animate-spin" />
                <span className="text-sm text-text-muted">
                  Searching embeddings & synthesizing citations...
                </span>
              </div>
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-1/2" />
            </div>
          </div>
        )}

        {/* Error Alert */}
        {hasError && (
          <div className="p-3 rounded-md bg-danger-subtle border border-danger/30 text-sm text-danger flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>
                {errorMessage ||
                  "Local inference error. Please check Ollama and Redis connectivity."}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSend()}
              className="h-7 text-sm"
            >
              <RotateCcw className="w-5 h-5 mr-1" /> Retry
            </Button>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="shrink-0 flex items-center gap-2 bg-surface-1 p-2 rounded-xl border border-border">
        <Input
          placeholder={
            mode === "rag"
              ? "Ask a question about decisions, benchmarks, or commitments..."
              : "Search transcript passages by meaning or keyword..."
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="border-0 shadow-none bg-transparent focus-visible:ring-0 text-sm"
          disabled={isThinking}
        />
        <Button
          variant="default"
          size="icon"
          onClick={() => handleSend()}
          disabled={!input.trim() || isThinking}
          className="h-9 w-9 shrink-0"
          aria-label="Send query"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
