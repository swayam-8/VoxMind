import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AudioWaveform,
  ArrowUpRight,
  LayoutDashboard,
  Mic2,
  Sparkles,
  FolderOpen,
  CheckSquare,
  Cable,
  BookOpen,
  Settings2,
  LogOut,
  ChevronsUpDown,
  ShieldCheck,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UploadDialog } from "@/features/recordings/components/upload-dialog";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Overview", href: "/app/overview", icon: LayoutDashboard },
  { label: "Recordings", href: "/app/recordings", icon: Mic2 },
  { label: "Action Items", href: "/app/actions", icon: CheckSquare },
  { label: "Ask MeetingBrief", href: "/app/ask", icon: Sparkles },
  { label: "Collections", href: "/app/collections", icon: FolderOpen },
];

const management = [
  { label: "Integrations", href: "/app/api", icon: Cable },
  { label: "Guides & API", href: "/app/docs", icon: BookOpen },
  { label: "Settings", href: "/app/settings", icon: Settings2 },
];

function account() {
  try {
    const user = JSON.parse(localStorage.getItem("voxmind_user") || "null");
    if (user)
      return {
        name: user.fullName || user.name || "Your account",
        email: user.email || "Personal workspace",
      };
  } catch {
    /* An expired or damaged session can still be signed out. */
  }
  return { name: "Your workspace", email: "Sign in to get started" };
}

function SidebarContent({ onClose }: { onClose: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const user = account();
  const authenticated = !!localStorage.getItem("voxmind_access_token");

  const group = (items: typeof navigation) =>
    items.map(({ label, href, icon: Icon }) => {
      const active =
        location.pathname === href || (href !== "/app/overview" && location.pathname.startsWith(`${href}/`));
      return (
        <Link
          key={href}
          to={href}
          onClick={onClose}
          aria-current={active ? "page" : undefined}
          className={cn("nav-item", active && "is-active")}
        >
          <Icon size={18} strokeWidth={1.8} className="shrink-0" />
          <span className="flex-1 truncate">{label}</span>
          {active && <span className="nav-dot" />}
        </Link>
      );
    });

  return (
    <>
      <div className="flex items-center justify-between px-2 mb-2">
        <Link to="/app/overview" onClick={onClose} className="brand-lockup">
          <span className="brand-mark">
            <AudioWaveform size={18} strokeWidth={2.2} />
          </span>
          <span>
            meetingbrief<span className="brand-period">.</span>
          </span>
        </Link>
      </div>

      <div className="workspace-label">
        <span className="workspace-avatar">W</span>
        <div className="min-w-0 flex-1">
          <strong className="truncate">Personal workspace</strong>
          <span>Make every word count</span>
        </div>
        <ChevronsUpDown size={14} className="text-text-muted shrink-0 ml-1" />
      </div>

      {/* Quick Upload Action */}
      <button
        onClick={() => setUploadOpen(true)}
        className="w-full mb-3 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-surface-1 border border-border text-xs font-medium text-text-primary hover:bg-surface-2 hover:border-border/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all active:scale-[0.985]"
      >
        <Plus size={14} className="text-accent" />
        <span>New Recording</span>
      </button>

      <nav aria-label="Main navigation" className="sidebar-nav">
        <p className="nav-label">WORKSPACE</p>
        {group(navigation)}
        <p className="nav-label management-label">MANAGE</p>
        {group(management)}
      </nav>

      <div className="sidebar-bottom">
        <Link to="/app/ask" onClick={onClose} className="sidebar-tip group">
          <Sparkles size={16} className="text-accent" />
          <strong>
            A second mind for
            <br />
            your conversations.
          </strong>
          <span>
            Find the idea you’re looking for{" "}
            <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </Link>
        <p className="sidebar-privacy">
          <ShieldCheck size={13} /> Your recordings. Your workspace.
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="account-button">
              <span className="account-avatar">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </span>
              <ChevronsUpDown size={14} className="text-text-muted shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 shadow-[0_4px_20px_rgba(0,0,0,0.08)] border-border">
            <DropdownMenuItem
              onClick={() => {
                onClose();
                navigate("/app/settings");
              }}
            >
              <Settings2 className="mr-2 h-4 w-4 text-text-muted" />
              Account settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                localStorage.removeItem("voxmind_access_token");
                localStorage.removeItem("voxmind_user");
                queryClient.clear();
                onClose();
                navigate("/login");
              }}
            >
              <LogOut className="mr-2 h-4 w-4 text-text-muted" />
              {authenticated ? "Sign out" : "Sign in"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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

export function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <aside className="desktop-sidebar">
        <SidebarContent onClose={onClose} />
      </aside>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent
          className="mobile-sidebar"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById("navigation-trigger")?.focus();
          }}
        >
          <DialogTitle className="sr-only">Workspace navigation</DialogTitle>
          <DialogDescription className="sr-only">
            Navigate MeetingBrief and manage your account.
          </DialogDescription>
          <SidebarContent onClose={onClose} />
        </DialogContent>
      </Dialog>
    </>
  );
}
