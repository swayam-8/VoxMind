import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, Search, ChevronRight, ArrowUpRight, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { CommandSearch } from "./command-search";
import { UploadDialog } from "@/features/recordings/components/upload-dialog";

export function Header({
  onToggleSidebar,
  title = "Overview",
}: {
  onToggleSidebar: () => void;
  title?: string;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const queryClient = useQueryClient();

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
          <span className="hidden sm:inline text-text-muted hover:text-text-primary transition-colors">
            Workspace
          </span>
          <ChevronRight size={13} className="hidden sm:block text-text-muted/60" />
          <span className="truncate text-text-primary font-medium">{title}</span>
        </div>

        <button
          className="search-trigger"
          onClick={() => setSearchOpen(true)}
          aria-label="Search workspace"
        >
          <Search size={15} className="text-text-muted shrink-0" />
          <span className="search-label">Search your workspace</span>
          <kbd className="search-shortcut">Ctrl / ⌘ K</kbd>
        </button>

        <div className="header-actions">
          <Button
            size="sm"
            onClick={() => setUploadOpen(true)}
            className="hidden md:inline-flex"
          >
            <Upload size={14} className="mr-1.5" />
            Upload Meeting
          </Button>

          <span className="header-divider" />
          <ThemeToggle />
          <Link className="header-help" to="/app/docs" title="Help & API Reference">
            <span className="hidden sm:inline">Help & API</span>
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>

      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["recordings"] });
        }}
      />
    </>
  );
}
