import { CheckCircle2, FileText, Hash, Sparkles, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ApiSummary } from "@/lib/api-client";

export function InsightSummary({ summary, placeholder }: { summary?: ApiSummary; placeholder: string }) {
  return (
    <>
      <section className="briefing-card">
        <h4 className="insight-section-label"><FileText aria-hidden="true" /> Executive briefing</h4>
        <p>{summary?.summary_markdown || placeholder}</p>
      </section>

      {!!summary?.key_takeaways?.length && (
        <section className="takeaways-section">
          <h4 className="insight-section-label"><CheckCircle2 aria-hidden="true" /> Key takeaways <span>{summary.key_takeaways.length}</span></h4>
          <ol className="takeaway-list">
            {summary.key_takeaways.map((point, index) => (
              <li key={index} style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}>
                <span className="takeaway-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <p>{point}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {!!summary?.topics?.length && (
        <section className="topics-section">
          <h4 className="insight-section-label"><Hash aria-hidden="true" /> Topics discussed</h4>
          <div className="topic-list">
            {summary.topics.map((topic, index) => (
              <Badge key={index} variant="outline" className="topic-badge">
                <Hash aria-hidden="true" /><span>{topic}</span>
              </Badge>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export function InsightEmptyState({ title, description, busy }: { title: string; description: string; busy: boolean }) {
  return (
    <div className="insight-empty" data-busy={busy}>
      <div className="insight-empty-art" aria-hidden="true">
        <span /><span /><div>{busy ? <Sparkles /> : <Target />}</div>
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}
