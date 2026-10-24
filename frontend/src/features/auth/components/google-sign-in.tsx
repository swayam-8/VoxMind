import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { apiClient, API_BASE } from "@/lib/api-client";

export function GoogleSignIn() {
  const [params] = useSearchParams();
  const configuration = useQuery({ queryKey: ["google-login-config"], queryFn: () => apiClient.get<{ configured: boolean }>("/auth/google/config"), retry: false });
  const reason = params.get("reason");
  const error = params.get("google") === "error" ? reason === "GOOGLE_LINK_REQUIRED" ? "This email already has an account. Sign in with your password, then connect Google in Settings." : reason === "OAUTH_ACCESS_DENIED" ? "Google sign-in was cancelled. You can try again or use your password." : "Google sign-in could not finish. Please start again in this browser." : "";
  return <div className="google-sign-in">
    {error && <p role="alert" className="auth-error">{error}</p>}
    {configuration.data?.data.configured ? <a className="google-sign-in-button" href={`${API_BASE}/auth/google/start`}>
      <GoogleMark /> Continue with Google
    </a> : <button type="button" className="google-sign-in-button" disabled><GoogleMark /> {configuration.isLoading ? "Checking Google sign-in…" : "Google sign-in unavailable"}</button>}
    {!configuration.isLoading && !configuration.data?.data.configured && <p className="google-sign-in-note">You can use email and password below. Google sign-in becomes available once enabled by the service operator.</p>}
    <div className="auth-divider"><span />or continue with email<span /></div>
  </div>;
}
export function GoogleMark() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.23-2.51c-.9.6-2.05.96-3.39.96-2.61 0-4.83-1.77-5.62-4.15H3.04v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.38 13.89a6 6 0 0 1 0-3.78V7.52H3.04a10 10 0 0 0 0 8.96l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.34 2.59C7.17 7.73 9.39 5.96 12 5.96Z"/></svg>;
}
