import { Mic, ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function RecordingsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 rounded-xl border border-dashed border-border bg-surface-1">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-subtle text-accent border border-accent/20 mb-4">
        <Mic className="h-6 w-6" />
      </div>
      <Badge variant="outline" className="mb-2 text-xs">Scheduled for Phase 3 & 4</Badge>
      <h3 className="text-lg font-semibold text-text-primary">Recordings Library</h3>
      <p className="max-w-md mt-1 text-sm text-text-secondary">
        Audio ingestion, live upload progress, faster-whisper transcription, and synchronized audio playback will be integrated in Phase 3 & Phase 4.
      </p>
      <Link to="/showcase" className="mt-4">
        <Button variant="secondary" size="sm">
          Inspect Design System Showcase <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </Link>
    </div>
  )
}
