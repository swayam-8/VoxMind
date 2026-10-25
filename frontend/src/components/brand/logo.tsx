import { cn } from "@/lib/utils";

export function Logo({
  className,
  size = "md",
  showLabel = true,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}) {
  const iconSizes = {
    sm: "w-6 h-6",
    md: "w-7 h-7",
    lg: "w-9 h-9",
  };

  const textSizes = {
    sm: "text-sm",
    md: "text-base font-semibold tracking-tight",
    lg: "text-xl font-semibold tracking-tight",
  };

  return (
    <div className={cn("inline-flex items-center gap-2 select-none", className)}>
      <span
        className={cn(
          "grid place-items-center rounded-lg bg-accent text-white shadow-[0_1px_3px_rgba(54,92,245,0.3)] transition-transform duration-150 hover:scale-[1.03]",
          iconSizes[size]
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4"
        >
          <path d="M4 10v4" />
          <path d="M8 7v10" />
          <path d="M12 4v16" />
          <path d="M16 8v8" />
          <path d="M20 11v2" />
        </svg>
      </span>
      {showLabel && (
        <span className={cn("text-text-primary flex items-center font-semibold", textSizes[size])}>
          meetingbrief<span className="text-accent ml-0.5">.</span>
        </span>
      )}
    </div>
  );
}
