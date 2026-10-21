import React from "react"
import { Link, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  Mic,
  MessageSquareText,
  FolderOpen,
  KeyRound,
  Settings,
  AudioWaveform,
  Layers,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarProps {
  isOpen: boolean
  onClose?: () => void
}

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

const navItems: NavItem[] = [
  { title: "Overview", href: "/", icon: LayoutDashboard },
  { title: "Recordings", href: "/recordings", icon: Mic },
  { title: "Ask VoxMind", href: "/ask", icon: MessageSquareText },
  { title: "Collections", href: "/collections", icon: FolderOpen },
  { title: "API & Integrations", href: "/integrations", icon: KeyRound },
  { title: "Settings", href: "/settings", icon: Settings },
  { title: "Design System", href: "/showcase", icon: Layers, badge: "Phase 1" },
]

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface-1 transition-transform duration-200 ease-in-out md:static md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand header */}
        <div className="flex h-14 items-center gap-2.5 px-5 border-b border-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 border border-accent/30 text-accent">
            <AudioWaveform className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-text-primary">
              VoxMind
            </span>
            <span className="text-[10px] text-text-muted font-mono tracking-wider">
              VOICE INTELLIGENCE
            </span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          <div className="px-2 py-1 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            Workspace
          </div>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href

            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors select-none",
                  isActive
                    ? "bg-accent-subtle text-accent border border-accent/25"
                    : "text-text-secondary hover:bg-surface-2 hover:text-text-primary border border-transparent"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={cn("h-4 w-4", isActive ? "text-accent" : "text-text-muted")} />
                  <span>{item.title}</span>
                </div>
                {item.badge && (
                  <span className="rounded-sm bg-accent/20 px-1.5 py-0.5 text-[10px] font-mono text-accent">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer info */}
        <div className="p-3 border-t border-border bg-surface-1/50">
          <div className="flex items-center justify-between text-xs text-text-muted px-2 py-1">
            <span>Local Engine</span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              v1.0.0-rc
            </span>
          </div>
        </div>
      </aside>
    </>
  )
}
