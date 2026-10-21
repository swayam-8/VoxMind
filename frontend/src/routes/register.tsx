import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AudioWaveform, Lock, Mail, User, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import { ThemeToggle } from "@/components/layout/theme-toggle"

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
  }>({})
  const navigate = useNavigate()

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: typeof errors = {}

    if (!fullName) newErrors.fullName = "Full name is required."
    if (!email) {
      newErrors.email = "Email address is required."
    } else if (!/\S+@\S+\.\S+/.test(email)) {
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

    setTimeout(() => {
      setIsLoading(false)
      localStorage.setItem("voxmind_access_token", "demo_jwt_session_token_xyz")
      toast({
        title: "Account Created",
        description: "Your local tenant workspace has been initialized.",
        variant: "success",
      })
      navigate("/app/overview")
    }, 800)
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

      {/* Main Register Box */}
      <div className="w-full max-w-md mx-auto my-auto py-8">
        <div className="rounded-xl border border-border bg-surface-1 p-6 sm:p-8 shadow-xl space-y-6">
          <div className="space-y-1.5 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Create Your Workspace
            </h1>
            <p className="text-xs text-text-secondary">
              Set up your local-first voice intelligence account.
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-text-muted" />
                Full Name
              </label>
              <Input
                placeholder="Elena Vance"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                error={!!errors.fullName}
                helperText={errors.fullName}
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-text-muted" />
                Work Email
              </label>
              <Input
                type="email"
                placeholder="elena@company.internal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!!errors.email}
                helperText={errors.email}
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-text-muted" />
                Master Password
              </label>
              <Input
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={!!errors.password}
                helperText={errors.password}
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                Confirm Password
              </label>
              <Input
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={!!errors.confirmPassword}
                helperText={errors.confirmPassword}
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              variant="default"
              className="w-full"
              isLoading={isLoading}
            >
              Initialize Workspace <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </form>

          <div className="text-center text-xs text-text-secondary">
            Already have an account?{" "}
            <Link to="/login" className="text-accent font-medium hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-text-muted max-w-md mx-auto">
        Your data never leaves your environment. No telemetry tracking or external proxies.
      </div>
    </div>
  )
}
