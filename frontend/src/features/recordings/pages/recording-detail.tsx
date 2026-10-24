import { downloadRecordingMarkdown, printRecordingPdf } from "../lib/export-recording";
import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Search,
  Sparkles,
  Download,
  Copy,
  FolderOpen,
  Calendar,
  Layers,
  Clock,
  RotateCcw,
  RotateCw,
  AlertCircle,
  Send,
  FileText,
  ListChecks,
  MessageSquare,
  Target,
  Globe,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InsightSummary, InsightEmptyState } from "../components/insight-summary";
import { AudioPlayer } from "@/features/recordings/components/audio-player";
import { toast } from "@/hooks/use-toast";
import { apiClient, type ApiRecording, type ApiResponse, type ApiRecordingQuestion } from "@/lib/api-client";

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const LANGUAGE_NAMES: Record<string, string> = {
  hi: "Hindi (हिन्दी)",
  pa: "Punjabi (ਪੰਜਾਬੀ)",
  en: "English",
  es: "Spanish (Español)",
  fr: "French (Français)",
  de: "German (Deutsch)",
  zh: "Mandarin Chinese (中文)",
  ja: "Japanese (日本語)",
  ar: "Arabic (العربية)",
  pt: "Portuguese (Português)",
  ru: "Russian (Русский)",
  it: "Italian (Italiano)",
  bn: "Bengali (বাংলা)",
  mr: "Marathi (मराठी)",
  ta: "Tamil (தமிழ்)",
  te: "Telugu (తెలుగు)",
  ur: "Urdu (اردو)",
};

function getLanguageLabel(code?: string | null): string {
  if (!code) return "Auto-Detected";
  const c = code.toLowerCase().trim();
  return LANGUAGE_NAMES[c] || `Native (${code.toUpperCase()})`;
}

