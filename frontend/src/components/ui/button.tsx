import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "ghost"
    | "destructive"
    | "subtle"
    | "link";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "md",
      isLoading = false,
      type = "button",
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer active:scale-[0.985]";

    const variants = {
      default:
        "bg-accent text-accent-foreground hover:bg-accent-hover shadow-[0_1px_2px_rgba(0,0,0,0.08),inset_0_1px_0.5px_rgba(255,255,255,0.2)] border border-accent/80",
      secondary:
        "bg-surface-1 text-text-primary hover:bg-surface-2 border border-border shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
      outline:
        "border border-border text-text-primary hover:bg-surface-2 hover:border-border/80 shadow-[0_1px_1px_rgba(0,0,0,0.02)]",
      ghost: "text-text-secondary hover:text-text-primary hover:bg-surface-2",
      destructive:
        "bg-danger text-white hover:bg-danger/90 shadow-[0_1px_2px_rgba(0,0,0,0.08)] border border-danger/80",
      subtle:
        "bg-accent-subtle text-accent hover:bg-accent-subtle/80 border border-accent/15",
      link: "text-accent underline-offset-4 hover:underline p-0 h-auto active:scale-100",
    };

    const sizes = {
      sm: "min-h-9 px-3 text-xs gap-1.5 rounded-md",
      md: "min-h-10 px-4 text-sm gap-2 rounded-lg",
      lg: "min-h-11 px-5 text-sm font-medium gap-2.5 rounded-lg",
      icon: "h-10 w-10 min-w-10 p-0 rounded-lg",
    };

    return (
      <button
        ref={ref}
        type={type}
        data-slot="button"
        data-size={size}
        data-variant={variant}
        aria-busy={isLoading || undefined}
        disabled={disabled || isLoading}
        className={cn(
          baseStyles,
          variants[variant],
          variant !== "link" && sizes[size],
          className,
        )}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
