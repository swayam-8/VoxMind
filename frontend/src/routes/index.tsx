import { lazy, Suspense } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import { AppShell } from "@/components/layout/app-shell"
import { Loader2 } from "lucide-react"

const LoginPage = lazy(() => import("./login").then(m => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import("./register").then(m => ({ default: m.RegisterPage })))
const OverviewPage = lazy(() => import("./overview").then(m => ({ default: m.OverviewPage })))
const RecordingsPage = lazy(() => import("./recordings").then(m => ({ default: m.RecordingsPage })))
const RecordingDetailPage = lazy(() => import("./recording-detail").then(m => ({ default: m.RecordingDetailPage })))
const AskPage = lazy(() => import("./ask").then(m => ({ default: m.AskPage })))
const CollectionsPage = lazy(() => import("./collections").then(m => ({ default: m.CollectionsPage })))
const IntegrationsPage = lazy(() => import("./integrations").then(m => ({ default: m.IntegrationsPage })))
const SettingsPage = lazy(() => import("./settings").then(m => ({ default: m.SettingsPage })))
const ShowcasePage = lazy(() => import("./showcase").then(m => ({ default: m.ShowcasePage })))
const NotFoundPage = lazy(() => import("./not-found").then(m => ({ default: m.NotFoundPage })))

function PageLoading() {
  return (
    <div className="flex h-[60vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-accent-primary" />
        <span className="text-xs font-mono text-text-secondary tracking-wider">
          LOADING VOXMIND WORKSPACE...
        </span>
      </div>
    </div>
  )
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* Root redirect to App Overview */}
        <Route path="/" element={<Navigate to="/app/overview" replace />} />

        {/* Authentication */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Application Shell Workspace Routes */}
        <Route
          path="/app/overview"
          element={
            <AppShell title="Workspace Overview">
              <OverviewPage />
            </AppShell>
          }
        />
        <Route
          path="/app/recordings"
          element={
            <AppShell title="Recordings Library">
              <RecordingsPage />
            </AppShell>
          }
        />
        <Route
          path="/app/recordings/:id"
          element={
            <AppShell title="Recording Workspace">
              <RecordingDetailPage />
            </AppShell>
          }
        />
        <Route
          path="/app/ask"
          element={
            <AppShell title="Ask VoxMind">
              <AskPage />
            </AppShell>
          }
        />
        <Route
          path="/app/collections"
          element={
            <AppShell title="Collections">
              <CollectionsPage />
            </AppShell>
          }
        />
        <Route
          path="/app/api"
          element={
            <AppShell title="API & Integrations">
              <IntegrationsPage />
            </AppShell>
          }
        />
        <Route
          path="/app/settings"
          element={
            <AppShell title="Settings">
              <SettingsPage />
            </AppShell>
          }
        />

        {/* Internal Component Showcase */}
        <Route
          path="/showcase"
          element={
            <AppShell title="Design System Showcase">
              <ShowcasePage />
            </AppShell>
          }
        />

        {/* Catch-all 404 */}
        <Route
          path="*"
          element={
            <AppShell title="Page Not Found">
              <NotFoundPage />
            </AppShell>
          }
        />
      </Routes>
    </Suspense>
  )
}
