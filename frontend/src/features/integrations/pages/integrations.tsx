import { useState, useEffect } from "react";
import {
  KeyRound,
  Plus,
  Copy,
  Trash2,
  Code2,
  Activity,
  AlertTriangle,
  Loader2,
  Zap,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  apiClient,
  type ApiApiKey,
  type ApiUsageSummary,
} from "@/lib/api-client";

export function IntegrationsPage() {
  const [keys, setKeys] = useState<ApiApiKey[]>([]);
  const [usage, setUsage] = useState<ApiUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [keysRes, usageRes] = await Promise.allSettled([
        apiClient.getApiKeys(),
        apiClient.getUsage(),
      ]);

      if (keysRes.status === "fulfilled" && keysRes.value.data) {
        setKeys(keysRes.value.data);
      }
      if (usageRes.status === "fulfilled" && usageRes.value.data) {
        setUsage(usageRes.value.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await apiClient.createApiKey({ name: newKeyName.trim() });
      const createdKey = res.data;

      setKeys((prev) => [createdKey, ...prev]);
      setGeneratedKey(createdKey.raw_key || null);
      setNewKeyName("");

      toast({
        title: "API Key Created",
        description: `"${createdKey.name}" is now ready to authorize programmatic requests.`,
        variant: "success",
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to generate API key";
      toast({
        title: "Generation Failed",
        description: msg,
        variant: "danger",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    try {
      await apiClient.revokeApiKey(id);
      setKeys((prev) =>
        prev.map((k) => (k.id === id ? { ...k, is_revoked: true } : k)),
      );
      toast({
        title: "API Key Revoked",
        description: `Key "${name}" has been permanently invalidated.`,
        variant: "danger",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to revoke key";
      toast({
        title: "Revoke Failed",
        description: msg,
        variant: "danger",
      });
    }
  };

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to Clipboard",
      description: "Code snippet copied.",
      variant: "success",
    });
  };

  const CURL_EXAMPLE = `curl -X POST "http://localhost:5000/api/v1/recordings" \\
  -H "Authorization: Bearer vm_live_9a4f..." \\
  -F "file=@meeting_audio.mp3" \\
  -F "title=Q4 Architecture Sync"`;

  const PYTHON_EXAMPLE = `import requests

url = "http://localhost:5000/api/v1/recordings"
headers = {"Authorization": "Bearer vm_live_9a4f..."}
files = {"file": open("meeting_audio.mp3", "rb")}
data = {"title": "Q4 Architecture Sync"}

response = requests.post(url, headers=headers, files=files, data=data)
print(response.json())`;

  const TS_EXAMPLE = `import { apiClient } from "@/lib/api-client";

// Ingest audio via VoxMind REST API
const formData = new FormData();
formData.append("file", audioBlob, "sync.wav");
formData.append("title", "Engineering Standup");

const result = await apiClient.uploadRecording(formData);
console.log("Job status:", result.data.status);`;

  const activeKeys = keys.filter((k) => !k.is_revoked);

  return (
    <div className="feature-page space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="eyebrow mb-3">BETTER TOGETHER</p>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              Make it part of your flow
            </h1>
            <Badge variant="violet" className="text-xs font-mono">
              REST v1
            </Badge>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Connect your tools and bring voice intelligence into your everyday
            work.
          </p>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={() => {
            setGeneratedKey(null);
            setCreateDialogOpen(true);
          }}
          className="shadow-sm"
        >
          <Plus className="w-5 h-5 mr-1.5" />
          Generate API Key
        </Button>
      </div>

      {/* API Usage & Quotas (Live Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4.5 rounded-xl border border-border bg-surface-1 space-y-1.5">
          <div className="flex items-center justify-between text-sm text-text-muted">
            <span>Requests Recorded</span>
            <Activity className="w-5 h-5 text-accent" />
          </div>
          <div className="text-xl font-bold text-text-primary font-mono">
            {usage?.total_requests.toLocaleString() ?? 0} /{" "}
            {(usage?.quota.requests_limit ?? 100000).toLocaleString()}
          </div>
          <div className="text-xs text-text-secondary">
            {usage
              ? `${((usage.total_requests / usage.quota.requests_limit) * 100).toFixed(1)}% quota consumed`
              : "Standard Workspace Quota"}
          </div>
        </div>

        <div className="p-4.5 rounded-xl border border-border bg-surface-1 space-y-1.5">
          <div className="flex items-center justify-between text-sm text-text-muted">
            <span>Audio Processed</span>
            <Mic className="w-5 h-5 text-success" />
          </div>
          <div className="text-xl font-bold text-text-primary font-mono">
            {usage?.total_audio_hours ?? 0} hrs /{" "}
            {usage?.quota.audio_hours_limit ?? 50} hrs
          </div>
          <div className="text-xs text-text-secondary">
            Local faster-whisper transcription
          </div>
        </div>

        <div className="p-4.5 rounded-xl border border-border bg-surface-1 space-y-1.5">
          <div className="flex items-center justify-between text-sm text-text-muted">
            <span>AI LLM Tokens</span>
            <Zap className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-text-primary font-mono">
            {(usage?.total_tokens ?? 0).toLocaleString()} tokens
          </div>
          <div className="text-xs text-text-secondary">
            Ollama summarization & RAG
          </div>
        </div>
      </div>

      {/* API Key Management Table */}
      <div className="rounded-xl border border-border bg-surface-1 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-accent" />
              Developer API Keys
            </h3>
            <p className="text-sm text-text-muted mt-0.5">
              Secret keys grant full programmatic access to your authorized
              workspace voice endpoints.
            </p>
          </div>
          <Badge variant="outline" className="text-sm">
            {activeKeys.length} active key(s)
          </Badge>
        </div>

        {loading ? (
          <div className="py-8 flex items-center justify-center text-text-muted text-sm">
            <Loader2 className="w-5 h-5 mr-2 animate-spin text-accent" />
            Loading developer keys...
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-8 text-sm text-text-muted">
            No API keys generated yet. Click "Generate API Key" to create a
            programmatic access token.
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg bg-surface-2/60 border border-border gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">
                      {key.name}
                    </span>
                    <Badge
                      variant={key.is_revoked ? "outline" : "success"}
                      className="text-xs"
                    >
                      {key.is_revoked ? "revoked" : "active"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted font-mono">
                    <span className="bg-surface-1 px-2 py-0.5 rounded border border-border">
                      {key.key_prefix}
                    </span>
                    <span>
                      Created {new Date(key.created_at).toLocaleDateString()}
                    </span>
                    <span>
                      • Last used:{" "}
                      {key.last_used_at
                        ? new Date(key.last_used_at).toLocaleDateString()
                        : "Never"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {!key.is_revoked ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevoke(key.id, key.name)}
                      className="h-8 text-sm text-danger hover:bg-danger-subtle hover:border-danger/30"
                    >
                      <Trash2 className="w-5 h-5 mr-1" /> Revoke
                    </Button>
                  ) : (
                    <span className="text-sm text-text-muted italic">
                      Revoked
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Code Integration Examples */}
      <div className="rounded-xl border border-border bg-surface-1 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-accent" />
            <h3 className="text-sm font-semibold text-text-primary">
              Integration Code Samples
            </h3>
          </div>
          <span className="text-sm text-text-muted font-mono">
            POST /api/v1/recordings
          </span>
        </div>

        <Tabs defaultValue="curl" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-sm">
            <TabsTrigger value="curl">cURL</TabsTrigger>
            <TabsTrigger value="python">Python</TabsTrigger>
            <TabsTrigger value="ts">TypeScript</TabsTrigger>
          </TabsList>

          <TabsContent value="curl" className="pt-3">
            <div className="relative">
              <pre className="p-4 rounded-lg bg-surface-2 border border-border text-sm font-mono text-text-primary overflow-x-auto leading-relaxed">
                {CURL_EXAMPLE}
              </pre>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copyCode(CURL_EXAMPLE)}
                className="absolute right-3 top-3 h-7 text-sm"
              >
                <Copy className="w-5 h-5 mr-1" /> Copy
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="python" className="pt-3">
            <div className="relative">
              <pre className="p-4 rounded-lg bg-surface-2 border border-border text-sm font-mono text-text-primary overflow-x-auto leading-relaxed">
                {PYTHON_EXAMPLE}
              </pre>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copyCode(PYTHON_EXAMPLE)}
                className="absolute right-3 top-3 h-7 text-sm"
              >
                <Copy className="w-5 h-5 mr-1" /> Copy
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="ts" className="pt-3">
            <div className="relative">
              <pre className="p-4 rounded-lg bg-surface-2 border border-border text-sm font-mono text-text-primary overflow-x-auto leading-relaxed">
                {TS_EXAMPLE}
              </pre>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copyCode(TS_EXAMPLE)}
                className="absolute right-3 top-3 h-7 text-sm"
              >
                <Copy className="w-5 h-5 mr-1" /> Copy
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Generate API Key Modal Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md w-[calc(100vw-2rem)] sm:w-full border-border bg-surface-1 p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              {generatedKey
                ? "Save Your Secret Key"
                : "Generate API Access Key"}
            </DialogTitle>
            <DialogDescription>
              {generatedKey
                ? "This key is displayed once only. Store it securely in your environment variables or secret manager."
                : "Enter a descriptive label for where this programmatic key will be utilized."}
            </DialogDescription>
          </DialogHeader>

          {generatedKey ? (
            <div className="space-y-4 pt-1">
              <div className="p-3 rounded-lg bg-warning-subtle border border-warning/30 text-sm text-warning flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>
                  For security, we cannot show this token again after you
                  dismiss this dialog.
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={generatedKey}
                  className="font-mono text-sm bg-surface-2 border-border"
                />
                <Button
                  variant="default"
                  onClick={() => copyCode(generatedKey)}
                  className="shrink-0"
                >
                  <Copy className="w-5 h-5 mr-1" /> Copy
                </Button>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  variant="secondary"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  I Have Saved My Key
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleGenerateKey} className="space-y-4 pt-1">
              <div>
                <label
                  htmlFor="integrations-field-1"
                  className="text-sm font-medium text-text-secondary mb-1.5 block"
                >
                  Key Name / Purpose
                </label>
                <Input
                  id="integrations-field-1"
                  placeholder="e.g. Production Ingestion Service"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  required
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCreateDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  disabled={!newKeyName.trim() || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-1.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Key"
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
