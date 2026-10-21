import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "danger" | "violet"
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const variants = {
    default: "bg-surface-2 text-text-primary border-border",
    secondary: "bg-surface-3 text-text-secondary border-transparent",
    outline: "border-border text-text-secondary bg-transparent",
    success: "bg-success-subtle text-success border-success/30",
    warning: "bg-warning-subtle text-warning border-warning/30",
    danger: "bg-danger-subtle text-danger border-danger/30",
    violet: "bg-accent-subtle text-accent border-accent/30",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors select-none",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}
