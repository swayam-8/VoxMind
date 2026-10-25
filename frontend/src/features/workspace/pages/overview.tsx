import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ArrowRight,
  Upload,
  AudioLines,
  Clock3,
  FolderOpen,
  Sparkles,
  Play,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { UploadDialog } from "@/features/recordings/components/upload-dialog";
import { apiClient, type ApiActionItem } from "@/lib/api-client";
import { PageTransition } from "@/components/layout/page-transition";

function duration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}

export function OverviewPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const queryClient = useQueryClient();
  const signedIn = !!localStorage.getItem("voxmind_access_token");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["recordings", { per_page: 8 }],
    queryFn: () => apiClient.getRecordings({ per_page: 8 }),
    enabled: signedIn,
    refetchInterval: (query) => {
      const recs = query.state.data?.data || [];
      const hasProcessing = recs.some((r) =>
        ["queued", "processing", "transcribing"].includes(r.status)
      );
      return hasProcessing ? 2500 : false;
    },
  });

  const { data: collections } = useQuery({
    queryKey: ["collections"],
    queryFn: () => apiClient.getCollections(),
    enabled: signedIn,
  });

  const { data: health, isError: healthError } = useQuery({
    queryKey: ["system-health"],
    queryFn: () => apiClient.getHealth(),
    refetchInterval: 30000,
  });

  // Fetch recent action items across recordings
  const { data: actionItems = [] } = useQuery({
    queryKey: ["all-action-items-overview"],
    queryFn: async () => {
      try {
        const res = await apiClient.getActionItems();
        if (res.data) return res.data.slice(0, 5);
      } catch {
        // Fallback
      }
      const recs = data?.data || [];
      const extracted: ApiActionItem[] = [];
      for (const rec of recs) {
        if (rec.action_items) {
          for (const item of rec.action_items) {
            extracted.push({
              ...item,
              recording_id: rec.id,
              recording_title: rec.title,
            });
          }
        }
      }
      return extracted.slice(0, 5);
    },
    enabled: signedIn,
  });

  // Action toggle mutation
  const toggleAction = useMutation({
    mutationFn: ({ item, completed }: { item: ApiActionItem; completed: boolean }) =>
      apiClient.toggleActionItem(item.recording_id, item.id, completed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-action-items-overview"] });
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
    },
  });

  const recordings = data?.data || [];
  const total = data?.meta?.total ?? recordings.length;
  const minutes = Math.round(
    recordings.reduce((sum, r) => sum + (r.duration_seconds || 0), 0) / 60
  );
  const completed = recordings.filter((r) =>
    ["ready", "completed"].includes(r.status)
  ).length;

  const inFlightRecordings = recordings.filter((r) =>
    ["queued", "processing", "transcribing"].includes(r.status)
  );

  const stats = [
    {
      label: "Your recordings",
      value: signedIn ? total : "—",
      note: "Conversations, kept together",
      icon: AudioLines,
    },
    {
      label: "Recent audio",
      value: signedIn ? `${minutes} min` : "—",
      note: "Across your latest recordings",
      icon: Clock3,
    },
    {
      label: "Ready to explore",
      value: signedIn ? completed : "—",
      note: "Fully analyzed briefs",
      icon: CheckCircle2,
    },
    {
      label: "Collections",
      value: signedIn ? (collections?.data?.length ?? "—") : "—",
      note: "Organized workspaces",
      icon: FolderOpen,
    },
  ];

  return (
    <PageTransition className="overview-page space-y-6">
      {/* Overview Heading */}
      <section className="overview-heading flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="eyebrow text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
            YOUR PERSONAL LISTENING ROOM
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">
            A clearer picture.<span className="text-accent"> Every day.</span>
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Good conversations deserve more than a recording.
          </p>
        </div>
        <Button
          onClick={() =>
            signedIn ? setUploadOpen(true) : window.location.assign("/login")
          }
          className="shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
        >
          <Upload size={15} className="mr-1.5" />
          Upload recording
        </Button>
      </section>

      {/* In-Flight Processing Banner */}
      {inFlightRecordings.length > 0 && (
        <div className="rounded-lg border border-accent/25 bg-accent-subtle/50 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">
                Processing {inFlightRecordings.length} recording
                {inFlightRecordings.length > 1 ? "s" : ""} in background…
              </p>
              <p className="text-[11px] text-text-secondary truncate mt-0.5">
                {inFlightRecordings[0].title}
              </p>
            </div>
          </div>
          <Link to={`/app/recordings/${inFlightRecordings[0].id}`}>
            <Button size="sm" variant="outline" className="text-xs bg-surface-1">
              View Status
              <ArrowRight size={13} className="ml-1" />
            </Button>
          </Link>
        </div>
      )}

      {/* Metrics Strip */}
      <section className="metric-grid" aria-label="Workspace statistics">
        {stats.map(({ label, value, note, icon: Icon }, i) => (
          <article
            key={label}
            className="metric-card rounded-lg border border-border bg-surface-1 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors hover:border-border/80"
          >
            <div className="metric-label flex items-center justify-between text-xs font-medium text-text-muted">
              <span>{label}</span>
              <Icon size={16} className="text-accent" />
            </div>
            <div className="metric-value flex items-baseline justify-between mt-2 mb-1">
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <span className="text-2xl font-semibold text-text-primary tracking-tight">
                  {value}
                </span>
              )}
              <span className="metric-index text-[10px] text-text-muted font-mono">
                0{i + 1}
              </span>
            </div>
            <p className="text-xs text-text-muted">{note}</p>
          </article>
        ))}
      </section>

      {/* Main Workspace Grid */}
      <div className="overview-lower grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Recordings Panel (2 cols) */}
        <section className="recordings-panel lg:col-span-2 rounded-lg border border-border bg-surface-1 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col overflow-hidden">
          <div className="section-heading flex items-center justify-between p-4 border-b border-border bg-surface-2/40">
            <div>
              <p className="eyebrow text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                PICK UP WHERE YOU LEFT OFF
              </p>
              <h2 className="text-base font-semibold text-text-primary mt-0.5">
                Recent recordings
              </h2>
            </div>
            <Link
              to="/app/recordings"
              className="text-link text-xs font-medium text-accent hover:text-accent-hover flex items-center gap-1"
            >
              View library <ArrowRight size={13} />
            </Link>
          </div>

          {!signedIn ? (
            <div className="library-empty py-14 px-6 text-center">
              <div className="empty-vinyl w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center mx-auto mb-3 text-text-muted">
                <AudioLines size={24} />
              </div>
              <h3 className="text-sm font-semibold text-text-primary">
                Your next great idea starts here.
              </h3>
              <p className="text-xs text-text-secondary mt-1">
                Sign in to bring your meetings, interviews, and voice notes into one thoughtful space.
              </p>
              <Link to="/login" className="inline-block mt-4">
                <Button size="sm">Open your workspace</Button>
              </Link>
            </div>
          ) : isError ? (
            <div className="library-empty py-12 px-6 text-center" role="alert">
              <AlertCircle size={24} className="text-danger mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-text-primary">
                We couldn’t load your recordings.
              </h3>
              <p className="text-xs text-text-muted mt-1 mb-4">
                Check your connection and try again.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw size={13} className="mr-1.5" />
                Try again
              </Button>
            </div>
          ) : isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded" />
                  <Skeleton className="h-5 flex-1 rounded" />
                  <Skeleton className="w-16 h-5 rounded" />
                </div>
              ))}
            </div>
          ) : recordings.length === 0 ? (
            <div className="library-empty py-14 px-6 text-center">
              <div className="empty-vinyl w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center mx-auto mb-3 text-text-muted">
                <AudioLines size={24} />
              </div>
              <h3 className="text-sm font-semibold text-text-primary">
                A little space for something brilliant.
              </h3>
              <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                Upload a conversation. We’ll help you find the important parts.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUploadOpen(true)}
                className="mt-4"
              >
                <Upload size={13} className="mr-1.5" />
                Add your first recording
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recordings.map((r, i) => (
                <Link
                  to={`/app/recordings/${r.id}`}
                  key={r.id}
                  className="recent-recording group flex items-center gap-3.5 p-3.5 hover:bg-surface-2/60 transition-colors"
                >
                  <span className="recording-play w-7 h-7 rounded-md bg-surface-2 border border-border flex items-center justify-center text-text-muted group-hover:bg-accent group-hover:border-accent group-hover:text-white transition-all shrink-0">
                    <Play size={12} fill="currentColor" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">
                      {r.title}
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
                      <span>{r.collection_name || "Unsorted"}</span>
                      <span>·</span>
                      <span>
                        {new Date(r.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </p>
                  </div>
                  <span className="recording-duration text-xs text-text-muted font-mono">
                    {duration(r.duration_seconds)}
                  </span>
                  <Badge
                    variant={
                      r.status === "failed"
                        ? "danger"
                        : ["ready", "completed"].includes(r.status)
                          ? "success"
                          : "warning"
                    }
                    className="text-[11px] capitalize"
                  >
                    {r.status === "ready" ? "Ready" : r.status}
                  </Badge>
                  <ArrowUpRight
                    size={14}
                    className="recording-arrow text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                  <span className="sr-only">Recording {i + 1}</span>
                </Link>
              ))}
            </div>
          )}

          <div className="panel-footnote mt-auto p-3 border-t border-border bg-surface-2/30 flex items-center gap-2 text-xs text-text-muted">
            <ShieldCheck size={13} className="text-text-muted shrink-0" />
            <span>A home for your conversations. A clearer next step.</span>
          </div>
        </section>

        {/* Intelligence Side Panel (1 col) */}
        <aside className="space-y-4">
          {/* Action Items Widget */}
          <div className="rounded-lg border border-border bg-surface-1 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
              <div className="flex items-center gap-1.5">
                <CheckSquare size={15} className="text-accent" />
                <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                  Action Items
                </h3>
              </div>
              <Link
                to="/app/actions"
                className="text-[11px] font-medium text-accent hover:underline flex items-center gap-0.5"
              >
                View all <ArrowRight size={11} />
              </Link>
            </div>

            {actionItems.length === 0 ? (
              <p className="text-xs text-text-muted py-4 text-center">
                No open action items. Upload a meeting to extract next steps.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {actionItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-2.5 text-xs text-text-primary group"
                  >
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={(e) =>
                        toggleAction.mutate({
                          item,
                          completed: e.target.checked,
                        })
                      }
                      className="mt-0.5 h-3.5 w-3.5 rounded border-border text-accent cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`leading-tight font-medium ${
                          item.completed ? "line-through text-text-muted" : "text-text-primary"
                        }`}
                      >
                        {item.task}
                      </p>
                      {item.recording_title && (
                        <p className="text-[11px] text-text-muted truncate mt-0.5">
                          {item.recording_title}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Ask AI Context Card */}
          <div className="rounded-lg border border-border bg-surface-1 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles size={15} className="text-accent" />
              <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                Ask MeetingBrief
              </h3>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Find answers, decisions, and exact quotes across your entire library of recordings.
            </p>
            <div className="mt-3 p-2.5 rounded-md bg-surface-2 border border-border/70 text-xs">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block mb-1">
                Try asking
              </span>
              <Link
                to="/app/ask"
                className="text-text-primary hover:text-accent font-medium flex items-center justify-between gap-1 group"
              >
                <span>“What did we decide about the next launch?”</span>
                <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            </div>
            <Link to="/app/ask" className="block mt-3">
              <Button size="sm" variant="outline" className="w-full text-xs">
                Open AI Workspace
                <ArrowUpRight size={13} className="ml-1" />
              </Button>
            </Link>
          </div>
        </aside>
      </div>

      {/* System Status Footnote */}
      <div className="workspace-note flex items-center gap-2 text-xs text-text-muted pt-2 border-t border-border">
        <span
          className={`status-dot w-2 h-2 rounded-full ${
            healthError
              ? "bg-danger"
              : health?.data?.status === "healthy"
              ? "bg-success"
              : "bg-warning"
          }`}
        />
        <span>
          {healthError
            ? "API unavailable — check system status"
            : health?.data?.status === "healthy"
            ? "Workspace API connected"
            : "Checking workspace connection"}
        </span>
        <span className="text-border">·</span>
        <Link
          to="/app/settings#diagnostics"
          className="text-accent hover:underline flex items-center gap-0.5"
        >
          View system status <ArrowUpRight size={11} />
        </Link>
      </div>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSuccess={() =>
          queryClient.invalidateQueries({ queryKey: ["recordings"] })
        }
      />
    </PageTransition>
  );
}
