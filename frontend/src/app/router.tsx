import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { AppShell } from "@/components/layout/app-shell";
import { Loader2 } from "lucide-react";

const LandingPage = lazy(() => import("@/features/marketing/pages/landing").then((m) => ({ default: m.LandingPage })));
const PrivacyPage = lazy(() => import("@/features/marketing/pages/privacy").then((m) => ({ default: m.PrivacyPage })));
const GoogleCompletePage = lazy(() => import("@/features/auth/pages/google-complete").then((m) => ({ default: m.GoogleCompletePage })));
const LoginPage = lazy(() =>
  import("@/features/auth/pages/login").then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import("@/features/auth/pages/register").then((m) => ({
    default: m.RegisterPage,
  })),
);
const OverviewPage = lazy(() =>
  import("@/features/workspace/pages/overview").then((m) => ({
    default: m.OverviewPage,
  })),
);
const RecordingsPage = lazy(() =>
  import("@/features/recordings/pages/recordings").then((m) => ({
    default: m.RecordingsPage,
  })),
);
const RecordingDetailPage = lazy(() =>
  import("@/features/recordings/pages/recording-detail").then((m) => ({
    default: m.RecordingDetailPage,
  })),
);
const ActionsPage = lazy(() =>
  import("@/features/actions/pages/actions").then((m) => ({
    default: m.ActionsPage,
  })),
);
const AskPage = lazy(() =>
  import("@/features/intelligence/pages/ask").then((m) => ({
    default: m.AskPage,
  })),
);
const CollectionsPage = lazy(() =>
  import("@/features/collections/pages/collections").then((m) => ({
    default: m.CollectionsPage,
  })),
);
const IntegrationsPage = lazy(() =>
  import("@/features/integrations/pages/integrations").then((m) => ({
    default: m.IntegrationsPage,
  })),
);
const DocumentationPage = lazy(() => import("@/features/integrations/pages/documentation").then((m) => ({ default: m.DocumentationPage })));
const SettingsPage = lazy(() =>
  import("@/features/settings/pages/settings").then((m) => ({
    default: m.SettingsPage,
  })),
);
const NotFoundPage = lazy(() =>
  import("@/features/workspace/pages/not-found").then((m) => ({
    default: m.NotFoundPage,
  })),
);

function ProtectedApp() { return apiClient.isAuthenticated() ? <AppShell /> : <Navigate to="/login" replace />; }

function Loading() {
  return (
    <div className="page-loading" role="status">
      <Loader2 size={24} className="animate-spin text-accent" />
      <p>Finding your place…</p>
    </div>
  );
}
function LazyPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Outlet />
    </Suspense>
  );
}
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<LazyPage />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/auth/google/complete" element={<GoogleCompletePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route element={<AppShell />}><Route element={<LazyPage />}><Route path="/app/docs" element={<DocumentationPage />} /><Route path="/docs" element={<Navigate to="/app/docs" replace />} /></Route></Route>
      <Route element={<ProtectedApp />}>
        <Route element={<LazyPage />}>
          <Route
            path="/app"
            element={<Navigate to="/app/overview" replace />}
          />
          <Route path="/app/overview" element={<OverviewPage />} />
          <Route path="/app/recordings" element={<RecordingsPage />} />
          <Route path="/app/recordings/:id" element={<RecordingDetailPage />} />
          <Route path="/app/actions" element={<ActionsPage />} />
          <Route path="/app/collections" element={<CollectionsPage />} />
          <Route path="/app/ask" element={<AskPage />} />
          <Route path="/app/api" element={<IntegrationsPage />} />
          <Route path="/app/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
