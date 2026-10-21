import { Link } from "react-router-dom"
import { AlertCircle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-danger-subtle text-danger border border-danger/20 mb-4">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-xl font-bold text-text-primary">Page Not Found</h3>
      <p className="max-w-sm mt-1 text-sm text-text-secondary">
        The requested screen does not exist or has been moved.
      </p>
      <Link to="/" className="mt-4">
        <Button variant="secondary" size="sm">
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Return to Overview
        </Button>
      </Link>
    </div>
  )
}
