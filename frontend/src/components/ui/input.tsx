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
            "flex h-12 min-h-12 w-full rounded-lg border bg-surface-1 px-3.5 py-1 text-sm text-text-primary placeholder:text-text-muted shadow-xs transition-colors",
            "file:border-0 file:bg-transparent file:text-sm file:font-medium",
            "focus-visible:outline-none focus:border-accent focus:ring-1 focus:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error ? "border-danger focus:ring-danger/40" : "border-border",
            className,
          )}
          ref={ref}
          {...props}
        />
        {helperText && (
          <p
            className={cn(
              "mt-1 text-sm",
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
