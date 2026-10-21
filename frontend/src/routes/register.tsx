import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AudioWaveform, Lock, Mail, User, ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { apiClient } from "@/lib/api-client"

export function RegisterPage() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{
    fullName?: string
    email?: string
    password?: string
    confirmPassword?: string
    general?: string
  }>({})
  const navigate = useNavigate()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return

    const newErrors: typeof errors = {}

    if (!fullName.trim()) newErrors.fullName = "Full name is required."
    if (!email.trim()) {
      newErrors.email = "Email address is required."
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      newErrors.email = "Valid email address required."
    }

    if (!password) {
      newErrors.password = "Password is required."
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters."
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match."
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    setIsLoading(true)

    try {
      const res = await apiClient.register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
      })

      const userName = res.data?.user?.fullName || res.data?.user?.email || fullName.trim()

      toast({
        title: "Account Created Successfully",
        description: `Welcome to VoxMind, ${userName}! Your personal workspace is initialized.`,
        variant: "success",
      })

      navigate("/app/overview")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create account"
      setErrors({ general: msg })
      toast({
        title: "Registration Failed",
        description: msg,
        variant: "danger",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Bar */}
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

      {/* Main Registration Form */}
      <div className="w-full max-w-md mx-auto my-auto py-8">
        <div className="rounded-xl border border-border bg-surface-1 p-6 sm:p-8 shadow-xl space-y-6">
          <div className="space-y-1.5 text-center sm:text-left">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Initialize Local Node
            </h1>
            <p className="text-xs text-text-secondary">
              Set up your local administrator account and private encrypted workspace.
            </p>
          </div>

          {errors.general && (
            <div className="p-3 text-xs text-danger bg-danger/10 border border-danger/20 rounded-md">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary block">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
                <Input
                  type="text"
                  placeholder="Elena Vance"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-9 bg-surface-2 border-border text-sm"
                  disabled={isLoading}
                />
              </div>
              {errors.fullName && (
                <p className="text-[11px] text-danger mt-1">{errors.fullName}</p>
              )}
            </div>

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
              <label className="text-xs font-medium text-text-secondary block">
                Master Password (min. 8 characters)
              </label>
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

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary block">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-9 bg-surface-2 border-border text-sm"
                  disabled={isLoading}
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-[11px] text-danger mt-1">{errors.confirmPassword}</p>
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
                  Initializing Node...
                </>
              ) : (
                <>
                  Initialize Workspace
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="text-center pt-2 border-t border-border">
            <p className="text-xs text-text-secondary">
              Already initialized this node?{" "}
              <Link to="/login" className="text-accent hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-6xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between text-[11px] text-text-muted gap-2">
        <span>VoxMind Local-First Intelligence — Local persistence mode</span>
        <span>Version 1.0.0 (Release)</span>
      </div>
    </div>
  )
}
