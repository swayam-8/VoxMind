import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { AuthLayout } from "../components/auth-layout";
import { apiClient } from "@/lib/api-client";

export function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const newErrors: typeof errors = {};

    if (!fullName.trim()) newErrors.fullName = "Full name is required.";
    if (!email.trim()) {
      newErrors.email = "Email address is required.";
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      newErrors.email = "Valid email address required.";
    }

    if (!password) {
      newErrors.password = "Password is required.";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters.";
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const res = await apiClient.register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
      });

      if (res.data?.user)
        localStorage.setItem("voxmind_user", JSON.stringify(res.data.user));
      const userName =
        res.data?.user?.fullName || res.data?.user?.email || fullName.trim();

      toast({
        title: "Account Created Successfully",
        description: `Welcome to VoxMind, ${userName}! Your personal workspace is initialized.`,
        variant: "success",
      });

      queryClient.clear();
      navigate("/app/overview");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to create account";
      setErrors({ general: msg });
      toast({
        title: "Registration Failed",
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
        <span className="eyebrow">MAKE ROOM FOR YOUR IDEAS</span>
        <h1>A fresh perspective.</h1>
        <p>Create your workspace. Start making more of every conversation.</p>
        {errors.general && (
          <div role="alert" className="auth-error">
            {errors.general}
          </div>
        )}
        <form onSubmit={handleRegister} noValidate>
          <label className="auth-field" htmlFor="fullName">
            Your name
            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              placeholder="Alex Morgan"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isLoading}
              aria-invalid={!!errors.fullName}
              aria-describedby={errors.fullName ? "fullName-error" : undefined}
            />
            {errors.fullName && (
              <small id="fullName-error">{errors.fullName}</small>
            )}
          </label>
          <label className="auth-field" htmlFor="email">
            Email address
            <Input
              id="email"
              type="email"
              autoComplete="email"
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
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
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
          <label className="auth-field" htmlFor="confirmPassword">
            Confirm password
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="One more time"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={
                errors.confirmPassword ? "confirmPassword-error" : undefined
              }
            />
            {errors.confirmPassword && (
              <small id="confirmPassword-error">{errors.confirmPassword}</small>
            )}
          </label>
          <Button type="submit" isLoading={isLoading} className="w-full mt-2">
            {isLoading ? "Creating your workspace…" : "Create workspace"}
            <ArrowRight size={16} />
          </Button>
        </form>
        <div className="auth-switch">
          Already have a workspace? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </AuthLayout>
  );
}
