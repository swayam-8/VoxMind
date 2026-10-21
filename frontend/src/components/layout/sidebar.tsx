import React from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  LayoutDashboard,
  Mic,
  MessageSquareText,
  FolderOpen,
  KeyRound,
  Settings,
  AudioWaveform,
  LogOut,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"
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

const navItems: NavItem[] = [
  { title: "Overview", href: "/app/overview", icon: LayoutDashboard },
  { title: "Recordings", href: "/app/recordings", icon: Mic },
  { title: "Ask VoxMind", href: "/app/ask", icon: MessageSquareText },
  { title: "Collections", href: "/app/collections", icon: FolderOpen },
  { title: "API & Integrations", href: "/app/api", icon: KeyRound },
  { title: "Settings", href: "/app/settings", icon: Settings },
]

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem("voxmind_access_token")
    toast({
      title: "Signed Out",
      description: "You have been logged out of your session.",
      variant: "default",
    })
    navigate("/login")
  }

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
          "fixed top-0 bottom-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface-1 transition-transform duration-200 ease-in-out md:static md:translate-x-0 shrink-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand header */}
        <div className="flex h-14 items-center gap-2.5 px-5 border-b border-border">
          <Link
            to="/app/overview"
            className="flex items-center gap-2.5 group focus:outline-none"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-subtle border border-accent/30 text-accent group-hover:border-accent/60 transition-colors">
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
          </Link>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          <div className="px-2 py-1 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            Workspace
          </div>
          {navItems.map((item) => {
            const Icon = item.icon
            // Match exact or child routes
            const isActive =
              location.pathname === item.href ||
              (item.href !== "/app/overview" && location.pathname.startsWith(item.href))

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

        {/* User Account Controls */}
        <div className="p-3 border-t border-border bg-surface-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-surface-2 transition-colors text-left focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                aria-label="User Account Menu"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-semibold shrink-0">
                    JD
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-text-primary truncate">
                      Jane Doe
                    </p>
                    <p className="text-[11px] text-text-muted truncate">
                      jane@voxmind.internal
                    </p>
                  </div>
                </div>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56 mb-2">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigate("/app/settings")}>
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
