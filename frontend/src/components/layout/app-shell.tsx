import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

const titles: Record<string, string> = {
  overview: "Overview",
  recordings: "Recordings",
  collections: "Collections",
  ask: "Ask VoxMind",
  api: "Integrations",
  settings: "Settings",
};
export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (media.matches) setSidebarOpen(false);
    };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);
  const title = titles[location.pathname.split("/")[2]] || "Workspace";
  useEffect(() => {
    document.title = `${title} — VoxMind`;
    window.scrollTo(0, 0);
  }, [location.pathname, title]);
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="workspace-body">
        <Header onToggleSidebar={() => setSidebarOpen(true)} title={title} />
        <main id="main-content" className="workspace-main" tabIndex={-1}>
          <div className="page-content">
            <Outlet />
          </div>
        </main>
        <footer className="workspace-footer">
          <span>VoxMind — A little more clarity.</span>
          <span>YOUR VOICE. YOUR WORKSPACE.</span>
        </footer>
      </div>
    </div>
  );
}
