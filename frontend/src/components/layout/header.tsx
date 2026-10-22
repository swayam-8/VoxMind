import { useState } from "react"
import { Menu, Search, ShieldCheck, Activity, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "./theme-toggle"
import { CommandSearch } from "./command-search"

interface HeaderProps {
  onToggleSidebar: () => void
  title?: string
}

export function Header({ onToggleSidebar, title = "Overview" }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-30 flex h-13 w-full items-center justify-between border-b border-border bg-header-bg px-3 sm:px-4 backdrop-blur-xs min-w-0">
        {/* Left side: Hamburger & Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="md:hidden h-8 w-8 text-text-secondary shrink-0"
            aria-label="Open navigation sidebar"
          >
            <Menu className="h-4.5 w-4.5" />
          </Button>

          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm font-semibold text-text-primary tracking-tight truncate max-w-[130px] xs:max-w-[180px] sm:max-w-xs md:max-w-md">
              {title}
            </h1>
          </div>
        </div>

        {/* Center: Global Search Entry Point */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-4 lg:mx-6">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-border bg-surface-2/70 text-xs text-text-muted hover:border-accent/40 hover:text-text-secondary transition-colors cursor-pointer select-none"
          >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-text-muted" />
              <span>Search recordings, transcripts, or ask...</span>
            </div>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-surface-1 px-1.5 font-mono text-[10px] font-medium text-text-muted">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        </div>

        {/* Right side: Indicators & Theme Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mobile search trigger */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen(true)}
            className="md:hidden h-8 w-8 text-text-secondary"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </Button>

          {/* Compact Whisper indicator */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-2 border border-border text-xs text-text-secondary"
            title="faster-whisper STT: Ready"
          >
            <Activity className="h-3.5 w-3.5 text-accent" />
            <span className="hidden md:inline">whisper</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </div>

          {/* Compact Ollama indicator */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-2 border border-border text-xs text-text-secondary"
            title="Ollama LLM: Connected"
          >
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span className="hidden md:inline">Ollama</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </div>

          {/* Privacy isolation badge */}
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-2 border border-border text-xs text-text-secondary">
            <ShieldCheck className="h-3.5 w-3.5 text-text-muted" />
            <span>Local Isolated</span>
          </div>

          <ThemeToggle />
        </div>
      </header>

      {/* Quick Search Dialog Palette */}
      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}
