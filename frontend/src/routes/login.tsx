import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AudioWaveform, Lock, Mail, ArrowRight, ShieldCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { apiClient } from "@/lib/api-client"

export function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({})
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return

    const newErrors: { email?: string; password?: string; general?: string } = {}

    if (!email.trim()) {
      newErrors.email = "Email address is required."
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      newErrors.email = "Please enter a valid email address."
    }

    if (!password) {
      newErrors.password = "Password is required."
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters."
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    setIsLoading(true)

    try {
      const res = await apiClient.login(email.trim(), password)
      const userName = res.data?.user?.fullName || res.data?.user?.email || email.trim()

      toast({
        title: "Welcome Back",
        description: `Signed in successfully as ${userName}`,
        variant: "success",
      })

      navigate("/app/overview")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid email or password."
      setErrors({ general: msg })
      toast({
        title: "Authentication Failed",
        description: msg,
        variant: "danger",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fillDemoCredentials = () => {
    setEmail("admin@voxmind.internal")
    setPassword("voxmind2026")
    setErrors({})
  }

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Bar with Brand & Theme Toggle */}
      <div className="flex items-center justify-between max-w-6xl w-full mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-subtle border border-accent/30 text-accent">
            <AudioWaveform className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-text-primary">
              VoxMind
            </span>
            <span className="text-[10px] text-text-muted font-mono tracking-wider">
              LOCAL VOICE INTELLIGENCE
            </span>
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* Main Login Form Container */}
      <div className="w-full max-w-md mx-auto my-auto py-8">
        <div className="rounded-xl border border-border bg-surface-1 p-6 sm:p-8 shadow-xl space-y-6">
          <div className="space-y-1.5 text-center sm:text-left">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Welcome back
            </h1>
            <p className="text-xs text-text-secondary">
              Enter your credentials to access your local intelligence workspace.
            </p>
          </div>

          {errors.general && (
            <div className="p-3 text-xs text-danger bg-danger/10 border border-danger/20 rounded-md">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary block">
                Work Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
                <Input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 bg-surface-2 border-border text-sm"
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className="text-[11px] text-danger mt-1">{errors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-text-secondary block">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 bg-surface-2 border-border text-sm"
                  disabled={isLoading}
                />
              </div>
              {errors.password && (
                <p className="text-[11px] text-danger mt-1">{errors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in to Workspace
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          {/* Quick Demo Credentials Access */}
          <div className="rounded-lg bg-surface-2/60 border border-border/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-text-secondary flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                Pre-configured Workspace Demo
              </span>
              <button
                type="button"
                onClick={fillDemoCredentials}
                className="text-[11px] text-accent hover:underline font-mono"
              >
                Auto-fill
              </button>
            </div>
            <p className="text-[10px] text-text-muted">
              Auto-fills credentials for the default local administrator workspace.
            </p>
          </div>

          <div className="text-center pt-2 border-t border-border">
            <p className="text-xs text-text-secondary">
              Don't have a workspace yet?{" "}
              <Link
                to="/register"
                className="text-accent hover:underline font-medium"
              >
                Register your local node
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-6xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between text-[11px] text-text-muted gap-2">
        <span>VoxMind Local-First Intelligence — Single-tenant architecture</span>
        <span>Version 1.0.0 (Release)</span>
      </div>
    </div>
  )
}
