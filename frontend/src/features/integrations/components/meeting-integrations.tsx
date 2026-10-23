import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Video,
  Link2,
  ArrowDownToLine,
  ArrowUpRight,
  RefreshCw,
  Loader2,
  Check,
  Unplug,
  AlertCircle,
  FolderOpen,
  Copy,
  Clock3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  meetingApi,
  type MeetingProvider,
  type MeetingConnection,
} from "../lib/meeting-api";

const providers: {
  id: MeetingProvider;
  name: string;
  description: string;
  note: string;
}[] = [
  {
    id: "zoom",
    name: "Zoom",
    description: "Bring completed Zoom cloud recordings into your workspace.",
    note: "Cloud recordings from the last 30 days. Requires recording access.",
  },
  {
    id: "google-meet",
    name: "Google Meet",
    description: "Import Meet recordings saved to your Google Drive.",
    note: "Looks in your Meet Recordings folder. Recording availability depends on your Workspace plan.",
  },
  {
    id: "webex",
    name: "Webex",
    description: "Keep your Webex meeting recordings alongside the rest.",
    note: "Requires access to completed, downloadable cloud recordings.",
  },
];
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "The request could not be completed.";
const providerName = (id: MeetingProvider) =>
  providers.find((provider) => provider.id === id)!.name;
const size = (bytes: number) =>
  bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : "Size unavailable";

