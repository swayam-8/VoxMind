import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, Search, ChevronRight, ArrowUpRight } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { CommandSearch } from "./command-search";

export function Header({
  onToggleSidebar,
  title = "Overview",
}: {
  onToggleSidebar: () => void;
  title?: string;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <>
      <header className="workspace-header">
        <div className="header-breadcrumb">
          <button
            id="navigation-trigger"
            className="mobile-menu icon-control"
            onClick={onToggleSidebar}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <span className="hidden sm:inline">Workspace</span>
          <ChevronRight size={14} className="hidden sm:block text-text-muted" />
          <span className="truncate text-text-primary">{title}</span>
        </div>
        <div className="header-actions">
          <button
            className="search-trigger"
            onClick={() => setSearchOpen(true)}
            aria-label="Search workspace"
          >
            <Search size={16} />
            <span className="hidden xl:inline">Search anything</span>
            <kbd className="hidden xl:inline">⌘ K</kbd>
          </button>
          <span className="header-divider" />
          <ThemeToggle />
          <Link className="header-help" to="/app/settings#diagnostics">
            <span className="hidden sm:inline">System status</span>
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </header>
      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
