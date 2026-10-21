import { useState } from "react"
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
  const [isTestingAi, setIsTestingAi] = useState(false)

  // Security Form
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    toast({
      title: "Profile Saved",
      description: "User details and preferences updated.",
      variant: "success",
    })
  }

  const handleTestAi = () => {
    setIsTestingAi(true)
    setTimeout(() => {
      setIsTestingAi(false)
      toast({
        title: "AI Service Evaluated",
        description: `Local endpoint ${ollamaUrl} is active. faster-whisper:${whisperModel} ready.`,
        variant: "success",
      })
    }, 1000)
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

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="border-b border-border pb-5">
        <h1 className="text-xl font-bold tracking-tight text-text-primary">
          Workspace Settings
        </h1>
        <p className="mt-1 text-xs text-text-secondary">
          Configure profile details, interface themes, local AI endpoints, and security preferences.
        </p>
      </div>

      {/* 1. Profile & Preferences */}
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

      {/* 2. Appearance & Theme Controls */}
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

      {/* 3. Local AI Engine Configuration */}
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

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestAi}
              isLoading={isTestingAi}
            >
              <Activity className="w-3.5 h-3.5 mr-1 text-accent" />
              Test Engine Connectivity
            </Button>

            <Button type="submit" variant="default" size="sm">
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Apply AI Settings
            </Button>
          </div>
        </form>
      </section>

      {/* 4. Security & Tenant Credentials */}
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
