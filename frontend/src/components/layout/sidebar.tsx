import React, { useMemo } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  LayoutDashboard,
  Mic,
  MessageSquareText,
  FolderOpen,
  KeyRound,
  Settings,
  Activity,
  AudioWaveform,
  LogOut,
  User,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "@/hooks/use-toast"

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

const workspaceItems: NavItem[] = [
  { title: "Overview", href: "/app/overview", icon: LayoutDashboard },
  { title: "Recordings", href: "/app/recordings", icon: Mic },
  { title: "Ask VoxMind", href: "/app/ask", icon: MessageSquareText },
  { title: "Collections", href: "/app/collections", icon: FolderOpen },
]

const developerItems: NavItem[] = [
  { title: "Diagnostics", href: "/app/settings#diagnostics", icon: Activity },
  { title: "API & Integrations", href: "/app/api", icon: KeyRound },
  { title: "Settings", href: "/app/settings", icon: Settings },
]

function getUserInfo(): { name: string; email: string; initials: string } {
  try {
    const stored = localStorage.getItem("voxmind_user")
    if (stored) {
      const parsed = JSON.parse(stored)
      const name = parsed.fullName || parsed.name || parsed.email || "Demo Architect"
      const email = parsed.email || "demo@voxmind.dev"
      const initials =
        name
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2) || "DA"
      return { name, email, initials }
    }

    const token = localStorage.getItem("voxmind_access_token")
    if (token && token.includes(".")) {
      const payloadBase64 = token.split(".")[1]
      const decoded = JSON.parse(atob(payloadBase64))
      const name = decoded.name || decoded.fullName || decoded.sub || "Demo Architect"
      const email =
        decoded.email || (typeof decoded.sub === "string" && decoded.sub.includes("@") ? decoded.sub : "demo@voxmind.dev")
      const initials =
        name
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2) || "DA"
      return { name, email, initials }
    }
  } catch {
    // fallback
  }

  return {
    name: "Demo Architect",
    email: "demo@voxmind.dev",
    initials: "DA",
  }
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const user = useMemo(() => getUserInfo(), [location.pathname])

  const handleLogout = () => {
    localStorage.removeItem("voxmind_access_token")
    localStorage.removeItem("voxmind_user")
    toast({
      title: "Signed Out",
      description: "You have been logged out of your session.",
      variant: "default",
    })
    navigate("/login")
  }

  const renderNavGroup = (title: string, items: NavItem[]) => (
    <div className="space-y-1">
      <div className="px-3 py-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
        {title}
      </div>
      {items.map((item) => {
        const Icon = item.icon
        let isActive = false

        if (item.href === "/app/settings#diagnostics") {
          isActive = location.pathname === "/app/settings" && location.hash === "#diagnostics"
        } else if (item.href === "/app/settings") {
          isActive = location.pathname === "/app/settings" && location.hash !== "#diagnostics"
        } else if (item.href === "/app/overview") {
          isActive = location.pathname === "/app/overview"
        } else {
          isActive =
            location.pathname === item.href ||
            (item.href !== "/app/overview" && location.pathname.startsWith(item.href))
        }

        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onClose}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all select-none",
              isActive
                ? "bg-accent text-white shadow-xs"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-2/60"
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-text-muted")} />
              <span className="truncate">{item.title}</span>
            </div>
            {item.badge && (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-mono shrink-0",
                  isActive ? "bg-white/20 text-white" : "bg-accent-subtle text-accent"
                )}
              >
                {item.badge}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs md:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex w-[240px] flex-col border-r border-sidebar-border bg-sidebar-bg transition-transform duration-200 ease-in-out md:static md:translate-x-0 shrink-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand header */}
        <div className="flex h-13 items-center justify-between px-4 border-b border-sidebar-border shrink-0">
          <Link
            to="/app/overview"
            onClick={onClose}
            className="flex items-center gap-2.5 group focus:outline-none min-w-0"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white shadow-xs shrink-0">
              <AudioWaveform className="h-4.5 w-4.5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold tracking-tight text-text-primary truncate">
                VoxMind
              </span>
              <span className="text-[9px] text-text-muted font-mono tracking-wider truncate">
                VOICE INTELLIGENCE
              </span>
            </div>
          </Link>

          {/* Mobile close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="md:hidden h-8 w-8 text-text-muted hover:text-text-primary shrink-0"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 space-y-4 p-3 overflow-y-auto">
          {renderNavGroup("Workspace", workspaceItems)}
          {renderNavGroup("Developer", developerItems)}
        </nav>

        {/* User Account Controls */}
        <div className="p-3 border-t border-sidebar-border bg-sidebar-bg shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-surface-2/60 transition-colors text-left focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                aria-label="User Account Menu"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white text-xs font-semibold shrink-0">
                    {user.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-text-primary truncate">
                      {user.name}
                    </p>
                    <p className="text-[11px] text-text-muted truncate">
                      {user.email}
                    </p>
                  </div>
                </div>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56 mb-2">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => {
                  onClose?.()
                  navigate("/app/settings")
                }}
              >
                <User className="mr-2 h-4 w-4 text-text-secondary" />
                <span>Profile & Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-danger focus:text-danger">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  )
}
