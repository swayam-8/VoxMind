import { Routes, Route, Navigate } from "react-router-dom"
import { AppShell } from "@/components/layout/app-shell"
import { LoginPage } from "./login"
import { RegisterPage } from "./register"
import { OverviewPage } from "./overview"
import { RecordingsPage } from "./recordings"
import { RecordingDetailPage } from "./recording-detail"
import { AskPage } from "./ask"
import { CollectionsPage } from "./collections"
import { IntegrationsPage } from "./integrations"
import { SettingsPage } from "./settings"
import { ShowcasePage } from "./showcase"
import { NotFoundPage } from "./not-found"

export function AppRoutes() {
  return (
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
  )
}
