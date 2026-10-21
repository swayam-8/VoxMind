import { useState } from "react"
import {
  KeyRound,
  Plus,
  Copy,
  Trash2,
  Code2,
  Activity,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { DEMO_API_KEYS, type DemoApiKey } from "@/lib/demo-data"

export function IntegrationsPage() {
  const [keys, setKeys] = useState<DemoApiKey[]>(DEMO_API_KEYS)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)

  const handleGenerateKey = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyName.trim()) return

    const randomSecret = `vm_live_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`
    const newEntry: DemoApiKey = {
      id: `key-${Date.now()}`,
      name: newKeyName,
      prefix: `${randomSecret.substring(0, 12)}...`,
      createdAt: new Date().toISOString(),
      lastUsedAt: "Just now",
      status: "active",
    }

    setKeys((prev) => [newEntry, ...prev])
    setGeneratedKey(randomSecret)
    setNewKeyName("")
  }

  const handleRevoke = (id: string, name: string) => {
    setKeys((prev) => prev.filter((k) => k.id !== id))
    toast({
      title: "API Key Revoked",
      description: `Key "${name}" has been invalidated.`,
      variant: "danger",
    })
  }

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied to Clipboard",
      description: "Code snippet copied.",
      variant: "success",
    })
  }

  const CURL_EXAMPLE = `curl -X POST "http://localhost:5000/api/v1/recordings" \\
  -H "Authorization: Bearer vm_live_9a4f..." \\
  -F "file=@meeting_audio.mp3" \\
  -F "title=Q4 Architecture Sync" \\
  -F "collection_id=col-1"`

  const PYTHON_EXAMPLE = `import requests

url = "http://localhost:5000/api/v1/recordings"
headers = {"Authorization": "Bearer vm_live_9a4f..."}
files = {"file": open("meeting_audio.mp3", "rb")}
data = {"title": "Q4 Architecture Sync"}

response = requests.post(url, headers=headers, files=files, data=data)
print(response.json())`

  const TS_EXAMPLE = `import { apiClient } from "@/lib/api-client";

// Ingest audio via VoxMind REST API
const formData = new FormData();
formData.append("file", audioBlob, "sync.wav");
formData.append("title", "Engineering Standup");

const result = await apiClient.post("/recordings", formData);
console.log("Job status:", result.data.status);`

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              API & Developer Integrations
            </h1>
            <Badge variant="violet" className="text-[10px] font-mono">
              REST v1
            </Badge>
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            Manage programmatic API access keys, review request examples, and monitor quota limits.
          </p>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={() => {
            setGeneratedKey(null)
            setCreateDialogOpen(true)
          }}
          className="shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Generate API Key
        </Button>
      </div>

      {/* API Key Management Table */}
      <div className="rounded-xl border border-border bg-surface-1 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-accent" />
              Active API Keys
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Secret keys grant full access to your authorized workspace audio endpoints.
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {keys.length} of 10 keys
          </Badge>
        </div>

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
                  <Badge variant="success" className="text-[10px]">
                    {key.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-text-muted font-mono">
                  <span className="bg-surface-1 px-2 py-0.5 rounded border border-border">
                    {key.prefix}
                  </span>
                  <span>Created {new Date(key.createdAt).toLocaleDateString()}</span>
                  <span>• Last used: {key.lastUsedAt || "Never"}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRevoke(key.id, key.name)}
                  className="h-8 text-xs text-danger hover:bg-danger-subtle hover:border-danger/30"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Revoke
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API Usage & Quotas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4.5 rounded-xl border border-border bg-surface-1 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Requests (Current Month)</span>
            <Activity className="w-4 h-4 text-accent" />
          </div>
          <div className="text-xl font-bold text-text-primary font-mono">
            14,280 / 100,000
          </div>
          <div className="text-[11px] text-text-secondary">
            14.2% quota consumed
          </div>
        </div>

        <div className="p-4.5 rounded-xl border border-border bg-surface-1 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Rate Limit</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-text-primary font-mono">
            60 req / min
          </div>
          <div className="text-[11px] text-text-secondary">
            Standard Local Ingestion Tier
          </div>
        </div>

        <div className="p-4.5 rounded-xl border border-border bg-surface-1 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Webhooks</span>
            <Badge variant="outline" className="text-[10px]">Phase 6</Badge>
          </div>
          <div className="text-xl font-bold text-text-primary">
            0 Configured
          </div>
          <div className="text-[11px] text-text-muted">
            Scheduled for Phase 6 release
          </div>
        </div>
      </div>

      {/* Code Integration Examples */}
      <div className="rounded-xl border border-border bg-surface-1 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold text-text-primary">
              Integration Code Samples
            </h3>
          </div>
          <span className="text-xs text-text-muted font-mono">POST /api/v1/recordings</span>
        </div>

        <Tabs defaultValue="curl" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-sm">
            <TabsTrigger value="curl">cURL</TabsTrigger>
            <TabsTrigger value="python">Python</TabsTrigger>
            <TabsTrigger value="ts">TypeScript</TabsTrigger>
          </TabsList>

          <TabsContent value="curl" className="pt-3">
            <div className="relative">
              <pre className="p-4 rounded-lg bg-surface-2 border border-border text-xs font-mono text-text-primary overflow-x-auto leading-relaxed">
                {CURL_EXAMPLE}
              </pre>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copyCode(CURL_EXAMPLE)}
                className="absolute right-3 top-3 h-7 text-xs"
              >
                <Copy className="w-3 h-3 mr-1" /> Copy
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="python" className="pt-3">
            <div className="relative">
              <pre className="p-4 rounded-lg bg-surface-2 border border-border text-xs font-mono text-text-primary overflow-x-auto leading-relaxed">
                {PYTHON_EXAMPLE}
              </pre>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copyCode(PYTHON_EXAMPLE)}
                className="absolute right-3 top-3 h-7 text-xs"
              >
                <Copy className="w-3 h-3 mr-1" /> Copy
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="ts" className="pt-3">
            <div className="relative">
              <pre className="p-4 rounded-lg bg-surface-2 border border-border text-xs font-mono text-text-primary overflow-x-auto leading-relaxed">
                {TS_EXAMPLE}
              </pre>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copyCode(TS_EXAMPLE)}
                className="absolute right-3 top-3 h-7 text-xs"
              >
                <Copy className="w-3 h-3 mr-1" /> Copy
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Generate API Key Modal Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md border-border bg-surface-1">
          <DialogHeader>
            <DialogTitle>
              {generatedKey ? "Save Your Secret Key" : "Generate API Access Key"}
            </DialogTitle>
            <DialogDescription>
              {generatedKey
                ? "This key is displayed once only. Store it securely in your secret manager."
                : "Enter a descriptive label for where this key will be utilized."}
            </DialogDescription>
          </DialogHeader>

          {generatedKey ? (
            <div className="space-y-4 pt-1">
              <div className="p-3 rounded-lg bg-warning-subtle border border-warning/30 text-xs text-warning flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  For security, we cannot show this token again after you dismiss this dialog.
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={generatedKey}
                  className="font-mono text-xs bg-surface-2 border-border"
                />
                <Button
                  variant="default"
                  onClick={() => copyCode(generatedKey)}
                  className="shrink-0"
                >
                  <Copy className="w-4 h-4 mr-1" /> Copy
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
                <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                  Key Name / Purpose
                </label>
                <Input
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
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  disabled={!newKeyName.trim()}
                >
                  Generate Key
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
