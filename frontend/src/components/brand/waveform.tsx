import { cn } from "@/lib/utils";

/** Decorative audio signature; deterministic so it never changes on re-render. */
export function Waveform({ className }: { className?: string }) {
  return (
    <div className={cn("signal-wave", className)} aria-hidden="true">
      {Array.from({ length: 64 }, (_, i) => (
        <span
          key={i}
          style={{
            height: `${12 + Math.abs(Math.sin(i * 0.72) * Math.cos(i * 0.19)) * 88}%`,
          }}
        />
      ))}
    </div>
  );
}
