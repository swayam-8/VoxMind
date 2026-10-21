import { MessageSquareText } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function AskPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 rounded-xl border border-dashed border-border bg-surface-1">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-subtle text-accent border border-accent/20 mb-4">
        <MessageSquareText className="h-6 w-6" />
      </div>
      <Badge variant="outline" className="mb-2 text-xs">Scheduled for Phase 5</Badge>
      <h3 className="text-lg font-semibold text-text-primary">Ask VoxMind (RAG Engine)</h3>
      <p className="max-w-md mt-1 text-sm text-text-secondary">
        Vector embeddings and semantic retrieval across your library with timestamp-linked citations will be integrated in Phase 5.
      </p>
    </div>
  )
}
