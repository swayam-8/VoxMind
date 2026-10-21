import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  helperText?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, helperText, disabled, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          type={type}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full rounded-md border bg-surface-1 px-3 py-1.5 text-sm text-text-primary shadow-xs transition-colors",
            "file:border-0 file:bg-transparent file:text-sm file:font-medium",
            "placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error ? "border-danger focus-visible:ring-danger/40" : "border-border",
            className
          )}
          ref={ref}
          {...props}
        />
        {helperText && (
          <p className={cn("mt-1 text-xs", error ? "text-danger" : "text-text-muted")}>
            {helperText}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"
