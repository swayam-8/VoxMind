import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { useToast, type ToastItem } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none p-4 sm:p-0">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const icons = {
    default: <Info className="w-5 h-5 text-accent shrink-0" />,
    success: <CheckCircle className="w-5 h-5 text-success shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-warning shrink-0" />,
    danger: <AlertCircle className="w-5 h-5 text-danger shrink-0" />,
  };

  const borderStyles = {
    default: "border-border",
    success: "border-success/40",
    warning: "border-warning/40",
    danger: "border-danger/40",
  };

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 p-4 rounded-lg bg-surface-1 border shadow-lg transition-all animate-in slide-in-from-bottom-5",
        borderStyles[toast.variant || "default"],
      )}
    >
      {icons[toast.variant || "default"]}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <h4 className="text-sm font-semibold text-text-primary">
            {toast.title}
          </h4>
        )}
        {toast.description && (
          <p className="mt-1 text-sm text-text-secondary">
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="p-1 rounded text-text-muted hover:text-text-primary transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <X className="w-5 h-5" />
        <span className="sr-only">Dismiss</span>
      </button>
    </div>
  );
}
