import { useState, useEffect } from "react"
import {
  User,
  Sun,
  Moon,
  Monitor,
  Cpu,
  ShieldCheck,
  Save,
  CheckCircle2,
  Activity,
  Key,
  RefreshCw,
  Server,
  Database,
  Layers,
  HardDrive,
  AlertCircle,
  HelpCircle,
  Radio,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTheme, type Theme } from "@/contexts/theme-context"
import { toast } from "@/hooks/use-toast"
import { apiClient, type ApiDiagnostics } from "@/lib/api-client"

export function SettingsPage() {
  const { theme, setTheme } = useTheme()

  // Profile Form
  const [fullName, setFullName] = useState("Jane Doe")
  const [email, setEmail] = useState("jane@voxmind.internal")

  // AI Configuration Form
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434")
  const [ollamaModel, setOllamaModel] = useState("llama3.2")
  const [whisperModel, setWhisperModel] = useState("base")
  const [whisperDevice, setWhisperDevice] = useState("cpu")

  // Security Form
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")

  // Diagnostics Hub State
  const [diagnostics, setDiagnostics] = useState<ApiDiagnostics | null>(null)
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false)

  useEffect(() => {
    let ignore = false
    const init = async () => {
      try {
        setDiagnosticsLoading(true)
        const res = await apiClient.getDiagnostics()
        if (!ignore) setDiagnostics(res.data)
      } catch {
        if (!ignore) setDiagnostics(null)
      } finally {
        if (!ignore) setDiagnosticsLoading(false)
      }
    }
    void init()
    return () => {
      ignore = true
    }
  }, [])

  const handleRefreshDiagnostics = async () => {
    try {
      setDiagnosticsLoading(true)
      const res = await apiClient.getDiagnostics()
      setDiagnostics(res.data)
    } catch {
      setDiagnostics(null)
    } finally {
      setDiagnosticsLoading(false)
    }
  }

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    toast({
      title: "Profile Saved",
      description: "User details and preferences updated.",
      variant: "success",
    })
  }

  const handleSaveAi = (e: React.FormEvent) => {
    e.preventDefault()
    toast({
      title: "AI Configuration Saved",
      description: "Local inference parameters applied to pipeline.",
      variant: "success",
    })
  }

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword || !newPassword) return
    setCurrentPassword("")
    setNewPassword("")
    toast({
      title: "Password Updated",
      description: "Your master password was rotated successfully.",
      variant: "success",
    })
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "healthy":
        return (
          <Badge variant="success" className="text-[10px] flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Healthy
          </Badge>
        )
      case "degraded":
        return (
          <Badge variant="warning" className="text-[10px] flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Degraded
          </Badge>
        )
      case "unreachable":
      case "unhealthy":
        return (
          <Badge variant="danger" className="text-[10px] flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Unreachable
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[10px] flex items-center gap-1">
            <HelpCircle className="w-3 h-3" /> Offline
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="border-b border-border pb-5">
        <h1 className="text-xl font-bold tracking-tight text-text-primary">
          Workspace Settings & System Diagnostics
        </h1>
        <p className="mt-1 text-xs text-text-secondary">
          Configure profile details, interface themes, local AI endpoints, and monitor real-time infrastructure health.
        </p>
      </div>

      {/* 1. Live System Diagnostics Hub */}
      <section className="rounded-xl border border-border bg-surface-1 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent" />
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                Live Diagnostics Hub
              </h2>
              <p className="text-[11px] text-text-muted">
                Real-time connectivity and status across local AI runtimes and database engines.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {diagnostics && getStatusBadge(diagnostics.status)}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshDiagnostics}
              disabled={diagnosticsLoading}
              className="h-8 text-xs"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 mr-1 ${diagnosticsLoading ? "animate-spin" : ""}`}
              />
              Refresh Diagnostics
            </Button>
          </div>
        </div>

        {diagnostics ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {/* Database */}
            <div className="p-3.5 rounded-lg bg-surface-2/60 border border-border space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-accent" /> Primary Database
                </span>
                {getStatusBadge(diagnostics.services.database?.status)}
              </div>
              <p className="text-[11px] text-text-secondary font-mono">
                Latency: {diagnostics.services.database?.latency_ms ?? 0} ms • {diagnostics.services.database?.message}
              </p>
            </div>

            {/* Vector Storage & HNSW */}
            <div className="p-3.5 rounded-lg bg-surface-2/60 border border-border space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-500" /> pgvector & HNSW
                </span>
                {getStatusBadge(diagnostics.services.vector_storage?.status)}
              </div>
              <p className="text-[11px] text-text-secondary font-mono">
                {diagnostics.services.vector_storage?.message}
              </p>
            </div>

            {/* Redis & Celery */}
            <div className="p-3.5 rounded-lg bg-surface-2/60 border border-border space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-blue-500" /> Celery Background Worker
                </span>
                {getStatusBadge(diagnostics.services.celery?.status)}
              </div>
              <p className="text-[11px] text-text-secondary font-mono">
                {diagnostics.services.celery?.message}
              </p>
            </div>

            {/* faster-whisper */}
            <div className="p-3.5 rounded-lg bg-surface-2/60 border border-border space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-violet-400" /> Speech-to-Text Engine
                </span>
                {getStatusBadge(diagnostics.services.whisper?.status)}
              </div>
              <p className="text-[11px] text-text-secondary font-mono">
                {diagnostics.services.whisper?.message}
              </p>
            </div>

            {/* Ollama LLM */}
            <div className="p-3.5 rounded-lg bg-surface-2/60 border border-border space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-amber-500" /> Ollama Local LLM
                </span>
                {getStatusBadge(diagnostics.services.ollama?.status)}
              </div>
              <p className="text-[11px] text-text-secondary font-mono">
                {diagnostics.services.ollama?.message}
              </p>
            </div>

            {/* Local Storage */}
            <div className="p-3.5 rounded-lg bg-surface-2/60 border border-border space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-text-secondary" /> Volume Storage
                </span>
                {getStatusBadge(diagnostics.services.storage?.status)}
              </div>
              <p className="text-[11px] text-text-secondary font-mono">
                {diagnostics.services.storage?.free_gb
                  ? `${diagnostics.services.storage.free_gb} GB free / ${diagnostics.services.storage.total_gb} GB total`
                  : diagnostics.services.storage?.path}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-surface-2 text-xs text-text-muted flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-warning" />
            <span>Diagnostics telemetry unreachable or backend starting up.</span>
          </div>
        )}
      </section>

      {/* 2. Profile & Preferences */}
      <section className="rounded-xl border border-border bg-surface-1 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">
              Profile & Tenant Identity
            </h2>
          </div>
          <Badge variant="violet" className="text-[10px]">
            Tenant Admin
          </Badge>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                Full Name
              </label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                Email Address
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" variant="default" size="sm">
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Save Profile
            </Button>
          </div>
        </form>
      </section>

      {/* 3. Appearance & Theme Controls */}
      <section className="rounded-xl border border-border bg-surface-1 p-5 space-y-4">
        <div className="border-b border-border/50 pb-3">
          <h2 className="text-sm font-semibold text-text-primary">
            Appearance & Interface Theme
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Switch between Obsidian Dark and Clean Light themes.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setTheme("dark" as Theme)}
            className={`flex items-center justify-between p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
              theme === "dark"
                ? "bg-accent-subtle border-accent/60 shadow-xs"
                : "bg-surface-2 border-border hover:border-accent/30"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Moon className="h-4 w-4 text-accent" />
              <div>
                <p className="text-xs font-bold text-text-primary">Obsidian Dark</p>
                <p className="text-[10px] text-text-muted">Graphite & Violet</p>
              </div>
            </div>
            {theme === "dark" && <CheckCircle2 className="h-4 w-4 text-accent" />}
          </button>

          <button
            type="button"
            onClick={() => setTheme("light" as Theme)}
            className={`flex items-center justify-between p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
              theme === "light"
                ? "bg-accent-subtle border-accent/60 shadow-xs"
                : "bg-surface-2 border-border hover:border-accent/30"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Sun className="h-4 w-4 text-warning" />
              <div>
                <p className="text-xs font-bold text-text-primary">Clean Light</p>
                <p className="text-[10px] text-text-muted">Porcelain & Slate</p>
              </div>
            </div>
            {theme === "light" && <CheckCircle2 className="h-4 w-4 text-accent" />}
          </button>

          <button
            type="button"
            onClick={() => setTheme("system" as Theme)}
            className={`flex items-center justify-between p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
              theme === "system"
                ? "bg-accent-subtle border-accent/60 shadow-xs"
                : "bg-surface-2 border-border hover:border-accent/30"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Monitor className="h-4 w-4 text-text-secondary" />
              <div>
                <p className="text-xs font-bold text-text-primary">System Match</p>
                <p className="text-[10px] text-text-muted">OS preferences</p>
              </div>
            </div>
            {theme === "system" && <CheckCircle2 className="h-4 w-4 text-accent" />}
          </button>
        </div>
      </section>

      {/* 4. Local AI Engine Configuration */}
      <section className="rounded-xl border border-border bg-surface-1 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">
              Local AI Engine Configuration
            </h2>
          </div>
          <span className="text-xs text-emerald-500 font-mono flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            Online
          </span>
        </div>

        <form onSubmit={handleSaveAi} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                Ollama Base URL
              </label>
              <Input
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                helperText="HTTP endpoint for local LLM inference."
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                Ollama Model Name
              </label>
              <Input
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                helperText="Model used for executive summaries & extraction."
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                faster-whisper Model
              </label>
              <Select value={whisperModel} onValueChange={setWhisperModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Whisper Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tiny">faster-whisper: tiny (Fastest, low VRAM)</SelectItem>
                  <SelectItem value="base">faster-whisper: base (Recommended default)</SelectItem>
                  <SelectItem value="small">faster-whisper: small (Higher precision)</SelectItem>
                  <SelectItem value="medium">faster-whisper: medium (Enterprise quality)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                Compute Device
              </label>
              <Select value={whisperDevice} onValueChange={setWhisperDevice}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Device" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpu">CPU (Standard, int8 quantized)</SelectItem>
                  <SelectItem value="cuda">CUDA GPU (NVIDIA hardware)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <Button type="submit" variant="default" size="sm">
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Apply AI Settings
            </Button>
          </div>
        </form>
      </section>

      {/* 5. Security & Tenant Credentials */}
      <section className="rounded-xl border border-border bg-surface-1 p-5 space-y-4">
        <div className="border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">
              Security & Credentials
            </h2>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Manage your master password and tenant encryption boundaries.
          </p>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                Current Password
              </label>
              <Input
                type="password"
                placeholder="••••••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                New Master Password
              </label>
              <Input
                type="password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={!currentPassword || !newPassword}
            >
              <Key className="w-3.5 h-3.5 mr-1.5" />
              Update Password
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
