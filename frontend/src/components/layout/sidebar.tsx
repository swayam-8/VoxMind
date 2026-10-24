import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AudioWaveform,
  ArrowUpRight,
  LayoutDashboard,
  Mic2,
  Sparkles,
  FolderOpen,
  Cable,
  BookOpen,
  Settings2,
  LogOut,
  ChevronsUpDown,
  ShieldCheck,
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
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Overview", href: "/app/overview", icon: LayoutDashboard },
  { label: "Recordings", href: "/app/recordings", icon: Mic2 },
  { label: "Collections", href: "/app/collections", icon: FolderOpen },
  { label: "Ask MeetingBrief", href: "/app/ask", icon: Sparkles },
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
  const user = account();
  const authenticated = !!localStorage.getItem("voxmind_access_token");
  const group = (items: typeof navigation) =>
    items.map(({ label, href, icon: Icon }) => {
      const active =
        location.pathname === href || location.pathname.startsWith(`${href}/`);
      return (
        <Link
          key={href}
          to={href}
          onClick={onClose}
          aria-current={active ? "page" : undefined}
          className={cn("nav-item", active && "is-active")}
        >
          <Icon size={26} strokeWidth={1.8} />
          <span>{label}</span>
          {active && <span className="nav-dot" />}
        </Link>
      );
    });
  return (
    <>
      <Link to="/app/overview" onClick={onClose} className="brand-lockup">
        <span className="brand-mark">
          <AudioWaveform size={28} />
        </span>
        <span>
          meetingbrief<span className="brand-period">.</span>
        </span>
      </Link>
      <div className="workspace-label">
        <span className="workspace-avatar">W</span>
        <div>
          <strong>Personal workspace</strong>
          <span>Make every word count</span>
        </div>
      </div>
      <nav aria-label="Main navigation" className="sidebar-nav">
        <p className="nav-label">WORKSPACE</p>
        {group(navigation)}
        <p className="nav-label management-label">MANAGE</p>
        {group(management)}
      </nav>
      <div className="sidebar-bottom">
        <Link to="/app/ask" onClick={onClose} className="sidebar-tip">
          <Sparkles size={19} />
          <strong>
            A second mind for
            <br />
            your conversations.
          </strong>
          <span>
            Find the idea you’re looking for <ArrowUpRight size={14} />
          </span>
        </Link>
        <p className="sidebar-privacy">
          <ShieldCheck size={14} /> Your recordings. Your workspace.
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
              <ChevronsUpDown size={15} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem
              onClick={() => {
                onClose();
                navigate("/app/settings");
              }}
            >
              <Settings2 className="mr-2 h-5 w-5" />
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
              <LogOut className="mr-2 h-5 w-5" />
              {authenticated ? "Sign out" : "Sign in"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
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
