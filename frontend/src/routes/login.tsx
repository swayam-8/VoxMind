import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AudioWaveform, Lock, Mail, ArrowRight, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import { ThemeToggle } from "@/components/layout/theme-toggle"

export function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const navigate = useNavigate()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: { email?: string; password?: string } = {}

    if (!email) {
      newErrors.email = "Email address is required."
    } else if (!/\S+@\S+\.\S+/.test(email)) {
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

    setTimeout(() => {
      setIsLoading(false)
      localStorage.setItem("voxmind_access_token", "demo_jwt_session_token_xyz")
      toast({
        title: "Welcome Back",
        description: `Signed in successfully as ${email}`,
        variant: "success",
      })
      navigate("/app/overview")
    }, 700)
  }

  const fillDemoCredentials = () => {
    setEmail("jane.doe@voxmind.internal")
    setPassword("ObsidianVoice2026!")
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
          <div className="space-y-1.5 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Sign In to VoxMind
            </h1>
            <p className="text-xs text-text-secondary">
              Local-first voice intelligence platform with tenant isolation.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-text-muted" />
                Work Email
              </label>
              <Input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!!errors.email}
                helperText={errors.email}
                disabled={isLoading}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-text-muted" />
                  Password
                </label>
                <span className="text-[11px] text-accent hover:underline cursor-pointer">
                  Forgot password?
                </span>
              </div>
              <Input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={!!errors.password}
                helperText={errors.password}
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              variant="default"
              className="w-full"
              isLoading={isLoading}
            >
              Sign In <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </form>

          {/* Quick Demo Credentials Autofill */}
          <div className="pt-2 border-t border-border/60">
            <button
              type="button"
              onClick={fillDemoCredentials}
              className="w-full py-2 px-3 rounded-md bg-surface-2 border border-border text-xs text-text-secondary hover:text-text-primary hover:border-accent/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-accent" />
              <span>Autofill Demo Credentials</span>
            </button>
          </div>

          <div className="text-center text-xs text-text-secondary">
            Don't have an account?{" "}
            <Link to="/register" className="text-accent font-medium hover:underline">
              Create account
            </Link>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="text-center text-xs text-text-muted max-w-md mx-auto">
        Protected by local tenant isolation. Audio and transcripts remain encrypted and hosted on authorized infrastructure.
      </div>
    </div>
  )
}
