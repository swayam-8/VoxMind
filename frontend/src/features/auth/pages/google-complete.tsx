import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { AuthLayout } from "../components/auth-layout";
import { ActivityIndicator } from "@/components/ui/activity-indicator";

export function GoogleCompletePage() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const session = useQuery({ queryKey: ["google-sign-in-exchange"], queryFn: () => apiClient.post<{ access_token: string; user: { id: string; email: string; fullName: string } }>("/auth/google/session", {}, { credentials: "include" }), retry: false, staleTime: Infinity });
  useEffect(() => {
    if (session.data?.data.access_token) {
      localStorage.setItem("voxmind_access_token", session.data.data.access_token);
      localStorage.setItem("voxmind_user", JSON.stringify(session.data.data.user));
      client.clear(); navigate("/app/overview", { replace: true });
    }
  }, [session.data, client, navigate]);
  return <AuthLayout><div className="auth-form"><h1>Welcome to MeetingBrief.</h1>{session.isError ? <div role="alert" className="auth-error"><p>Your sign-in could not finish or has expired.</p><Link to="/login">Return to sign in</Link></div> : <ActivityIndicator title="Opening your workspace" description="Finishing your secure Google sign-in." />}</div></AuthLayout>;
}
