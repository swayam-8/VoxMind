import { useState } from "react"
import { Link } from "react-router-dom"
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
import { DEMO_RECORDINGS } from "@/lib/demo-data"

interface MessageEvidence {
  recordingId: string
  recordingTitle: string
  timestampSeconds: number
  timestampLabel: string
  quote: string
  similarity: number
}

interface ChatMessage {
  id: string
  sender: "user" | "assistant"
  text: string
  createdAt: string
  evidence?: MessageEvidence[]
}

const PROMPT_SUGGESTIONS = [
  "What were the latency benchmarks for faster-whisper int8?",
  "What are the enterprise data residency and compliance constraints?",
  "Why did the team standardize on a 600ms silence boundary?",
  "List all action items assigned to Devon Reed.",
]

let messageCounter = 0
function generateMessageId() {
  messageCounter += 1
  return `msg-id-${messageCounter}`
}

export function AskPage() {
  const [scope, setScope] = useState("all")
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [hasError, setHasError] = useState(false)

  const handleSend = (textToSend?: string) => {
    const query = textToSend || input
    if (!query.trim()) return

    const timeStr = "12:00 PM"
    const userMsg: ChatMessage = {
      id: generateMessageId(),
      sender: "user",
      text: query,
      createdAt: timeStr,
    }

    setMessages((prev) => [...prev, userMsg])
    if (!textToSend) setInput("")
    setIsThinking(true)
    setHasError(false)

    // Generate verified answer based on query
    setTimeout(() => {
      setIsThinking(false)

      let answerText = ""
      let evidenceList: MessageEvidence[] = []

      if (query.toLowerCase().includes("latency") || query.toLowerCase().includes("int8") || query.toLowerCase().includes("whisper")) {
        answerText =
          "According to the Q4 Voice Engine Architecture sync, testing confirmed that **faster-whisper int8 quantization on CPU achieved a 2.8x speedup** over PyTorch FP16 while maintaining a Word Error Rate (WER) strictly under 4.2%. This confirmed the decision to support local CPU execution for non-GPU hardware."
        evidenceList = [
          {
            recordingId: "rec-01",
            recordingTitle: "Q4 Voice Engine Architecture & Latency Benchmark",
            timestampSeconds: 7.2,
            timestampLabel: "00:07",
            quote:
              "With int8 compute on standard CPU nodes, we achieved a 2.8x speedup over PyTorch FP16 while maintaining a Word Error Rate under 4.2%.",
            similarity: 0.98,
          },
          {
            recordingId: "rec-01",
            recordingTitle: "Q4 Voice Engine Architecture & Latency Benchmark",
            timestampSeconds: 17.0,
            timestampLabel: "00:17",
            quote:
              "That confirms we can safely default to local CPU transcription for users running without dedicated NVIDIA hardware.",
            similarity: 0.95,
          },
        ]
      } else if (query.toLowerCase().includes("compliance") || query.toLowerCase().includes("residency")) {
        answerText =
          "In the enterprise compliance discovery session, VP David Kim specified that no raw audio or identifiable transcripts may leave their self-hosted VPC perimeter. Relayed cloud speech APIs represent an automatic audit failure, requiring self-contained, air-gapped container deployments."
        evidenceList = [
          {
            recordingId: "rec-02",
            recordingTitle: "Customer Discovery Interview: Enterprise Compliance Lead",
            timestampSeconds: 9.0,
            timestampLabel: "00:09",
            quote:
              "Our core constraint is simple: no raw audio or identifiable transcripts may ever leave our self-hosted VPC perimeter.",
            similarity: 0.99,
          },
        ]
      } else {
        answerText =
          "Based on recent recordings, Devon Reed tested silence pause detection at 600ms to eliminate non-speech hallucinations and was tasked with standardizing this filter in the audio normalization pipeline before Sprint 14 handoff."
        evidenceList = [
          {
            recordingId: "rec-01",
            recordingTitle: "Q4 Voice Engine Architecture & Latency Benchmark",
            timestampSeconds: 26.2,
            timestampLabel: "00:26",
            quote:
              "By splitting at silent pauses longer than 600 milliseconds, we eliminate hallucinations entirely on non-speech segments.",
            similarity: 0.96,
          },
        ]
      }

      const assistantMsg: ChatMessage = {
        id: generateMessageId(),
        sender: "assistant",
        text: answerText,
        createdAt: "12:01 PM",
        evidence: evidenceList,
      }

      setMessages((prev) => [...prev, assistantMsg])
    }, 1000)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] space-y-4">
      {/* Header & Scope Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              Ask VoxMind
            </h1>
            <Badge variant="violet" className="text-[10px]">
              Semantic Vector RAG
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-text-secondary">
            Cross-recording synthesis with verified source transcript links.
          </p>
        </div>

        {/* Scope Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted hidden sm:inline">Target Scope:</span>
          <div className="w-64">
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="h-8.5 text-xs">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Entire Library (All Recordings)</SelectItem>
                {DEMO_RECORDINGS.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Conversation Scroll Area */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-surface-1/50 p-4 sm:p-6 space-y-5">
        {messages.length === 0 ? (
          /* Empty / Prompt Suggestions State */
          <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-subtle text-accent border border-accent/20 mb-3">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-text-primary">
              What would you like to know from your recordings?
            </h3>
            <p className="mt-1 text-xs text-text-secondary leading-relaxed">
              Every synthesized claim is backed by precise audio timestamps linking directly to verified transcript passages.
            </p>

            <div className="mt-6 w-full space-y-2">
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider text-left pl-1">
                Suggested Prompts
              </div>
              {PROMPT_SUGGESTIONS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt)}
                  className="w-full p-2.5 rounded-lg border border-border bg-surface-1 text-left text-xs text-text-primary hover:border-accent/40 hover:bg-surface-2 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <span>{prompt}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-text-muted group-hover:text-accent transition-colors" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message Stream */
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-2xl rounded-xl p-4 space-y-2 ${
                  msg.sender === "user"
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "bg-surface-1 border border-border shadow-xs text-text-primary"
                }`}
              >
                <div className="flex items-center justify-between gap-4 text-[10px] opacity-70">
                  <span className="font-semibold uppercase tracking-wider">
                    {msg.sender === "user" ? "You" : "VoxMind Intelligence"}
                  </span>
                  <span>{msg.createdAt}</span>
                </div>

                <p className="text-sm leading-relaxed">{msg.text}</p>

                {/* Evidence Panel with Timestamp Links */}
                {msg.evidence && msg.evidence.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/50 space-y-2 text-left">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-accent uppercase tracking-wider">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Verified Audio Evidence ({msg.evidence.length})</span>
                    </div>

                    <div className="space-y-1.5">
                      {msg.evidence.map((ev, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-md bg-surface-2/70 border border-border text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-text-primary truncate flex items-center gap-1">
                              <Mic className="w-3 h-3 text-accent" />
                              {ev.recordingTitle}
                            </span>
                            <Link
                              to={`/app/recordings/${ev.recordingId}`}
                              className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-accent-subtle text-accent hover:bg-accent hover:text-white transition-colors"
                              title="Listen to exact audio snippet"
                            >
                              <Clock className="w-3 h-3" />
                              [{ev.timestampLabel}]
                              <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                            </Link>
                          </div>
                          <p className="italic text-text-secondary">
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
        )}

        {/* Thinking Skeleton */}
        {isThinking && (
          <div className="flex flex-col items-start max-w-xl">
            <div className="rounded-xl border border-border bg-surface-1 p-4 w-full space-y-2.5 animate-pulse">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-accent animate-spin" />
                <span className="text-xs text-text-muted">
                  Searching embeddings & retrieving citations...
                </span>
              </div>
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-1/2" />
            </div>
          </div>
        )}

        {hasError && (
          <div className="p-3 rounded-md bg-danger-subtle border border-danger/30 text-xs text-danger flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Ollama inference timed out. Please check local model connectivity.</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSend(messages[messages.length - 1]?.text)}
              className="h-7 text-xs"
            >
              <RotateCcw className="w-3 h-3 mr-1" /> Retry
            </Button>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="shrink-0 flex items-center gap-2 bg-surface-1 p-2 rounded-xl border border-border">
        <Input
          placeholder="Ask a question about decisions, benchmarks, or action items..."
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
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
