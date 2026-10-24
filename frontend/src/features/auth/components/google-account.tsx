import { useSignInMethods } from "../hooks/use-sign-in-methods";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GoogleMark } from "./google-sign-in";

export function GoogleAccount() {
  const client = useQueryClient();
  const [password, setPassword] = useState("");
  const status = useSignInMethods();
  const connect = useMutation({ mutationFn: () => apiClient.post<{ authorize_url: string }>("/auth/google/connect", { currentPassword: password }, { credentials: "include" }), onSuccess: (res) => window.location.assign(res.data.authorize_url) });
  const disconnect = useMutation({ mutationFn: () => apiClient.delete("/auth/google/connection", { body: JSON.stringify({ currentPassword: password }) }), onSuccess: () => { setPassword(""); client.invalidateQueries({ queryKey: ["google-account"] }); } });
  const data = status.data?.data;
  return <section className="google-account-panel rounded-xl border border-border bg-surface-1 p-5 space-y-4">
    <div className="flex items-center gap-3"><GoogleMark /><h2 className="text-base font-semibold">Google sign-in</h2></div>
    {status.isLoading ? <p role="status" className="text-sm text-text-muted">Checking sign-in methods…</p> : status.isError ? <div role="alert"><p>Could not load your Google connection.</p><Button variant="outline" onClick={() => status.refetch()}>Try again</Button></div> : <>
      <p className="text-sm text-text-secondary">{data?.connected ? "Google is connected as a sign-in method for this account." : "Connect Google to sign in without entering your MeetingBrief password. This does not grant access to meeting recordings."}</p>
      {data?.has_password && data.configured && <label className="block text-sm text-text-secondary">Confirm your current password<Input type="password" autoComplete="current-password" aria-label="Password to manage Google sign-in" className="mt-2 max-w-md" value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
      {data?.configured ? data.connected && !data.has_password ? <p className="text-xs text-text-muted">Google is your sign-in method. Keep it connected to retain access to your account.</p> : <Button variant="outline" isLoading={connect.isPending || disconnect.isPending} disabled={data.has_password && !password} onClick={() => data.connected ? disconnect.mutate() : connect.mutate()}>{data.connected ? "Disconnect Google sign-in" : "Connect Google sign-in"}</Button> : <p className="text-xs text-text-muted">Google sign-in has not been enabled by the service operator yet.</p>}
    </>}
    {(connect.isError || disconnect.isError) && <p role="alert" className="text-sm text-danger">{(connect.error || disconnect.error)?.message}</p>}
  </section>;
}
