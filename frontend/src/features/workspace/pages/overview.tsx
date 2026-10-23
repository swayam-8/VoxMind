import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { UploadDialog } from "@/features/recordings/components/upload-dialog";
import { Waveform } from "@/components/brand/waveform";
import { apiClient } from "@/lib/api-client";

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
    queryKey: ["recordings", { per_page: 5 }],
    queryFn: () => apiClient.getRecordings({ per_page: 5 }),
    enabled: signedIn,
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
  const recordings = data?.data || [];
  const total = data?.meta?.total ?? recordings.length;
  const minutes = Math.round(
    recordings.reduce((sum, r) => sum + (r.duration_seconds || 0), 0) / 60,
  );
  const completed = recordings.filter((r) =>
    ["ready", "completed"].includes(r.status),
  ).length;
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
      note: "Across your 5 latest recordings",
      icon: Clock3,
    },
    {
      label: "Ready to explore",
      value: signedIn ? completed : "—",
      note: "Among your latest recordings",
      icon: CheckCircle2,
    },
    {
      label: "Collections",
      value: signedIn ? (collections?.data?.length ?? "—") : "—",
      note: "A place for every conversation",
      icon: FolderOpen,
    },
  ];
  return (
    <div className="overview-page space-y-8">
      <section className="overview-heading">
        <div>
          <p className="eyebrow">YOUR PERSONAL LISTENING ROOM</p>
          <h1>
            A clearer picture.<span className="text-accent"> Every day.</span>
          </h1>
          <p>Good conversations deserve more than a recording.</p>
        </div>
        <Button
          onClick={() =>
            signedIn ? setUploadOpen(true) : window.location.assign("/login")
          }
        >
          <Upload size={16} />
          Upload recording
        </Button>
      </section>
      <section className="signal-hero">
        <div className="signal-hero-copy">
          <div className="hero-label">
            <span /> FROM CONVERSATION TO CLARITY
          </div>
          <h2>
            Less replaying.
            <br />
            More <em>moving forward.</em>
          </h2>
          <p>
            Turn the things you say into ideas you can find,
            <br className="hidden sm:block" /> decisions you can revisit, and a
            next step.
          </p>
          <Link to="/app/ask" className="hero-link">
            Meet your second mind <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="hero-art">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <Waveform />
          <div className="hero-art-caption">
            <span className="signal-dot" /> A SPACE FOR YOUR NEXT BIG IDEA
          </div>
          <span className="wave-time">00:00 ─────────── 01:28</span>
        </div>
        <span className="hero-index">01 / THE WORKSPACE</span>
      </section>
      <section className="metric-grid" aria-label="Workspace statistics">
        {stats.map(({ label, value, note, icon: Icon }, i) => (
          <article key={label} className="metric-card">
            <div className="metric-label">
              <span>{label}</span>
              <Icon size={17} />
            </div>
            <div className="metric-value">
              {isLoading ? <Skeleton className="h-10 w-20" /> : value}
              <span className="metric-index">0{i + 1}</span>
            </div>
            <p>{note}</p>
          </article>
        ))}
      </section>
      <div className="overview-lower">
        <section className="recordings-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p>
              <h2>Recent recordings</h2>
            </div>
            <Link to="/app/recordings" className="text-link">
              View library <ArrowRight size={15} />
            </Link>
          </div>
          {!signedIn ? (
            <div className="library-empty">
              <div className="empty-vinyl">
                <AudioLines size={30} />
              </div>
              <h3>Your next great idea starts here.</h3>
              <p>
                Sign in to bring your meetings, interviews, and
                <br className="hidden sm:block" /> voice notes into one
                thoughtful space.
              </p>
              <Link to="/login" className="text-link">
                Open your workspace <ArrowUpRight size={15} />
              </Link>
            </div>
          ) : isError ? (
            <div className="library-empty" role="alert">
              <AlertCircle size={28} className="text-danger" />
              <h3>We couldn’t load your recordings.</h3>
              <p>Check your connection and try again.</p>
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw size={15} />
                Try again
              </Button>
            </div>
          ) : isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((n) => (
                <Skeleton key={n} className="h-16" />
              ))}
            </div>
          ) : recordings.length === 0 ? (
            <div className="library-empty">
              <div className="empty-vinyl">
                <AudioLines size={30} />
              </div>
              <h3>A little space for something brilliant.</h3>
              <p>
                Upload a conversation. We’ll help you find the important parts.
              </p>
              <Button variant="outline" onClick={() => setUploadOpen(true)}>
                <Upload size={15} />
                Add your first recording
              </Button>
            </div>
          ) : (
            <div className="recent-list">
              {recordings.map((r, i) => (
                <Link
                  to={`/app/recordings/${r.id}`}
                  key={r.id}
                  className="recent-recording"
                >
                  <span className="recording-play">
                    <Play size={16} fill="currentColor" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3>{r.title}</h3>
                    <p>
                      {r.collection_name || "Unsorted"}
                      <span>·</span>
                      {new Date(r.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <span className="recording-duration">
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
                  >
                    {r.status === "ready" ? "Ready" : r.status}
                  </Badge>
                  <ArrowUpRight size={16} className="recording-arrow" />
                  <span className="sr-only">Recording {i + 1}</span>
                </Link>
              ))}
            </div>
          )}
          <div className="panel-footnote">
            <ShieldCheck size={14} />
            <span>
              A home for your conversations. Powered by local intelligence.
            </span>
          </div>
        </section>
        <aside className="insight-panel">
          <div className="insight-icon">
            <Sparkles size={22} />
          </div>
          <p className="eyebrow">CONNECT THE DOTS</p>
          <h2>
            The answer might
            <br />
            already be in
            <br />
            <em>your recordings.</em>
          </h2>
          <p>
            Ask a question across your library. Follow the answer back to the
            exact moment it was said.
          </p>
          <Link to="/app/ask" className="insight-cta">
            Ask VoxMind <ArrowUpRight size={18} />
          </Link>
          <div className="insight-example">
            <span>TRY ASKING</span>
            <Link to="/app/ask">
              “What did we decide
              <br />
              about the next launch?”
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </aside>
      </div>
      <div className="workspace-note">
        <span
          className={`status-dot ${healthError ? "is-offline" : health?.data?.status === "healthy" ? "is-online" : ""}`}
        />
        <span>
          {healthError
            ? "API unavailable — check system status"
            : health?.data?.status === "healthy"
              ? "Workspace API connected"
              : "Checking workspace connection"}
        </span>
        <Link to="/app/settings#diagnostics">
          View system status <ArrowUpRight size={13} />
        </Link>
      </div>
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSuccess={() =>
          queryClient.invalidateQueries({ queryKey: ["recordings"] })
        }
      />
    </div>
  );
}
