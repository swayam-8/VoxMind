/* Deterministic browser states; provider/model inference is covered separately. */
const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
const { chromium } = require('playwright');
const base = process.env.VOXMIND_BASE_URL || 'http://127.0.0.1:4173';
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let phase = 'audio';
  let completed = false;
  let askGate;
  let askFails = false;
  let knowledgeGate;
  let knowledgeFails = true;
  let lastKnowledgeQuestion;
  const questions = [];
  let checks = 0;
  const id = 'insights-fixture';
  const fixture = () => ({
    id, title: 'Friday release review', filename: 'review.wav', duration_seconds: 45, file_size_bytes: 4096,
    workspace_id: 'test', user_id: 'test', mime_type: 'audio/wav', language: 'en',
    created_at: '2026-10-23T00:00:00Z', updated_at: '2026-10-23T00:00:00Z',
    status: phase === 'audio' ? 'processing' : 'completed',
    analysis_status: phase === 'audio' ? 'pending' : phase === 'analysis' ? 'processing' : phase === 'failed' ? 'failed' : 'completed',
    analysis_error: phase === 'failed' ? 'The AI model is not available yet. Wait for its download to finish, then retry.' : null,
    index_status: phase === 'analysis' ? 'indexing' : 'completed',
    segments: phase === 'audio' ? [] : [{ id: 'segment', start_time: 0, end_time: 30, speaker: 'Alex', text: 'We agreed to release Friday. I will send the checklist.', confidence: .98 }],
    summaries: phase === 'complete' ? [{ id: 'summary', status: 'completed', model_name: 'test-model', summary_markdown: 'The release was approved for Friday.', key_takeaways: ['Release approved'], topics: ['Release'], decisions: [{ decision: 'Release Friday', context: 'Testing is complete', source_timestamp: 0 }] }] : [],
    action_items: phase === 'complete' ? [{ id: 'task', task: 'Send release checklist', assignee: 'Alex', due_date: 'Thursday', completed, source_timestamp: 0 }] : [],
  });
  await context.addInitScript(() => {
    localStorage.setItem('voxmind_access_token', 'fixture-session');
    localStorage.setItem('voxmind_user', JSON.stringify({ id: 'test', fullName: 'Insights Review', email: 'review@example.test' }));
  });
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let data = [];
    if (path.endsWith(`/recordings/${id}`)) data = fixture();
    else if (path.endsWith('/recordings')) data = [fixture()];
    else if (path.endsWith('/questions')) data = questions;
    else if (path.endsWith('/analysis/regenerate')) { phase = 'analysis'; data = { status: 'pending' }; }
    else if (path.endsWith('/action-items/task')) { completed = request.postDataJSON().completed; data = fixture().action_items[0]; }
    else if (path.endsWith(`/recordings/${id}/ask`)) {
      if (askGate) await askGate.promise;
      if (askFails) return route.fulfill({ status: 503, json: { message: 'The AI model is still downloading.' } });
      data = { id: `question-${questions.length}`, recording_id: id, question: request.postDataJSON().question, answer: 'The release is planned for Friday.', supported_by_transcript: false, timestamps: [0], model_name: 'test-model', created_at: new Date().toISOString() };
      questions.push(data);
    } else if (path.endsWith('/knowledge/ask')) {
      lastKnowledgeQuestion = request.postDataJSON().question;
      if (knowledgeGate) await knowledgeGate.promise;
      if (knowledgeFails) return route.fulfill({ status: 503, json: { message: 'Model unavailable. Try again shortly.' } });
      data = { answer: 'Workspace answer: release Friday.', citations: [], sufficient_evidence: false, recordings_searched: [id], model_name: 'test-model' };
    } else if (path.endsWith('/audio')) return route.fulfill({ status: 204 });
    await route.fulfill({ json: { success: true, data } });
  });
  const fits = async (label) => {
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label);
    checks++;
  };
  try {
    await page.goto(`${base}/app/recordings/${id}`);
    await page.getByRole('status').filter({ hasText: 'Listening to your recording' }).waitFor();
    assert.notEqual(await page.locator('.activity-wave span').first().evaluate((el) => getComputedStyle(el).animationName), 'none'); checks++;
    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1100 });
      await fits(`Audio processing overflows at ${width}`);
    }
    phase = 'analysis';
    await page.getByText('Finding the moments that matter', { exact: true }).waitFor(); checks++;
    await page.getByRole('tab', { name: 'Decisions', exact: true }).click();
    await page.getByText('Your insights are on their way', { exact: true }).waitFor(); checks++;
    assert.equal(await page.getByText('No explicit decisions found').count(), 0); checks++;
    phase = 'complete';
    await page.getByText('Release Friday', { exact: true }).waitFor(); checks++;
    await page.getByRole('tab', { name: 'Actions', exact: true }).click();
    await page.getByText('Due: Thursday', { exact: true }).waitFor(); checks++;
    const savedAction = page.waitForResponse((r) => r.url().includes('/action-items/task') && r.request().method() === 'PATCH');
    await page.getByRole('checkbox').click();
    await savedAction;
    await page.reload();
    await page.getByRole('tab', { name: 'Actions', exact: true }).click();
    assert(await page.getByRole('checkbox').isChecked()); checks++;
    phase = 'failed';
    await page.reload();
    await page.getByRole('alert').filter({ hasText: 'Analysis could not finish' }).waitFor(); checks++;
    await page.getByRole('button', { name: 'Retry analysis', exact: true }).click();
    await page.getByText('Finding the moments that matter', { exact: true }).waitFor(); checks++;
    phase = 'complete';
    await page.getByRole('tab', { name: 'Decisions', exact: true }).focus();
    await page.keyboard.press('Space');
    await page.getByText('Release Friday', { exact: true }).waitFor(); checks++;
    await page.getByRole('tab', { name: 'Ask AI', exact: true }).click();
    askGate = deferred();
    await page.getByRole('textbox', { name: 'Ask about this recording' }).fill('When is the release?');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await page.getByText('Thinking through your question', { exact: true }).waitFor(); checks++;
    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1100 });
      await fits(`AI thinking overflows at ${width}`);
    }
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.screenshot({ path: '/tmp/voxmind-ai-thinking.png', fullPage: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.activity-wave span').first().evaluate((el) => getComputedStyle(el).animationName), 'none'); checks++;
    askGate.resolve();
    await page.getByText('The release is planned for Friday.', { exact: true }).waitFor(); checks++;
    assert(await page.getByText('Not Found', { exact: true }).isVisible()); checks++;
    askFails = true;
    askGate = deferred();
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await page.getByText('Thinking through your question', { exact: true }).waitFor();
    assert.equal(await page.getByText('The release is planned for Friday.', { exact: true }).count(), 1); checks++;
    askGate.resolve();
    await page.getByRole('alert').filter({ hasText: 'still downloading' }).waitFor(); checks++;
    askFails = false;
    await page.getByRole('button', { name: 'Try question again', exact: true }).click();
    await page.getByText('Question 2', { exact: true }).waitFor(); checks++;
    assert.equal(await page.getByText('The release is planned for Friday.', { exact: true }).count(), 2); checks++;
    await page.reload();
    await page.getByRole('tab', { name: 'Ask AI', exact: true }).click();
    await page.getByText('Question 2', { exact: true }).waitFor(); checks++;
    const reportOpened = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.getByRole('menuitem', { name: 'PDF report — all four sections', exact: true }).click();
    const report = await reportOpened;
    await report.waitForLoadState('domcontentloaded');
    for (const section of ['01 / Summary', '02 / Decisions', '03 / Actions', '04 / Ask AI — Questions and answers']) {
      assert(await report.getByRole('heading', { name: section, exact: true }).isVisible()); checks++;
    }
    assert.equal(await report.getByText('The release is planned for Friday.', { exact: true }).count(), 2); checks++;
    const pdf = await report.pdf({ path: '/tmp/voxmind-complete-report.pdf', printBackground: true, preferCSSPageSize: true });
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-'); checks++;
    await report.screenshot({ path: '/tmp/voxmind-report-preview.png', fullPage: true });
    await report.close();
    await page.goto(`${base}/app/ask`);
    knowledgeGate = deferred();
    await page.getByPlaceholder('Ask a question about decisions, benchmarks, or commitments...').fill('What was agreed?');
    await page.getByRole('button', { name: 'Send query' }).click();
    await page.getByText('Thinking through your question', { exact: true }).waitFor(); checks++;
    knowledgeGate.resolve();
    await page.getByRole('alert').filter({ hasText: 'Model unavailable' }).waitFor();
    knowledgeFails = false;
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.getByText('Workspace answer: release Friday.', { exact: true }).waitFor();
    assert.equal(lastKnowledgeQuestion, 'What was agreed?'); checks++;
    assert.equal(await page.getByText('What was agreed?', { exact: true }).count(), 1); checks++;
    assert.deepEqual(errors, []);
    console.log(`${checks} insight UI checks passed, including polling, retry, action persistence, responsive layouts and reduced motion.`);
  } catch (error) {
    await page.screenshot({ path: '/tmp/voxmind-insights-failure.png', fullPage: true }).catch(() => {});
    throw error;
  } finally {
    askGate?.resolve(); knowledgeGate?.resolve();
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