export function MeetingIntegrations() {
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const signedIn = !!localStorage.getItem("voxmind_access_token");
  const [selected, setSelected] = useState<MeetingProvider | null>(null);
  const [setup, setSetup] = useState<MeetingConnection | null>(null);
  const [disconnect, setDisconnect] = useState<MeetingProvider | null>(null);
  const [folder, setFolder] = useState("");
  const [appliedFolder, setAppliedFolder] = useState("");
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const connections = useQuery({
    queryKey: ["meeting-connections"],
    queryFn: meetingApi.connections,
    enabled: signedIn,
  });
  const history = useQuery({
    queryKey: ["meeting-imports"],
    queryFn: meetingApi.imports,
    enabled: signedIn,
    refetchInterval: (query) =>
      query.state.data?.some((job) =>
        ["queued", "downloading"].includes(job.status),
      )
        ? 2000
        : false,
  });
  const recordings = useInfiniteQuery({
    queryKey: ["meeting-recordings", selected, appliedFolder],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      meetingApi.recordings(
        selected!,
        pageParam || undefined,
        appliedFolder || undefined,
      ),
    getNextPageParam: (page) => page.nextCursor || undefined,
    enabled: !!selected,
  });
  useEffect(() => {
    const result = params.get("connection");
    if (!result) return;
    const reason = params.get("reason");
    const detail =
      reason === "OAUTH_STATE_INVALID"
        ? "This request expired or belongs to another browser. Start the connection again."
        : reason === "OAUTH_ACCESS_DENIED"
          ? "Access was not granted. You can connect again whenever you are ready."
          : "The account could not be connected. Check the app configuration and try again.";
    toast({
      title:
        result === "success"
          ? "Meeting account connected"
          : "Connection not completed",
      description:
        result === "success"
          ? "You can now browse and import available recordings."
          : detail,
      variant: result === "success" ? "success" : "danger",
    });
    void client.invalidateQueries({ queryKey: ["meeting-connections"] });
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        ["connection", "provider", "reason"].forEach((key) => next.delete(key));
        return next;
      },
      { replace: true },
    );
  }, [params, setParams, client]);

  const connectMutation = useMutation({
    mutationFn: meetingApi.connect,
    onSuccess: (data) => {
      window.location.assign(data.authorizeUrl);
    },
    onError: (error) =>
      toast({
        title: "Could not connect account",
        description: message(error),
        variant: "danger",
      }),
  });
  const disconnectMutation = useMutation({
    mutationFn: meetingApi.disconnect,
    onSuccess: () => {
      setDisconnect(null);
      void client.invalidateQueries({ queryKey: ["meeting-connections"] });
      void client.removeQueries({ queryKey: ["meeting-recordings"] });
      toast({
        title: "Account disconnected",
        description: "Existing imported recordings stay in your library.",
      });
    },
    onError: (error) =>
      toast({
        title: "Could not disconnect",
        description: message(error),
        variant: "danger",
      }),
  });
  const importMutation = useMutation({
    mutationFn: ({ provider, id }: { provider: MeetingProvider; id: string }) =>
      meetingApi.import(provider, id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["meeting-imports"] });
      void client.invalidateQueries({ queryKey: ["meeting-recordings"] });
      toast({
        title: "Recording import queued",
        description:
          "Track the download below. Transcription starts after the file arrives.",
        variant: "success",
      });
    },
    onError: (error) =>
      toast({
        title: "Import not started",
        description: message(error),
        variant: "danger",
      }),
    onSettled: () => setPendingImport(null),
  });

  const items = recordings.data?.pages.flatMap((page) => page.recordings) || [];
  const limit = recordings.data?.pages[0]?.maxImportSizeMb;
  const beginImport = (provider: MeetingProvider, id: string) => {
    if (importMutation.isPending) return;
    setPendingImport(id);
    importMutation.mutate({ provider, id });
  };
  return (
    <section
      className="meeting-integrations space-y-6"
      aria-labelledby="meeting-integrations-title"
    >
      <div className="meeting-section-heading">
        <div>
          <p className="eyebrow">FROM YOUR MEETINGS TO YOUR LIBRARY</p>
          <h2 id="meeting-integrations-title">
            Connect once. Keep the conversation.
          </h2>
          <p>
            Import completed cloud recordings directly. VoxMind downloads a
            local copy, then uses your existing transcription and intelligence
            pipeline.
          </p>
        </div>
        <span className="meeting-section-icon">
          <Video size={28} />
        </span>
      </div>
      {!signedIn ? (
        <div className="meeting-notice">
          <Link2 size={22} />
          <p>
            <Link to="/login" className="text-accent font-semibold">
              Sign in
            </Link>{" "}
            to connect your meeting accounts.
          </p>
        </div>
      ) : connections.isError ? (
        <div className="meeting-notice" role="alert">
          <AlertCircle size={22} />
          <p>{message(connections.error)}</p>
          <Button variant="outline" onClick={() => connections.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="meeting-provider-grid">
          {providers.map((provider) => {
            const account = connections.data?.find(
              (item) => item.provider === provider.id,
            );
            return (
              <article key={provider.id} className="meeting-provider-card">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`meeting-provider-mark provider-${provider.id}`}
                  >
                    <Video size={28} />
                  </span>
                  <Badge variant={account?.connected ? "success" : "outline"}>
                    {connections.isLoading
                      ? "Checking…"
                      : account?.connected
                        ? "Connected"
                        : account?.configured
                          ? "Not connected"
                          : "Setup needed"}
                  </Badge>
                </div>
                <div>
                  <h3>{provider.name}</h3>
                  <p>{provider.description}</p>
                </div>
                <div className="meeting-provider-actions">
                  {account?.connected ? (
                    <>
                      <Button
                        onClick={() => {
                          setSelected(provider.id);
                          setFolder("");
                          setAppliedFolder("");
                        }}
                      >
                        <FolderOpen size={20} />
                        Browse recordings
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Disconnect ${provider.name}`}
                        onClick={() => setDisconnect(provider.id)}
                      >
                        <Unplug size={20} />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant={account?.configured ? "default" : "outline"}
                      disabled={
                        connections.isLoading ||
                        !account ||
                        connectMutation.isPending
                      }
                      isLoading={
                        connectMutation.isPending &&
                        connectMutation.variables === provider.id
                      }
                      onClick={() => {
                        if (!account?.configured) setSetup(account || null);
                        else connectMutation.mutate(provider.id);
                      }}
                    >
                      <Link2 size={20} />
                      {account?.configured
                        ? `Connect ${provider.name}`
                        : "Set up connection"}
                    </Button>
                  )}
                </div>
                <p className="meeting-provider-note">{provider.note}</p>
              </article>
            );
          })}
        </div>
      )}
      <p className="meeting-footnote">
        <Clock3 size={18} />
        Imports use existing recordings. Connecting an account does not join,
        record, or start a live meeting.
      </p>
      {signedIn && (
        <div className="meeting-import-history">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3>Recent meeting imports</h3>
            <Button
              variant="ghost"
              onClick={() => {
                void history.refetch();
                void client.invalidateQueries({ queryKey: ["recordings"] });
              }}
            >
              <RefreshCw size={18} />
              Refresh
            </Button>
          </div>
          {history.isError ? (
            <p role="alert" className="text-sm text-danger">
              Could not load import activity. Try refreshing.
            </p>
          ) : history.isLoading ? (
            <p className="text-sm text-text-muted flex gap-2">
              <Loader2 size={18} className="animate-spin" />
              Loading imports…
            </p>
          ) : !history.data?.length ? (
            <p className="text-sm text-text-secondary">
              Your imported meetings will appear here. Connect an account to get
              started.
            </p>
          ) : (
            <div className="meeting-import-list">
              {history.data.map((job) => (
                <div key={job.id} className="meeting-import-row">
                  <div className="min-w-0">
                    <h4>{job.title}</h4>
                    <p>
                      {providerName(job.provider)} ·{" "}
                      {job.status === "imported"
                        ? "Downloaded to your library"
                        : job.status === "downloading"
                          ? "Downloading the recording…"
                          : job.status === "queued"
                            ? "Waiting to download"
                            : job.error}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge
                      variant={
                        job.status === "failed"
                          ? "danger"
                          : job.status === "imported"
                            ? "success"
                            : "outline"
                      }
                    >
                      {["queued", "downloading"].includes(job.status) && (
                        <Loader2 size={14} className="animate-spin" />
                      )}
                      {job.status === "imported"
                        ? "Imported"
                        : job.status === "failed"
                          ? "Failed"
                          : "Importing"}
                    </Badge>
                    {job.recordingId && job.status === "imported" ? (
                      <Link
                        to={`/app/recordings/${job.recordingId}`}
                        className="text-link"
                      >
                        Open <ArrowUpRight size={18} />
                      </Link>
                    ) : job.status === "failed" &&
                      connections.data?.some(
                        (account) =>
                          account.provider === job.provider &&
                          account.connected,
                      ) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={importMutation.isPending}
                        onClick={() =>
                          beginImport(job.provider, job.externalId)
                        }
                      >
                        Retry
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="meeting-recordings-dialog">
          <DialogHeader>
            <DialogTitle>
              {selected ? providerName(selected) : ""} recordings
            </DialogTitle>
            <DialogDescription>
              Choose a completed recording to import.{" "}
              {limit ? `Up to ${limit} MB per file.` : ""} Downloads continue in
              the background.
            </DialogDescription>
          </DialogHeader>
          {selected === "google-meet" && (
            <details className="meeting-folder-settings">
              <summary>Use a different Drive folder</summary>
              <p>
                If your recordings folder was renamed or moved, enter its folder
                ID from the Google Drive address.
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setAppliedFolder(folder.trim());
                }}
              >
                <label htmlFor="meet-folder" className="sr-only">
                  Google Drive folder ID
                </label>
                <Input
                  id="meet-folder"
                  placeholder="Leave blank for Meet Recordings"
                  value={folder}
                  onChange={(event) => setFolder(event.target.value)}
                  pattern="[A-Za-z0-9_-]{5,250}"
                />
                <Button variant="outline" type="submit">
                  Apply folder
                </Button>
              </form>
            </details>
          )}
          {recordings.isError ? (
            <div className="library-empty" role="alert">
              <AlertCircle size={32} className="text-danger mb-3" />
              <h3>Couldn’t load recordings</h3>
              <p>{message(recordings.error)}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button variant="outline" onClick={() => recordings.refetch()}>
                  Try again
                </Button>
                <Button
                  onClick={() => {
                    if (selected) connectMutation.mutate(selected);
                  }}
                >
                  Reconnect account
                </Button>
              </div>
            </div>
          ) : recordings.isPending ? (
            <div className="library-empty">
              <Loader2 size={28} className="animate-spin text-accent" />
              <p>Fetching available recordings…</p>
            </div>
          ) : !items.length ? (
            <div className="library-empty">
              <Video size={36} className="text-accent mb-4" />
              <h3>No recordings available yet</h3>
              <p>
                Check that cloud recording is enabled and the meeting has
                finished processing. Use the account that can download the
                recording.
              </p>
              <Button variant="outline" onClick={() => recordings.refetch()}>
                <RefreshCw size={18} />
                Check again
              </Button>
            </div>
          ) : (
            <div className="meeting-cloud-list">
              {items.map((recording) => {
                const current =
                  history.data?.find(
                    (job) =>
                      job.provider === selected &&
                      job.externalId === recording.id,
                  ) || recording.import;
                const busy =
                  current?.status === "queued" ||
                  current?.status === "downloading";
                const tooLarge =
                  !!limit && recording.sizeBytes > limit * 1024 * 1024;
                return (
                  <article
                    className="meeting-cloud-recording"
                    key={recording.id}
                  >
                    <span className="meeting-recording-icon">
                      <Video size={24} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3>{recording.title}</h3>
                      <p>
                        {recording.createdAt
                          ? new Date(recording.createdAt).toLocaleDateString()
                          : "Meeting recording"}{" "}
                        · {size(recording.sizeBytes)}
                        {recording.durationSeconds
                          ? ` · ${Math.round(recording.durationSeconds / 60)} min`
                          : ""}
                      </p>
                      {tooLarge && (
                        <p className="text-danger">
                          Exceeds this workspace’s {limit} MB import limit.
                        </p>
                      )}
                    </div>
                    {current?.status === "imported" && current.recordingId ? (
                      <Link
                        to={`/app/recordings/${current.recordingId}`}
                        className="text-link"
                      >
                        <Check size={18} />
                        Open in library
                      </Link>
                    ) : (
                      <Button
                        variant="outline"
                        disabled={
                          !!busy || tooLarge || importMutation.isPending
                        }
                        isLoading={pendingImport === recording.id || !!busy}
                        onClick={() => {
                          if (selected) beginImport(selected, recording.id);
                        }}
                      >
                        <ArrowDownToLine size={20} />
                        {busy
                          ? "Importing"
                          : current?.status === "failed"
                            ? "Retry import"
                            : "Import recording"}
                      </Button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          {recordings.hasNextPage && (
            <Button
              variant="outline"
              isLoading={recordings.isFetchingNextPage}
              onClick={() => recordings.fetchNextPage()}
            >
              Load more recordings
            </Button>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!setup}
        onOpenChange={(open) => {
          if (!open) setSetup(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable {setup?.name} imports</DialogTitle>
            <DialogDescription>
              The server administrator needs to register a provider OAuth app.
              Your account connects through the provider’s own sign-in page once
              setup is complete.
            </DialogDescription>
          </DialogHeader>
          <div className="meeting-setup-details">
            <h3>Redirect URL for the provider app</h3>
            <code>{setup?.callbackUrl}</code>
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard
                  .writeText(setup?.callbackUrl || "")
                  .then(() => toast({ title: "Redirect URL copied" }))
                  .catch(() =>
                    toast({
                      title: "Select and copy the URL above",
                      variant: "danger",
                    }),
                  );
              }}
            >
              <Copy size={18} />
              Copy redirect URL
            </Button>
            <details>
              <summary>Server configuration</summary>
              <p>
                Required settings: {setup?.missingVariables.join(", ")}. Keep
                credentials on the server; never put them in frontend variables.
              </p>
            </details>
            <a
              href="https://github.com/swayam-8/VoxMind/blob/main/docs/meeting-integrations.md"
              target="_blank"
              rel="noreferrer"
              className="text-link"
            >
              Read setup instructions <ArrowUpRight size={18} />
            </a>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!disconnect}
        onOpenChange={(open) => {
          if (!open && !disconnectMutation.isPending) setDisconnect(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Disconnect {disconnect ? providerName(disconnect) : ""}?
            </DialogTitle>
            <DialogDescription>
              VoxMind will remove the saved connection. Existing imported
              recordings stay in your library. You can also revoke this app in
              your provider account settings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={disconnectMutation.isPending}
              onClick={() => setDisconnect(null)}
            >
              Keep connection
            </Button>
            <Button
              variant="destructive"
              isLoading={disconnectMutation.isPending}
              onClick={() => {
                if (disconnect) disconnectMutation.mutate(disconnect);
              }}
            >
              Disconnect account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
