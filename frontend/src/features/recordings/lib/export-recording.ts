import type { ApiRecording } from "@/lib/api-client";

/** Export only information present in the selected recording. */
export function downloadRecordingMarkdown(recording: ApiRecording) {
  const summary = recording.summaries?.[0];
  const lines = [
    `# ${recording.title}`,
    `Recorded: ${new Date(recording.created_at).toLocaleDateString()}`,
    summary?.summary_markdown
      ? `## Summary\n\n${summary.summary_markdown}`
      : "",
    summary?.decisions?.length
      ? `## Decisions\n\n${summary.decisions.map((d) => `- ${d.decision}`).join("\n")}`
      : "",
    recording.action_items?.length
      ? `## Action items\n\n${recording.action_items.map((item) => `- [${item.completed ? "x" : " "}] ${item.task}${item.assignee ? ` — ${item.assignee}` : ""}`).join("\n")}`
      : "",
    "## Ask AI — Questions and answers",
    ...(recording.questions?.length ? recording.questions.map((item) =>
      `### Question\n\n${item.question}\n\n**Answer**\n\n${item.answer}`,
    ) : ["No saved questions yet."]),
    "## Transcript",
    ...(recording.segments || []).map((segment) => {
      const minutes = Math.floor(segment.start_time / 60);
      const seconds = Math.floor(segment.start_time % 60)
        .toString()
        .padStart(2, "0");
      return `**[${minutes}:${seconds}] ${segment.speaker}**\n\n${segment.text}`;
    }),
  ].filter(Boolean);
  const url = URL.createObjectURL(
    new Blob([lines.join("\n\n")], { type: "text/markdown;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${
    recording.title
      .replace(/[^\p{L}\p{N} _-]/gu, "")
      .trim()
      .slice(0, 100) || "recording"
  }.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

function sourceTime(seconds?: number | null): string {
  return seconds == null ? "" : `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

/** A separate print document includes every insight tab, regardless of the selected UI tab. */
export function getRecordingReportHtml(recording: ApiRecording): string {
  const summary = recording.summaries?.[0];
  const e = escapeHtml;
  const status = recording.analysis_status ?? summary?.status;
  const unavailable = status === "failed" ? "Analysis could not finish. Regenerate the analysis to include these insights." :
    status === "pending" || status === "processing" ? "Analysis is still running." : "Analysis has not been generated.";
  const empty = (text: string) => `<p class="empty">${e(status === "completed" || (summary && !status) ? text : unavailable)}</p>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${e(recording.title)} — MeetingBrief</title>
    <style>
      @page { size: A4; margin: 18mm 16mm; }
      * { box-sizing: border-box; }
      body { max-width: 800px; margin: 32px auto; padding: 0 24px; font: 13px/1.65 "Segoe UI", Arial, sans-serif; color: #20232d; background: white; overflow-wrap: anywhere; }
      header { border-bottom: 3px solid #3159df; padding-bottom: 22px; margin-bottom: 26px; }
      .brand { color: #3159df; font-size: 12px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
      h1 { font-size: 29px; line-height: 1.25; margin: 12px 0; }
      h2 { font-size: 19px; margin: 28px 0 14px; break-after: avoid; }
      h3 { font-size: 13px; margin: 0 0 6px; }
      .meta, .empty { color: #596174; }
      .prose { white-space: pre-wrap; }
      .card { border: 1px solid #dce1eb; border-radius: 10px; padding: 14px 16px; margin: 12px 0; break-inside: avoid-page; }
      .question { color: #3159df; font-weight: 650; }
      .label { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; font-weight: 750; color: #596174; }
      .source { font-size: 11px; color: #596174; margin-top: 9px; }
      ul { padding-left: 22px; }
      li { margin-bottom: 7px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      thead { display: table-header-group; }
      th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #dce1eb; vertical-align: top; overflow-wrap: anywhere; }
      th { background: #edf0f6; color: #596174; }
      td:first-child { width: 48%; }
      footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #dce1eb; font-size: 11px; color: #697287; }
      .print-tools { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 14px 0; margin-bottom: 22px; color: #596174; }
      button { background: #3159df; border: 0; border-radius: 8px; padding: 11px 18px; color: white; font-weight: 700; cursor: pointer; }
      @media print { body { max-width: none; margin: 0; padding: 0; } .print-tools { display: none; } }
    </style></head><body>
    <div class="print-tools"><span>Choose “Save as PDF” in the print dialog.</span><button id="print-report">Save as PDF</button></div>
    <header><div class="brand">MeetingBrief / Recording report</div><h1>${e(recording.title)}</h1>
    <div class="meta">${e(new Date(recording.created_at).toLocaleDateString())} · ${e(recording.filename)} · ${e(sourceTime(recording.duration_seconds))}</div></header>
    <section><h2>01 / Summary</h2>${summary?.summary_markdown ? `<p class="prose">${e(summary.summary_markdown)}</p>` : empty("No summary available.")}
    ${summary?.key_takeaways?.length ? `<h3>Key takeaways</h3><ul>${summary.key_takeaways.map((item) => `<li>${e(item)}</li>`).join("")}</ul>` : ""}
    ${summary?.topics?.length ? `<p class="meta">Topics: ${e(summary.topics.join(" · "))}</p>` : ""}</section>
    <section><h2>02 / Decisions</h2>${summary?.decisions?.length ? summary.decisions.map((item) => `<div class="card"><h3>${e(item.decision)}</h3>${item.context ? `<p class="prose">${e(item.context)}</p>` : ""}${(item.source_timestamp ?? item.sourceTimestamp) != null ? `<div class="source">Audio evidence: ${e(sourceTime(item.source_timestamp ?? item.sourceTimestamp))}</div>` : ""}</div>`).join("") : empty("No explicit decisions were identified in this conversation.")}</section>
    <section><h2>03 / Actions</h2>${recording.action_items?.length ? `<table><thead><tr><th>Action</th><th>Owner / due date</th><th>Status</th></tr></thead><tbody>${recording.action_items.map((item) => `<tr><td>${e(item.task)}${item.source_timestamp != null ? `<div class="source">Audio: ${e(sourceTime(item.source_timestamp))}</div>` : ""}</td><td>${e(item.assignee || "Unassigned")}<br>${e(item.due_date || "No due date")}</td><td>${item.completed ? "Completed" : "Open"}</td></tr>`).join("")}</tbody></table>` : empty("No action items were assigned in this conversation.")}</section>
    <section><h2>04 / Ask AI — Questions and answers</h2>${recording.questions?.length ? recording.questions.map((item, index) => `<article class="card"><div class="label">Question ${index + 1}</div><p class="question prose">${e(item.question)}</p><div class="label">Answer</div><p class="prose">${e(item.answer)}</p><div class="source">${item.supported_by_transcript ? "Supported by transcript" : "Not supported by transcript"}${item.timestamps?.length ? ` · Audio evidence: ${item.timestamps.map(sourceTime).map(e).join(", ")}` : ""} · ${e(item.model_name)}</div></article>`).join("") : '<p class="empty">No saved questions yet.</p>'}</section>
    <footer>Exported from MeetingBrief. This report includes the summary, decisions, actions, and your saved recording conversation.</footer>
    </body></html>`;
}

export function printRecordingPdf(recording: ApiRecording) {
  const report = window.open("", "_blank");
  if (!report) throw new Error("Your browser blocked the report window. Allow it to open, then try again.");
  report.opener = null;
  report.document.write(getRecordingReportHtml(recording));
  report.document.close();
  report.document.getElementById("print-report")?.addEventListener("click", () => report.print());
  void report.document.fonts.ready.then(() => { if (!report.closed) { report.focus(); report.print(); } });
}
