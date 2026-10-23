import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getRecordingReportHtml } from '../src/features/recordings/lib/export-recording.ts';

const recording = {
  title: 'Release review', filename: 'review.wav', created_at: '2026-10-23T00:00:00Z', duration_seconds: 60,
  analysis_status: 'completed', summaries: [{ summary_markdown: 'Release approved.', decisions: [{ decision: 'Ship Friday', source_timestamp: 0 }] }],
  action_items: [{ task: 'Send checklist', assignee: 'Alex', due_date: 'Thursday', completed: true }],
  questions: [{ question: 'When is the release?', answer: 'Friday.', supported_by_transcript: true, timestamps: [0], model_name: 'test' }],
};

test('PDF report contains all four sections, saved Q&A, evidence and action status', () => {
  const html = getRecordingReportHtml(recording);
  for (const text of ['01 / Summary', '02 / Decisions', '03 / Actions', '04 / Ask AI', 'Release approved.', 'Ship Friday', 'Send checklist', 'Thursday', 'Completed', 'When is the release?', 'Friday.', 'Audio evidence: 0:00']) assert(html.includes(text), text);
});

test('PDF content preserves Unicode and escapes recording and model text as text', () => {
  const html = getRecordingReportHtml({ ...recording, title: 'मीटिंग <img src=x onerror=alert(1)>', questions: [{ ...recording.questions[0], answer: '</p><script>alert(1)</script>' }] });
  assert(html.includes('मीटिंग'));
  assert(html.includes('&lt;img'));
  assert(html.includes('&lt;script&gt;'));
  assert(!html.includes('<script>'));
  assert(!html.includes('<img'));
});

test('pending reports label missing results and still include every section', () => {
  const html = getRecordingReportHtml({ ...recording, analysis_status: 'processing', summaries: [], action_items: [], questions: [] });
  assert(html.includes('Analysis is still running.'));
  assert(html.includes('No saved questions yet.'));
  assert.equal((html.match(/<h2>/g) || []).length, 4);
});

test('long conversations are exported completely with print pagination styles', () => {
  const html = getRecordingReportHtml({ ...recording, questions: Array.from({ length: 80 }, (_, i) => ({ ...recording.questions[0], question: `Question ${i}`, answer: `Answer ${i}` })) });
  assert(html.includes('Question 79'));
  assert(html.includes('Answer 79'));
  assert(html.includes('@page'));
  assert(html.includes('table-header-group'));
});
