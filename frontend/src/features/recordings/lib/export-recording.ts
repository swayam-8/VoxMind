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
