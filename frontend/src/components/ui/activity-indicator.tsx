import { AudioLines, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityIndicatorProps {
  kind?: "audio" | "ai";
  title: string;
  description: string;
  className?: string;
}

/** Indeterminate activity only: never invents a percentage or an estimated finish time. */
export function ActivityIndicator({ kind = "ai", title, description, className }: ActivityIndicatorProps) {
  const Icon = kind === "audio" ? AudioLines : Sparkles;
  return (
    <div className={cn("activity-indicator", className)} data-kind={kind} role="status" aria-live="polite" aria-atomic="true">
      <div className="activity-visual" aria-hidden="true">
        <span className="activity-orbit" />
        <span className="activity-orbit activity-orbit-secondary" />
        <div className="activity-wave">
          {Array.from({ length: 23 }, (_, index) => (
            <span key={index} style={{
              height: `${24 + Math.abs(Math.sin(index * 0.74)) * 66}%`,
              animationDelay: `${index * -87}ms`,
            }} />
          ))}
        </div>
        <span className="activity-core"><Icon /></span>
      </div>
      <div className="activity-copy">
        <span className="activity-eyebrow">{kind === "audio" ? "Working on your recording" : "A little thought, a clearer answer"}</span>
        <strong>{title}</strong>
        <p>{description}</p>
        <span className="activity-dots" aria-hidden="true"><i /><i /><i /></span>
      </div>
    </div>
  );
}
