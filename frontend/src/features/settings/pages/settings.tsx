import { useSignInMethods } from "@/features/auth/hooks/use-sign-in-methods";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Moon, Sun, Monitor, ShieldCheck, Save, KeyRound } from "lucide-react";
import { GoogleAccount } from "@/features/auth/components/google-account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/hooks/use-theme";
import type { Theme } from "@/contexts/theme-context";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";

export function SettingsPage() {
  const client = useQueryClient();
  const { theme, setTheme } = useTheme();
  const profile = useQuery({ queryKey: ["current-user"], queryFn: () => apiClient.getCurrentUser() });
  const methods = useSignInMethods();
  const [name, setName] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const user = profile.data?.data.user;
  const saveProfile = useMutation({
    mutationFn: () => apiClient.updateProfile({ fullName: (name ?? user?.fullName ?? "").trim() }),
    onSuccess: (result) => {
      localStorage.setItem("voxmind_user", JSON.stringify(result.data.user));
      client.setQueryData(["current-user"], result); setName(null);
      toast({ title: "Profile saved", description: "Your account details are up to date.", variant: "success" });
    },
  });
  const changePassword = useMutation({
    mutationFn: () => apiClient.updateProfile({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword(""); setNewPassword(""); setConfirmation(""); setPasswordError("");
      toast({ title: "Password changed", description: "Older sessions and API keys have been invalidated. Your current session remains signed in.", variant: "success" });
    },
  });
  const submitPassword = (event: React.FormEvent) => {
    event.preventDefault(); setPasswordError("");
    if (newPassword.length < 8 || new TextEncoder().encode(newPassword).length > 72) return setPasswordError("Use at least 8 characters and no more than 72 UTF-8 bytes.");
    if (newPassword !== confirmation) return setPasswordError("The new passwords do not match.");
    changePassword.mutate();
  };
  return <div className="feature-page settings-page space-y-7">
    <div className="border-b border-border pb-5"><p className="eyebrow mb-3">MAKE IT YOURS</p><h1>Your account, your way.</h1><p className="text-text-secondary">Manage your profile, appearance, and sign-in methods.</p></div>
    <section className="rounded-xl border border-border bg-surface-1 p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-3"><span className="panel-icon"><User /></span><div><h2 className="font-semibold">Your profile</h2><p className="text-xs text-text-muted mt-1">The details associated with your account.</p></div></div>
      {profile.isLoading ? <p role="status" className="text-sm text-text-muted">Loading your profile…</p> : profile.isError ? <div role="alert" className="text-sm text-danger space-y-2"><p>Could not load your profile. Your session may have expired.</p><Link className="text-link" to="/login">Sign in again</Link></div> : <form onSubmit={(event) => { event.preventDefault(); saveProfile.mutate(); }} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4"><label className="text-sm text-text-secondary">Full name<Input className="mt-2" autoComplete="name" maxLength={120} value={name ?? user?.fullName ?? ""} onChange={(event) => setName(event.target.value)} required /></label><label className="text-sm text-text-secondary">Email address<Input className="mt-2" type="email" value={user?.email || ""} disabled /></label></div>
        {saveProfile.isError && <p role="alert" className="text-sm text-danger">{saveProfile.error.message}</p>}
        <div className="flex justify-end"><Button type="submit" isLoading={saveProfile.isPending} disabled={!(name ?? user?.fullName ?? "").trim()}><Save /> Save profile</Button></div>
      </form>}
    </section>
    <section className="rounded-xl border border-border bg-surface-1 p-5 sm:p-6 space-y-5">
      <div><h2 className="font-semibold">Appearance</h2><p className="text-sm text-text-muted mt-1">Choose a look that feels right for your workspace.</p></div>
      <div className="grid sm:grid-cols-3 gap-3">{[{ value: "light", title: "Paper light", detail: "Clean, bright, and focused", icon: Sun }, { value: "dark", title: "Studio dark", detail: "Graphite with cobalt accents", icon: Moon }, { value: "system", title: "Match your device", detail: "Follow your system setting", icon: Monitor }].map(({ value, title, detail, icon: Icon }) => <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value as Theme)} className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-colors ${theme === value ? "bg-accent-subtle border-accent/40" : "bg-surface-1 border-border hover:bg-surface-2"}`}><Icon className="w-6 h-6 shrink-0 text-accent" /><span><strong className="block text-sm font-semibold">{title}</strong><span className="block text-xs text-text-muted mt-1">{detail}</span></span></button>)}</div>
    </section>
    <GoogleAccount />
    <section className="rounded-xl border border-border bg-surface-1 p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-3"><span className="panel-icon"><ShieldCheck /></span><div><h2 className="font-semibold">Password & security</h2><p className="text-xs text-text-muted mt-1">Keep your account access up to date.</p></div></div>
      {methods.data?.data.has_password === false ? <p className="text-sm text-text-secondary">You sign in with Google. Manage that account’s password through Google’s account security settings.</p> : <form onSubmit={submitPassword} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4"><label className="text-sm text-text-secondary">Current password<Input className="mt-2" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label><span className="hidden sm:block" /><label className="text-sm text-text-secondary">New password<Input className="mt-2" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label><label className="text-sm text-text-secondary">Confirm new password<Input className="mt-2" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label></div>
        <p className="text-xs text-text-muted">Changing your password signs out older sessions and revokes your API keys. You will need to create replacement keys for your integrations.</p>
        {(passwordError || changePassword.isError) && <p role="alert" className="text-sm text-danger">{passwordError || changePassword.error?.message}</p>}
        <div className="flex justify-end"><Button type="submit" variant="outline" isLoading={changePassword.isPending}><KeyRound /> Change password</Button></div>
      </form>}
    </section>
    <p className="text-sm text-text-muted">Need help connecting a provider or using the API? <Link className="text-link" to="/app/docs">Read the MeetingBrief guides</Link>.</p>
  </div>;
}
