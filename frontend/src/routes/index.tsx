import { Routes, Route } from "react-router-dom"
import { AppShell } from "@/components/layout/app-shell"
import { OverviewPage } from "./overview"
import { ShowcasePage } from "./showcase"
import { RecordingsPage } from "./recordings"
import { AskPage } from "./ask"
import { CollectionsPage } from "./collections"
import { IntegrationsPage } from "./integrations"
import { SettingsPage } from "./settings"
import { NotFoundPage } from "./not-found"

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppShell title="Platform Overview">
            <OverviewPage />
          </AppShell>
        }
      />
      <Route
        path="/showcase"
        element={
          <AppShell title="Design System Showcase">
            <ShowcasePage />
          </AppShell>
        }
      />
      <Route
        path="/recordings"
        element={
          <AppShell title="Recordings Library">
            <RecordingsPage />
          </AppShell>
        }
      />
      <Route
        path="/ask"
        element={
          <AppShell title="Ask VoxMind">
            <AskPage />
          </AppShell>
        }
      />
      <Route
        path="/collections"
        element={
          <AppShell title="Collections">
            <CollectionsPage />
          </AppShell>
        }
      />
      <Route
        path="/integrations"
        element={
          <AppShell title="API & Integrations">
            <IntegrationsPage />
          </AppShell>
        }
      />
      <Route
        path="/settings"
        element={
          <AppShell title="Settings">
            <SettingsPage />
          </AppShell>
        }
      />
      <Route
        path="*"
        element={
          <AppShell title="Not Found">
            <NotFoundPage />
          </AppShell>
        }
      />
    </Routes>
  )
}
