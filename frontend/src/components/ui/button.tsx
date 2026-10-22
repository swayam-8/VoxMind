import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "subtle" | "link"
  size?: "sm" | "md" | "lg" | "icon"
  isLoading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer"

    const variants = {
      default:
        "bg-accent text-accent-foreground hover:bg-accent-hover active:opacity-90 shadow-xs",
      secondary:
        "bg-surface-2 text-text-primary hover:bg-surface-3 border border-border",
      outline:
        "border border-border text-text-primary hover:bg-surface-2 hover:border-border-subtle",
      ghost:
        "text-text-secondary hover:text-text-primary hover:bg-surface-2",
      destructive:
        "bg-danger text-white hover:opacity-90 shadow-xs",
      subtle:
        "bg-accent-subtle text-accent hover:opacity-80 border border-accent/20",
      link:
        "text-accent underline-offset-4 hover:underline p-0 h-auto",
    }

    const sizes = {
      sm: "h-7 px-3 text-xs gap-1.5",
      md: "h-8 px-3.5 text-sm gap-2",
      lg: "h-10 px-5 text-sm gap-2.5",
      icon: "h-8 w-8 p-0",
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], variant !== "link" && sizes[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"