export function RecordingDetailPage() {
  const { id } = useParams<{ id: string }>();

  const queryClient = useQueryClient();

  // Fetch real recording from REST API with dynamic polling while queue/processing
  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["recording", id],
    queryFn: () =>
      id ? apiClient.getRecording(id) : Promise.reject(new Error("No ID")),
    enabled: !!id,
    refetchInterval: (query) => {
      const rec = query.state.data?.data;
      const status = rec?.status;
      const summaryStatus = rec?.summaries?.[0]?.status;
      const isProcessing =
        status === "queued" ||
        status === "processing" ||
        status === "transcribing" ||
        summaryStatus === "pending" ||
        summaryStatus === "processing" ||
        rec?.analysis_status === "pending" ||
        rec?.analysis_status === "processing" ||
        rec?.index_status === "indexing" ||
        (rec?.analysis_status === "completed" && rec?.index_status === "pending");
      return isProcessing ? 2000 : false;
    },
  });

  // Retry transcription mutation
  const retryMutation = useMutation({
    mutationFn: () =>
      id ? apiClient.retryRecording(id) : Promise.reject(new Error("No ID")),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recording", id] });
      toast({
        title: "Transcription Re-enqueued",
        description:
          "Background worker has scheduled speech-to-text processing.",
        variant: "success",
      });
    },
    onError: (err) => {
      toast({
        title: "Retry Failed",
        description:
          err instanceof Error ? err.message : "Could not retry transcription",
        variant: "danger",
      });
    },
  });

  // Regenerate AI analysis mutation
  const regenerateMutation = useMutation({
    mutationFn: () =>
      id
        ? apiClient.regenerateAnalysis(id)
        : Promise.reject(new Error("No ID")),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recording", id] });
      toast({
        title: "AI Analysis Enqueued",
        description:
          "Your analysis is in the queue. Results refresh here automatically.",
        variant: "success",
      });
    },
    onError: (err) => {
      toast({
        title: "Regeneration Failed",
        description:
          err instanceof Error ? err.message : "Could not regenerate insights",
        variant: "danger",
      });
    },
  });

  // Toggle action item mutation
  const toggleActionMutation = useMutation({
    mutationFn: ({
      actionId,
      completed,
    }: {
      actionId: string;
      completed?: boolean;
    }) =>
      id
        ? apiClient.toggleActionItem(id, actionId, completed)
        : Promise.reject(new Error("No ID")),
    onMutate: ({ actionId, completed }) => {
      void queryClient.cancelQueries({ queryKey: ["recording", id] });
      const previous = queryClient.getQueryData<ApiResponse<ApiRecording>>(["recording", id]);
      queryClient.setQueryData<ApiResponse<ApiRecording>>(["recording", id], (cached) => cached ? {
        ...cached, data: { ...cached.data, action_items: cached.data.action_items?.map((action) =>
          action.id === actionId ? { ...action, completed: completed ?? !action.completed } : action,
        ) },
      } : cached);
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(["recording", id], context.previous);
      toast({ title: "Could not update action", description: error.message, variant: "danger" });
    },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ["recording", id] }); },
  });

  // Ask question mutation
  const [questionText, setQuestionText] = useState("");
  const conversationRef = useRef<HTMLDivElement>(null);
  const { data: historyResponse, isLoading: historyLoading, isFetching: historyFetching, isError: historyFailed, refetch: reloadHistory } = useQuery({
    queryKey: ["recording-questions", id],
    queryFn: () => apiClient.getRecordingQuestions(id!),
    enabled: !!id,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const questionHistory = historyResponse?.data || [];

  const askMutation = useMutation({
    mutationFn: (q: string) =>
      id ? apiClient.askRecording(id, q) : Promise.reject(new Error("No ID")),
    onSuccess: (res) => {
      const key = ["recording-questions", res.data.recording_id];
      queryClient.setQueryData<ApiResponse<ApiRecordingQuestion[]>>(key, (cached) => ({
        success: true, message: "Conversation saved", data: [
          ...(cached?.data || []).filter((item) => item.id !== res.data.id), res.data,
        ],
      }));
      queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (err) => {
      toast({
        title: "Question Answering Failed",
        description:
          err instanceof Error ? err.message : "Could not answer question",
        variant: "danger",
      });
    },
  });

  const recording = response?.data;
  const { data: audioTicket } = useQuery({
    queryKey: ["recording-audio-ticket", id],
    queryFn: () => apiClient.getAudioTicket(id!),
    enabled: !!id && !!recording,
    staleTime: 10 * 60000,
    refetchInterval: 12 * 60000,
    retry: 1,
  });

  useEffect(() => {
    if (askMutation.isSuccess && conversationRef.current) {
      conversationRef.current.scrollTo({ top: conversationRef.current.scrollHeight,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }, [questionHistory.length, askMutation.isSuccess]);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);

  const activeSegmentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll active segment into view when audio is playing
  useEffect(() => {
    if (autoScroll && isPlaying && activeSegmentRef.current) {
      activeSegmentRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentTime, autoScroll, isPlaying]);


  const handleSeek = (time: number) => {
    setCurrentTime(time);
    toast({
      title: "Audio Seek",
      description: `Playback navigated to ${formatTimestamp(time)}`,
      duration: 1500,
    });
  };

  const [searchParams] = useSearchParams();
  useEffect(() => {
    const t = searchParams.get("t");
    if (t) {
      const sec = parseFloat(t);
      if (!isNaN(sec) && sec >= 0) {
        const timer = setTimeout(() => handleSeek(sec), 50);
        return () => clearTimeout(timer);
      }
    }
  }, [searchParams]);

  const copyTranscriptToClipboard = () => {
    if (!recording?.segments) return;
    const fullText = recording.segments
      .map((s) => `[${formatTimestamp(s.start_time)}] ${s.speaker}: ${s.text}`)
      .join("\n\n");

    navigator.clipboard.writeText(fullText);
    toast({
      title: "Transcript Copied",
      description:
        "Full transcript with speaker timestamps copied to clipboard.",
      variant: "success",
    });
  };

  if (isLoading) {
    return (
      <div className="feature-page space-y-6">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="space-y-1.5 w-1/3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
          <div className="lg:col-span-5">
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !recording) {
    return (
      <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-danger/30 bg-surface-1">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-subtle text-danger border border-danger/20 mb-3">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-text-primary">
          Recording Not Found
        </h3>
        <p className="max-w-sm mt-1 text-sm text-text-secondary">
          {error instanceof Error
            ? error.message
            : "The requested audio recording could not be retrieved from the database."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          <Link to="/app/recordings">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="w-5 h-5 mr-1" /> Return to Library
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCcw className="w-5 h-5 mr-1" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const segments = recording.segments || [];
  const filteredSegments = segments.filter(
    (s) =>
      s.text.toLowerCase().includes(transcriptSearch.toLowerCase()) ||
      s.speaker.toLowerCase().includes(transcriptSearch.toLowerCase()),
  );

  const summary = recording.summaries?.[0];
  const actionItems = recording.action_items || [];
  const analysisStatus = recording.analysis_status ?? summary?.status ?? (summary ? "completed" : undefined);
  const analysisBusy = regenerateMutation.isPending || analysisStatus === "pending" || analysisStatus === "processing";
  const audioBusy = ["queued", "processing", "transcribing"].includes(recording.status);
  const completedActions = actionItems.filter((action) => action.completed).length;
  const insightEmpty = (kind: "decisions" | "actions") => (
    <InsightEmptyState
      busy={audioBusy || analysisBusy}
      title={audioBusy ? "Waiting for your transcript" : analysisBusy ? "Your insights are on their way" : analysisStatus === "failed" ? "Analysis needs another try" : analysisStatus === "completed" ? `No explicit ${kind === "actions" ? "action items" : "decisions"} found` : "Generate insights from this recording"}
      description={audioBusy ? "Insights become available after the audio is transcribed." : analysisBusy ? "This panel updates automatically when the analysis finishes." : analysisStatus === "failed" ? "The analysis could not finish. Check the message above, then use Regenerate to try again." : analysisStatus === "completed" ? `Only ${kind === "actions" ? "tasks assigned" : "decisions made"} in the conversation appear here.` : "Use Regenerate once the transcript is ready."}
    />
  );

  return (
    <div className="feature-page recording-detail-page space-y-5 sm:space-y-6 min-w-0 max-w-full">
      {/* Top Navigation & Actions Bar */}
      <div className="recording-heading flex flex-col xl:flex-row xl:justify-between gap-4 border-b border-border">
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <Link to="/app/recordings" className="shrink-0 mt-0.5 sm:mt-0">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-text-secondary"
              aria-label="Back to recordings"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <span className="recording-eyebrow">Recording workspace</span>
            <h1 className="recording-title text-text-primary">
              {recording.title}
            </h1>
            <div className="recording-badges flex flex-wrap items-center">
              {recording.source_provider && (
                <Badge variant="outline">
                  Imported from{" "}
                  {recording.source_provider === "google-meet"
                    ? "Google Meet"
                    : recording.source_provider === "zoom"
                      ? "Zoom"
                      : "Webex"}
                </Badge>
              )}
              {(recording.status === "ready" ||
                recording.status === "completed") && (
                <Badge variant="success" className="text-xs">
                  Completed
                </Badge>
              )}
              {(recording.status === "transcribing" ||
                recording.status === "processing") && (
                <Badge variant="warning" className="text-xs animate-pulse">
                  Processing...
                </Badge>
              )}
              {recording.status === "queued" && (
                <Badge variant="secondary" className="text-xs">
                  Queued
                </Badge>
              )}
              {recording.status === "failed" && (
                <Badge variant="danger" className="text-xs">
                  Failed
                </Badge>
              )}

              {/* Native Language Badge */}
              <Badge
                variant="outline"
                className="text-xs font-mono flex items-center gap-1 border-accent/30 text-accent"
              >
                <Globe className="w-5 h-5" />
                {getLanguageLabel(recording.language)}
              </Badge>

              {/* Vector Indexing Status */}
              {recording.index_status === "completed" && (
                <Badge variant="violet" className="text-xs">
                  Search ready
                </Badge>
              )}
              {recording.index_status === "indexing" && (
                <Badge variant="warning" className="text-xs animate-pulse">
                  Preparing search...
                </Badge>
              )}
              {recording.index_status === "failed" && (
                <Badge variant="danger" className="text-xs">
                  Search unavailable
                </Badge>
              )}
            </div>
            <div className="recording-meta flex flex-wrap items-center text-xs text-text-muted">
              {recording.collection_name && (
                <>
                  <span className="flex items-center gap-1 text-text-secondary">
                    <FolderOpen className="h-5 w-5 text-accent" />
                    {recording.collection_name}
                  </span>
                  <span>•</span>
                </>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-5 w-5" />
                {new Date(recording.created_at).toLocaleDateString()}
              </span>
              <span>•</span>
              <span className="font-mono text-xs text-text-muted truncate max-w-[160px] sm:max-w-xs">
                {recording.filename}
              </span>
            </div>
          </div>
        </div>

        <div className="recording-tools flex items-center flex-wrap shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={copyTranscriptToClipboard}
            className="text-sm h-8"
            disabled={segments.length === 0}
          >
            <Copy className="w-5 h-5 mr-1.5" />
            Copy text
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="text-sm h-8"
                disabled={historyFetching || historyFailed || askMutation.isPending}
                title="Export summary, decisions, actions, and your saved Q&A">
                <Download className="w-5 h-5 mr-1.5" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => {
                try { printRecordingPdf({ ...recording, questions: questionHistory }); }
                catch (error) { toast({ title: "Could not open report", description: error instanceof Error ? error.message : "Please try again.", variant: "danger" }); }
              }}>PDF report — all four sections</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => downloadRecordingMarkdown({ ...recording, questions: questionHistory })}>Markdown with transcript</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Live Processing and Failure State Alerts */}
      {recording.status === "failed" && (
        <div className="p-4 rounded-xl border border-danger/30 bg-danger-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertCircle className="w-5 h-5 text-danger shrink-0" />
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-danger">
                Transcription Failed
              </h4>
              <p className="text-sm text-text-secondary mt-0.5 break-words">
                {recording.error_message ||
                  "An unexpected error occurred during audio transcription."}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => retryMutation.mutate()}
            isLoading={retryMutation.isPending}
            className="text-sm text-danger border-danger/40 hover:bg-danger/10 shrink-0 self-end sm:self-center"
          >
            <RotateCw className="w-5 h-5 mr-1" /> Retry Transcription
          </Button>
        </div>
      )}

      {audioBusy && (
        <ActivityIndicator kind="audio"
          title={recording.status === "queued" ? "Your recording is in line" : "Listening to your recording"}
          description={recording.status === "queued" ? "Transcription starts automatically when a worker is available." : "Turning speech into a timestamped transcript. You can keep this page open; results appear automatically."}
        />
      )}

      {/* Main 2-Column Responsive Workspace Grid */}
      <div className="recording-workspace">
        {/* Playback and transcript */}
        <div className="recording-playback min-w-0">
          {/* Interactive Audio Player with Real Sound Playback */}
          <AudioPlayer
            className="detail-panel recording-player"
            title={recording.title}
            durationSeconds={recording.duration_seconds || 1}
            currentTime={currentTime}
            onSeek={handleSeek}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            playbackRate={playbackRate}
            onChangePlaybackRate={setPlaybackRate}
            audioSrc={id && audioTicket?.data?.ticket ? apiClient.audioUrl(id, audioTicket.data.ticket) : undefined}
            onTimeUpdate={(t) => setCurrentTime(t)}
          />

          {/* Interactive Timestamped Transcript Panel */}
          <div className="detail-panel transcript-panel border border-border space-y-4 min-w-0">
            <div className="panel-header transcript-header border-b border-border-subtle">
              <div className="panel-heading">
                <span className="panel-icon"><Layers aria-hidden="true" /></span>
                <div>
                  <h3>Synchronized transcript</h3>
                  <p>Every word, connected to the moment.</p>
                </div>
              </div>

              <div className="transcript-controls">
                {/* Auto-scroll toggle */}
                <button
                  type="button"
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`px-2 py-1 rounded text-xs font-mono border transition-colors flex items-center gap-1 ${
                    autoScroll
                      ? "bg-accent-subtle text-accent border-accent/30"
                      : "bg-surface-2 text-text-muted border-border"
                  }`}
                  aria-pressed={autoScroll}
                  title="Toggle auto-scroll with audio playback"
                >
                  <Radio className="w-5 h-5" />
                  <span>Auto-scroll</span>
                </button>

                {/* In-Transcript Search */}
                <div className="relative flex-1 sm:w-52">
                  <Search className="absolute left-2.5 top-2.5 h-5 w-5 text-text-muted" />
                  <Input
                    aria-label="Filter transcript"
                    placeholder="Filter dialogue..."
                    value={transcriptSearch}
                    onChange={(e) => setTranscriptSearch(e.target.value)}
                    className="pl-8 h-8 text-sm bg-surface-2"
                  />
                </div>
              </div>
            </div>

            {/* Segments Scroll Container */}
            <div className="transcript-list max-h-[620px] overflow-y-auto space-y-2">
              {segments.length === 0 ? (
                <div className="py-12 text-center text-sm text-text-muted space-y-2">
                  {recording.status === "failed" ? (
                    <p className="text-danger">
                      Transcription failed. Click 'Retry Transcription' above to
                      re-attempt.
                    </p>
                  ) : recording.status === "processing" ||
                    recording.status === "transcribing" ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      <p className="text-text-secondary">
                        Generating timestamped dialogue segments...
                      </p>
                    </div>
                  ) : recording.status === "queued" ? (
                    <p>Recording is queued for speech transcription.</p>
                  ) : (
                    <p>No speech detected in this recording.</p>
                  )}
                </div>
              ) : filteredSegments.length === 0 ? (
                <div className="py-8 text-center text-sm text-text-muted">
                  No dialogue matches "{transcriptSearch}".
                </div>
              ) : (
                filteredSegments.map((seg) => {
                  const sTime =
                    (seg as any).start_time ?? (seg as any).startTime ?? 0;
                  const eTime =
                    (seg as any).end_time ?? (seg as any).endTime ?? 0;
                  const conf = (seg as any).confidence ?? 1.0;
                  const isActive = currentTime >= sTime && currentTime <= eTime;

                  return (
                    <div
                      key={seg.id}
                      ref={isActive ? activeSegmentRef : undefined}
                      className={`transcript-segment transition-colors rounded-lg ${
                        isActive
                          ? "bg-accent-subtle/80 border border-accent/40 shadow-xs ring-1 ring-accent/20"
                          : "hover:bg-surface-2/60 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            onClick={() => handleSeek(sTime)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-xs font-semibold bg-surface-2 text-accent border border-accent/20 hover:bg-accent hover:text-accent-foreground transition-all cursor-pointer shrink-0"
                            title="Jump audio to this timestamp"
                          >
                            <Clock className="w-5 h-5" />
                            {formatTimestamp(sTime)}
                          </button>
                          <span className="text-sm font-semibold text-text-primary truncate">
                            {seg.speaker}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-text-muted shrink-0">
                          {(conf * 100).toFixed(0)}% conf
                        </span>
                      </div>

                      <p className="text-sm text-text-secondary leading-relaxed pl-1 break-words font-sans">
                        {seg.text}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Recording insights */}
        <div className="detail-panel intelligence-panel border border-border space-y-4 min-w-0">
          <div className="panel-header border-b border-border-subtle">
            <div className="panel-heading">
              <span className="panel-icon"><Sparkles aria-hidden="true" /></span>
              <div>
                <h3>Voice intelligence</h3>
                <p>A clearer view of your conversation.</p>
              </div>
            </div>
            <div className="insight-regenerate">
              <Button
                variant="outline"
                size="sm"
                onClick={() => regenerateMutation.mutate()}
                isLoading={regenerateMutation.isPending}
                disabled={analysisBusy || segments.length === 0}
                className="h-7 text-sm px-2"
                title="Generate a fresh summary, decisions, and actions"
              >
                <RotateCw className="w-5 h-5 mr-1" /> Regenerate
              </Button>
            </div>
          </div>

          {analysisBusy && !audioBusy && (
            <ActivityIndicator
              title={analysisStatus === "pending" ? "Getting your insights ready" : "Finding the moments that matter"}
              description="Preparing your summary, decisions, and action items. This panel updates automatically."
            />
          )}
          {analysisStatus === "failed" && (
            <div className="p-4 rounded-lg bg-danger-subtle border border-danger/30 space-y-2" role="alert">
              <div className="flex items-center gap-2 text-danger font-semibold text-sm"><AlertCircle className="h-5 w-5 shrink-0" /> Analysis could not finish</div>
              <p className="text-sm text-text-secondary break-words">{recording.analysis_error || summary?.error_message || "Check that the AI model is ready, then regenerate this recording’s analysis."}</p>
              <Button variant="outline" size="sm" disabled={regenerateMutation.isPending || !segments.length} onClick={() => regenerateMutation.mutate()}>Retry analysis</Button>
            </div>
          )}

          <dl className="insight-metrics" aria-label="Recording insights">
            <div><dt>Key takeaways</dt><dd>{summary?.key_takeaways?.length ?? (analysisStatus === "completed" ? 0 : "—")}</dd></div>
            <div><dt>Decisions made</dt><dd>{summary?.decisions?.length ?? (analysisStatus === "completed" ? 0 : "—")}</dd></div>
            <div><dt>Action items</dt><dd>{analysisStatus === "completed" || actionItems.length ? actionItems.length : "—"}</dd></div>
          </dl>

          <Tabs defaultValue="summary" className="insight-tabs w-full">
            <TabsList className="insight-tablist w-full" aria-label="Recording features">
              <TabsTrigger value="summary"><FileText aria-hidden="true" /> Summary</TabsTrigger>
              <TabsTrigger value="decisions"><Target aria-hidden="true" /> Decisions</TabsTrigger>
              <TabsTrigger value="actions"><ListChecks aria-hidden="true" /> Actions</TabsTrigger>
              <TabsTrigger value="ask"><MessageSquare aria-hidden="true" /> Ask AI</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="insight-content space-y-5">
              <InsightSummary summary={summary} placeholder={analysisBusy ? "Your summary is being prepared…" : audioBusy ? "Your summary appears after transcription and analysis." : analysisStatus === "failed" ? "Regenerate the analysis to create a summary." : "Use Regenerate to create a summary from the transcript."} />
            </TabsContent>

            {/* Tab 2: Key Decisions */}
            <TabsContent value="decisions" className="insight-content space-y-3">
              {!summary?.decisions || summary.decisions.length === 0 ? (
                insightEmpty("decisions")
              ) : (
                summary.decisions.map((dec, i) => {
                  const ts = dec.source_timestamp ?? dec.sourceTimestamp;
                  return (
                    <div
                      key={i}
                      className="insight-card decision-card space-y-2"
                      style={{ animationDelay: `${Math.min(i, 6) * 45}ms` }}
                    >
                      <span className="decision-index">Decision {String(i + 1).padStart(2, "0")}</span>
                      <div className="decision-heading flex items-start justify-between gap-2">
                        <div className="flex items-start gap-1.5 min-w-0">
                          <Target className="w-5 h-5 text-accent mt-0.5 shrink-0" />
                          <h5 className="text-sm font-bold text-text-primary leading-snug break-words">
                            {dec.decision}
                          </h5>
                        </div>
                        {ts !== undefined && ts !== null && (
                          <button
                            onClick={() => handleSeek(Number(ts))}
                            className="source-link shrink-0 font-mono cursor-pointer"
                            title="Seek audio to verified decision source"
                          >
                            [{formatTimestamp(Number(ts))}]
                          </button>
                        )}
                      </div>
                      {dec.context && (
                        <p className="decision-context text-sm text-text-secondary break-words">
                          {dec.context}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </TabsContent>

            {/* Tab 3: Action Items Checklist */}
            <TabsContent value="actions" className="insight-content space-y-3">
              {!!actionItems.length && (
                <div className="action-progress">
                  <div><strong>Follow through</strong><span aria-live="polite">{completedActions} of {actionItems.length} complete</span></div>
                  <div className="action-progress-track" role="progressbar" aria-label="Completed action items" aria-valuemin={0} aria-valuemax={actionItems.length} aria-valuenow={completedActions}>
                    <span style={{ width: `${completedActions / actionItems.length * 100}%` }} />
                  </div>
                </div>
              )}
              {actionItems.length === 0 ? (
                insightEmpty("actions")
              ) : (
                actionItems.map((act) => {
                  const ts = act.source_timestamp;
                  return (
                    <div
                      key={act.id}
                      className="insight-card action-card space-y-2"
                      data-completed={act.completed}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          aria-label={`Mark "${act.task}" as ${act.completed ? "incomplete" : "complete"}`}
                          disabled={toggleActionMutation.isPending || analysisBusy}
                          checked={act.completed}
                          onChange={() =>
                            toggleActionMutation.mutate({
                              actionId: act.id,
                              completed: !act.completed,
                            })
                          }
                          className="mt-0.5 h-4 w-4 rounded border-border text-accent focus:ring-accent accent-accent cursor-pointer shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-semibold leading-snug break-words ${
                              act.completed
                                ? "line-through text-text-muted"
                                : "text-text-primary"
                            }`}
                          >
                            {act.task}
                          </p>
                        </div>
                      </div>

                      <div className="action-meta flex items-center justify-between text-xs text-text-muted border-t border-border/40 gap-2">
                        <span className="text-text-secondary font-medium truncate">
                          Assignee: {act.assignee || "Unassigned"}
                          {act.due_date && <span className="block mt-1">Due: {act.due_date}</span>}
                        </span>
                        {ts !== undefined && ts !== null && (
                          <button
                            type="button"
                            onClick={() => handleSeek(Number(ts))}
                            className="source-link font-mono cursor-pointer shrink-0"
                            title="Seek to audio where task was assigned"
                          >
                            [{formatTimestamp(Number(ts))}]
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </TabsContent>

            {/* Tab 4: Transcript Question Answering */}
            <TabsContent value="ask" className="insight-content space-y-4">
              <div className="ask-intro">
                <span className="panel-icon"><MessageSquare aria-hidden="true" /></span>
                <div><h4>Ask your recording</h4><p>Find the answer. Go back to the source.</p></div>
              </div>
              <div className="question-composer space-y-3">
                <div className="flex gap-2">
                  <Input
                    id="recording-question"
                    aria-label="Ask about this recording"
                    placeholder="Ask about this recording..."
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing && !askMutation.isPending && questionText.trim() && segments.length) {
                        askMutation.mutate(questionText.trim());
                      }
                    }}
                    disabled={askMutation.isPending || !segments.length}
                    className="h-8 text-sm bg-surface-2 flex-1"
                  />
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      if (questionText.trim()) {
                        askMutation.mutate(questionText.trim());
                      }
                    }}
                    isLoading={askMutation.isPending}
                    disabled={!questionText.trim() || !segments.length}
                    className="h-8 text-sm shrink-0"
                  >
                    <Send className="w-5 h-5 mr-1" /> Ask
                  </Button>
                </div>
                {!questionHistory.length && <div className="question-suggestions" aria-label="Suggested questions">
                  {["What was decided?", "What should we do next?", "What are the key points?"].map((question) => (
                    <button key={question} type="button" disabled={askMutation.isPending || !segments.length} onClick={() => {
                      setQuestionText(question);
                      document.getElementById("recording-question")?.focus();
                    }}>{question}</button>
                  ))}
                </div>}
                <p className="text-xs text-text-muted">
                  {segments.length ? "Answers use this recording’s transcript. Evidence links appear when available." : "You can ask a question once the transcript is ready."}
                </p>
              </div>

              {askMutation.isPending && (
                <div className="space-y-3">
                  <p className="text-sm text-text-secondary"><strong>Your question:</strong> {askMutation.variables}</p>
                  <ActivityIndicator title="Thinking through your question" description="Reading this transcript and gathering the evidence for your answer." />
                </div>
              )}
              {askMutation.isError && (
                <div role="alert" className="p-4 rounded-lg border border-danger/30 bg-danger-subtle text-sm space-y-2">
                  <p>{askMutation.error.message}</p>
                  <Button size="sm" variant="outline" onClick={() => askMutation.mutate(questionText.trim())} disabled={!questionText.trim()}>Try question again</Button>
                </div>
              )}
              <section aria-label="Saved questions and answers" className="space-y-3">
                <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
                  <h4 className="text-sm font-semibold text-text-primary">Questions & answers</h4>
                  <span className="text-xs text-text-muted" aria-live="polite">{questionHistory.length} saved</span>
                </div>
                {historyLoading && <p role="status" className="text-sm text-text-muted">Loading your conversation…</p>}
                {historyFailed && <div role="alert" className="space-y-2 text-sm text-danger"><p>Could not load your saved conversation.</p><Button size="sm" variant="outline" onClick={() => reloadHistory()}>Reload conversation</Button></div>}
                {!historyLoading && !historyFailed && !questionHistory.length && !askMutation.isPending && <p className="text-sm text-text-muted">Ask your first question. Each question and answer will be saved below.</p>}
                <div ref={conversationRef} className="conversation-list max-h-[620px] overflow-y-auto space-y-3">
                {questionHistory.map((item, index) => (
                  <article key={item.id} className="conversation-card answer-reveal space-y-4">
                    <div className="conversation-question space-y-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-accent">Question {index + 1}</span>
                      <p className="text-sm font-semibold text-text-primary break-words whitespace-pre-wrap">{item.question}</p>
                    </div>
                    <div className="conversation-answer space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Answer</span>
                        <Badge variant={item.supported_by_transcript ? "success" : "warning"} className="text-xs">{item.supported_by_transcript ? "Supported by transcript" : "Not Found"}</Badge>
                      </div>
                      <p className="text-sm text-text-secondary leading-relaxed break-words whitespace-pre-wrap">{item.answer}</p>
                    </div>
                    {!!item.timestamps?.length && <div className="flex items-center gap-1.5 flex-wrap border-t border-border/50 pt-2">
                      <span className="text-xs text-text-muted">Evidence:</span>
                      {item.timestamps.map((time, index) => <button key={index} onClick={() => handleSeek(time)} className="rounded px-2 py-1 text-xs font-mono text-accent bg-accent-subtle" title="Play this moment">[{formatTimestamp(time)}]</button>)}
                    </div>}
                  </article>
                ))}
                </div>
              </section>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
