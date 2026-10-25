import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, type = "text", error, helperText, disabled, ...props },
    ref,
  ) => {
    return (
      <div className="w-full">
        <input
          data-slot="input"
          aria-invalid={error || undefined}
          type={type}
          disabled={disabled}
          className={cn(
            "flex h-10 min-h-10 w-full rounded-md border bg-surface-1 px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-150",
            "file:border-0 file:bg-transparent file:text-sm file:font-medium",
            "focus-visible:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error ? "border-danger focus:border-danger focus:ring-danger/25" : "border-border hover:border-border/80",
            className,
          )}
          ref={ref}
          {...props}
        />
        {helperText && (
          <p
            className={cn(
              "mt-1.5 text-xs",
              error ? "text-danger" : "text-text-muted",
            )}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";
