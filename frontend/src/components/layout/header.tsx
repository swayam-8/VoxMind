import { Menu, ShieldCheck, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "./theme-toggle"
import { Badge } from "@/components/ui/badge"

interface HeaderProps {
  onToggleSidebar: () => void
  title?: string
}

export function Header({ onToggleSidebar, title = "Overview" }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-surface-1/95 px-4 backdrop-blur-xs">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="md:hidden h-8 w-8 text-text-secondary"
          aria-label="Open navigation sidebar"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-text-primary tracking-tight">
            {title}
          </h1>
          <Badge variant="outline" className="hidden sm:inline-flex text-[10px] py-0 h-4">
            Phase 1 Foundation
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-2 border border-border text-xs text-text-secondary">
          <Activity className="h-3.5 w-3.5 text-accent" />
          <span>Local Engine</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-2 border border-border text-xs text-text-secondary">
          <ShieldCheck className="h-3.5 w-3.5 text-text-muted" />
          <span>Tenant Isolated</span>
        </div>

        <ThemeToggle />
      </div>
    </header>
  )
}
