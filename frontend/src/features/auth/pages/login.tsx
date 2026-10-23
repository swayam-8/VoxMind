import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { AuthLayout } from "../components/auth-layout";
import { apiClient } from "@/lib/api-client";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    general?: string;
  }>({});
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const newErrors: { email?: string; password?: string; general?: string } =
      {};

    if (!email.trim()) {
      newErrors.email = "Email address is required.";
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (!password) {
      newErrors.password = "Password is required.";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const res = await apiClient.login(email.trim(), password);
      if (res.data?.user) {
        localStorage.setItem("voxmind_user", JSON.stringify(res.data.user));
      }
      const userName =
        res.data?.user?.fullName || res.data?.user?.email || email.trim();

      toast({
        title: "Welcome Back",
        description: `Signed in successfully as ${userName}`,
        variant: "success",
      });

      queryClient.clear();
      navigate("/app/overview");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Invalid email or password.";
      setErrors({ general: msg });
      toast({
        title: "Authentication Failed",
        description: msg,
        variant: "danger",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-form">
        <span className="eyebrow">WELCOME TO YOUR WORKSPACE</span>
        <h1>Good to have you back.</h1>
        <p>Sign in and pick up the conversation.</p>
        {errors.general && (
          <div role="alert" className="auth-error">
            {errors.general}
          </div>
        )}
        <form onSubmit={handleLogin} noValidate>
          <label className="auth-field" htmlFor="email">
            Email address
            <Input
              id="email"
              autoComplete="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
            {errors.email && <small id="email-error">{errors.email}</small>}
          </label>
          <label className="auth-field" htmlFor="password">
            Password
            <Input
              id="password"
              autoComplete="current-password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
            />
            {errors.password && (
              <small id="password-error">{errors.password}</small>
            )}
          </label>
          <Button type="submit" isLoading={isLoading} className="w-full mt-2">
            {isLoading ? "Signing in…" : "Open your workspace"}
            <ArrowRight size={16} />
          </Button>
        </form>
        <div className="auth-switch">
          New here? <Link to="/register">Create a workspace</Link>
        </div>
      </div>
    </AuthLayout>
  );
}
