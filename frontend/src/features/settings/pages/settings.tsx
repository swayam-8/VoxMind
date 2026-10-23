import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
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
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/hooks/use-theme";
import type { Theme } from "@/contexts/theme-context";
import { toast } from "@/hooks/use-toast";
import { apiClient, type ApiDiagnostics } from "@/lib/api-client";

export function SettingsPage() {
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  // Profile State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // AI Configuration State (Reflective of node diagnostics)
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("llama3.2");
  const [whisperModel, setWhisperModel] = useState("base");
  const [whisperDevice, setWhisperDevice] = useState("cpu");

  // Security Form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Diagnostics Hub State
  const [diagnostics, setDiagnostics] = useState<ApiDiagnostics | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);

  useEffect(() => {
    let ignore = false;

    // Load diagnostics and user profile concurrently
    const loadInitialData = async () => {
      try {
        setDiagnosticsLoading(true);
        const [diagRes, userRes] = await Promise.allSettled([
          apiClient.getDiagnostics(),
          apiClient.getCurrentUser(),
        ]);

        if (!ignore) {
          if (diagRes.status === "fulfilled" && diagRes.value.data) {
            const d = diagRes.value.data;
            setDiagnostics(d);
            if (d.services?.ollama?.base_url)
              setOllamaUrl(d.services.ollama.base_url);
            if (d.services?.ollama?.configured_model)
              setOllamaModel(d.services.ollama.configured_model);
            if (d.services?.whisper?.model)
              setWhisperModel(d.services.whisper.model);
            if (d.services?.whisper?.device)
              setWhisperDevice(d.services.whisper.device);
          }

          if (userRes.status === "fulfilled" && userRes.value.data?.user) {
            setFullName(userRes.value.data.user.fullName || "");
            setEmail(userRes.value.data.user.email || "");
          }
        }
      } finally {
        if (!ignore) setDiagnosticsLoading(false);
      }
    };

    void loadInitialData();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (location.hash === "#diagnostics") {
      const el = document.getElementById("diagnostics");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [location.hash]);

  const handleRefreshDiagnostics = async () => {
    try {
      setDiagnosticsLoading(true);
      const res = await apiClient.getDiagnostics();
      setDiagnostics(res.data);
      toast({
        title: "Diagnostics Refreshed",
        description: "Live node telemetry updated successfully.",
        variant: "success",
      });
    } catch {
      setDiagnostics(null);
      toast({
        title: "Telemetry Failed",
        description: "Could not reach diagnostics endpoint.",
        variant: "danger",
      });
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    try {
      setIsSavingProfile(true);
      const res = await apiClient.updateProfile({ fullName: fullName.trim() });
      if (res.data?.user?.fullName) {
        setFullName(res.data.user.fullName);
      }
      toast({
        title: "Profile Saved",
        description: "User details updated successfully in database.",
        variant: "success",
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to update profile";
      toast({
        title: "Update Failed",
        description: msg,
        variant: "danger",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveAi = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Node Configuration Note",
      description:
        "AI inference models are configured at the host level via environment variables (OLLAMA_MODEL, WHISPER_MODEL).",
      variant: "success",
    });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast({
        title: "Validation Error",
        description: "Both current and new passwords are required.",
        variant: "danger",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Validation Error",
        description: "New password must be at least 8 characters long.",
        variant: "danger",
      });
      return;
    }

    try {
      setIsUpdatingPassword(true);
      await apiClient.updateProfile({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      toast({
        title: "Password Updated",
        description: "Your master password was changed successfully.",
        variant: "success",
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to update password";
      toast({
        title: "Password Change Failed",
        description: msg,
        variant: "danger",
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "healthy":
        return (
          <Badge variant="success" className="text-xs flex items-center gap-1">
            <CheckCircle2 className="w-5 h-5" /> Healthy
          </Badge>
        );
      case "degraded":
        return (
          <Badge variant="warning" className="text-xs flex items-center gap-1">
            <AlertCircle className="w-5 h-5" /> Degraded
          </Badge>
        );
      case "unreachable":
      case "unhealthy":
        return (
          <Badge variant="danger" className="text-xs flex items-center gap-1">
            <AlertCircle className="w-5 h-5" /> Unreachable
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs flex items-center gap-1">
            <HelpCircle className="w-5 h-5" /> Offline
          </Badge>
        );
    }
  };

  return (
    <div className="feature-page settings-page space-y-8">
      {/* Header */}
      <div className="border-b border-border pb-5">
        <p className="eyebrow mb-3">THE WAY YOU WORK</p>
        <h1 className="text-xl font-bold tracking-tight text-text-primary">
          Make yourself at home
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Your profile, your preferences, your workspace.
        </p>
      </div>

      {/* 1. Live System Diagnostics Hub */}
      <section
        id="diagnostics"
        className="rounded-xl border border-border bg-surface-1 p-5 space-y-4 scroll-mt-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                Live Diagnostics Hub
              </h2>
              <p className="text-xs text-text-muted">
                Real-time connectivity and status across local AI runtimes and
                database engines.
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
              className="h-8 text-sm"
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
                <span className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                  <Database className="w-5 h-5 text-accent" /> Primary Database
                </span>
                {getStatusBadge(diagnostics.services.database?.status)}
              </div>
              <p className="text-xs text-text-secondary font-mono">
                {diagnostics.services.database?.message ||
                  "MongoDB Operational"}
              </p>
            </div>

            {/* Vector Storage */}
            <div className="p-3.5 rounded-lg bg-surface-2/60 border border-border space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                  <Layers className="w-5 h-5 text-success" /> Vector Retrieval
                  Engine
                </span>
                {getStatusBadge(diagnostics.services.vector_storage?.status)}
              </div>
              <p className="text-xs text-text-secondary font-mono">
                {diagnostics.services.vector_storage?.message ||
                  "Cosine Similarity Retrieval Active"}
              </p>
            </div>

            {/* BullMQ Worker / Redis */}
            <div className="p-3.5 rounded-lg bg-surface-2/60 border border-border space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                  <Server className="w-5 h-5 text-blue-500" /> BullMQ
                  Asynchronous Queues
                </span>
                {getStatusBadge(
                  diagnostics.services.celery?.status ||
                    diagnostics.services.redis?.status,
                )}
              </div>
              <p className="text-xs text-text-secondary font-mono">
                {diagnostics.services.celery?.message ||
                  "BullMQ Audio & AI Queues Initialized"}
              </p>
            </div>

            {/* faster-whisper */}
            <div className="p-3.5 rounded-lg bg-surface-2/60 border border-border space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                  <Radio className="w-5 h-5 text-violet-400" /> Speech-to-Text
                  Engine
                </span>
                {getStatusBadge(diagnostics.services.whisper?.status)}
              </div>
              <p className="text-xs text-text-secondary font-mono">
                {diagnostics.services.whisper?.message ||
                  "faster-whisper CPU int8"}
              </p>
            </div>

            {/* Ollama LLM */}
            <div className="p-3.5 rounded-lg bg-surface-2/60 border border-border space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                  <Cpu className="w-5 h-5 text-amber-500" /> Ollama Local LLM
                </span>
                {getStatusBadge(diagnostics.services.ollama?.status)}
              </div>
              <p className="text-xs text-text-secondary font-mono">
                {diagnostics.services.ollama?.message ||
                  "Ollama Model Pipeline"}
              </p>
            </div>

            {/* Local Storage */}
            <div className="p-3.5 rounded-lg bg-surface-2/60 border border-border space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                  <HardDrive className="w-5 h-5 text-text-secondary" /> Audio
                  Storage Volume
                </span>
                {getStatusBadge(diagnostics.services.storage?.status)}
              </div>
              <p className="text-xs text-text-secondary font-mono">
                {diagnostics.services.storage?.message ||
                  diagnostics.services.storage?.path}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-surface-2 text-sm text-text-muted flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-warning" />
            <span>
              Diagnostics telemetry unreachable or backend starting up.
            </span>
          </div>
        )}
      </section>

      {/* 2. Profile & Preferences */}
      <section className="rounded-xl border border-border bg-surface-1 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">
              Your profile
            </h2>
          </div>
          <Badge variant="violet" className="text-xs">
            Tenant Admin
          </Badge>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="settings-field-1"
                className="text-sm font-medium text-text-secondary mb-1.5 block"
              >
                Full Name
              </label>
              <Input
                id="settings-field-1"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Elena Vance"
                disabled={isSavingProfile}
              />
            </div>

            <div>
              <label
                htmlFor="settings-field-2"
                className="text-sm font-medium text-text-secondary mb-1.5 block"
              >
                Email Address
              </label>
              <Input
                id="settings-field-2"
                type="email"
                value={email}
                disabled
                className="opacity-75 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={isSavingProfile}
            >
              {isSavingProfile ? (
                <>
                  <Loader2 className="w-5 h-5 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-1.5" />
                  Save Profile
                </>
              )}
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
          <p className="text-sm text-text-muted mt-0.5">
            Switch between Studio dark and Paper light themes.
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
              <Moon className="h-5 w-5 text-accent" />
              <div>
                <p className="text-sm font-bold text-text-primary">
                  Studio dark
                </p>
                <p className="text-xs text-text-muted">Graphite & blue</p>
              </div>
            </div>
            {theme === "dark" && (
              <CheckCircle2 className="h-5 w-5 text-accent" />
            )}
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
              <Sun className="h-5 w-5 text-warning" />
              <div>
                <p className="text-sm font-bold text-text-primary">
                  Paper light
                </p>
                <p className="text-xs text-text-muted">White & blue</p>
              </div>
            </div>
            {theme === "light" && (
              <CheckCircle2 className="h-5 w-5 text-accent" />
            )}
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
              <Monitor className="h-5 w-5 text-text-secondary" />
              <div>
                <p className="text-sm font-bold text-text-primary">
                  System Match
                </p>
                <p className="text-xs text-text-muted">OS preferences</p>
              </div>
            </div>
            {theme === "system" && (
              <CheckCircle2 className="h-5 w-5 text-accent" />
            )}
          </button>
        </div>
      </section>

      {/* 4. Local AI Engine Configuration */}
      <section className="rounded-xl border border-border bg-surface-1 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">
              Local AI Engine Configuration
            </h2>
          </div>
          <span className="text-sm text-success font-mono flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-success inline-block animate-pulse" />
            Node-managed
          </span>
        </div>

        <form onSubmit={handleSaveAi} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="settings-field-3"
                className="text-sm font-medium text-text-secondary mb-1.5 block"
              >
                Ollama Base URL
              </label>
              <Input
                id="settings-field-3"
                value={ollamaUrl}
                readOnly
                className="opacity-80"
                helperText="Host environment variable: OLLAMA_BASE_URL"
              />
            </div>

            <div>
              <label
                htmlFor="settings-field-4"
                className="text-sm font-medium text-text-secondary mb-1.5 block"
              >
                Ollama Model Name
              </label>
              <Input
                id="settings-field-4"
                value={ollamaModel}
                readOnly
                className="opacity-80"
                helperText="Host environment variable: OLLAMA_MODEL"
              />
            </div>

            <div>
              <label
                htmlFor="settings-field-5"
                className="text-sm font-medium text-text-secondary mb-1.5 block"
              >
                faster-whisper Model
              </label>
              <Input
                id="settings-field-5"
                value={whisperModel}
                readOnly
                className="opacity-80"
                helperText="Host environment variable: WHISPER_MODEL"
              />
            </div>

            <div>
              <label
                htmlFor="settings-field-6"
                className="text-sm font-medium text-text-secondary mb-1.5 block"
              >
                Compute Device
              </label>
              <Input
                id="settings-field-6"
                value={whisperDevice}
                readOnly
                className="opacity-80"
                helperText="Host environment variable: WHISPER_DEVICE"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-surface-2/60 border border-border text-xs text-text-muted flex items-start gap-2">
            <HelpCircle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <span>
              In VoxMind's local-first architecture, hardware models and
              endpoints are configured node-wide via environment variables. To
              change models, update <code>OLLAMA_MODEL</code> or{" "}
              <code>WHISPER_MODEL</code> in your configuration.
            </span>
          </div>
        </form>
      </section>

      {/* 5. Security & Tenant Credentials */}
      <section className="rounded-xl border border-border bg-surface-1 p-5 space-y-4">
        <div className="border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">
              Password & security
            </h2>
          </div>
          <p className="text-sm text-text-muted mt-0.5">
            Manage your master password and tenant encryption boundaries.
          </p>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="settings-field-7"
                className="text-sm font-medium text-text-secondary mb-1.5 block"
              >
                Current Password
              </label>
              <Input
                id="settings-field-7"
                type="password"
                placeholder="••••••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isUpdatingPassword}
              />
            </div>

            <div>
              <label
                htmlFor="settings-field-8"
                className="text-sm font-medium text-text-secondary mb-1.5 block"
              >
                New Master Password
              </label>
              <Input
                id="settings-field-8"
                type="password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isUpdatingPassword}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={!currentPassword || !newPassword || isUpdatingPassword}
            >
              {isUpdatingPassword ? (
                <>
                  <Loader2 className="w-5 h-5 mr-1.5 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Key className="w-5 h-5 mr-1.5" />
                  Update Password
                </>
              )}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
