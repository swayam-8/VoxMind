import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AudioWaveform, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Waveform } from "@/components/brand/waveform";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page">
      <aside className="auth-story">
        <Link to="/" className="brand-lockup">
          <AudioWaveform className="text-[#8faaff]" size={30} />
          <span>
            voxmind<span className="brand-period">.</span>
          </span>
        </Link>
        <div className="auth-story-body">
          <p className="eyebrow">A SPACE FOR WHAT MATTERS</p>
          <h2>
            Great conversations.
            <br />
            <em>Lasting clarity.</em>
          </h2>
          <p>
            The ideas, decisions, and little details worth keeping. All together
            in your personal listening room.
          </p>
          <Waveform />
        </div>
        <p className="auth-story-footer">
          <ShieldCheck size={15} /> Built for local voice intelligence.
        </p>
      </aside>
      <section className="auth-form-side">
        <div className="auth-top">
          <ThemeToggle />
        </div>
        {children}
        <p className="auth-bottom">
          Your voice. Your workspace. Your next great idea.
        </p>
      </section>
    </main>
  );
}
