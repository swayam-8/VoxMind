/* Regression for real long topics, narrow insight panels, and readable Q&A. */
const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
const { chromium } = require('playwright');

const base = process.env.VOXMIND_BASE_URL || 'http://127.0.0.1:4173';
const longTopic = 'Manitoba Growth Renewal and Opportunities for municipalities program';
const unbrokenTopic = 'MunicipalInfrastructureReference'.repeat(8);
const topics = ['Water treatment plant', 'Agenda', 'Minutes', longTopic, 'Catalyst Agreement website renewal and upgrade', unbrokenTopic];
const widths = [320, 390, 768, 1024, 1280, 1440, 1920];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let complete = false;
  let checks = 0;
  const check = (value, message) => { assert(value, message); checks++; };
  const id = 'layout-review';
  const recording = () => ({
    id, title: 'Council meeting · Decisions that move the city forward', filename: 'council-meeting-review.wav',
    duration_seconds: 1620, created_at: '2026-10-23T09:00:00Z', status: 'completed', analysis_status: 'completed',
    language: 'en', index_status: 'completed',
    segments: topics.map((topic, index) => ({ id: `segment-${index}`, start_time: index * 60, end_time: index * 60 + 55, speaker: index % 2 ? 'Council member' : 'Chair', text: `The council discussed ${topic}. The motion was carried and the next steps were approved.`, confidence: .98 })),
    summaries: [{ id: 'summary', status: 'completed', model_name: 'llama3.2', summary_markdown: 'The council reviewed community infrastructure and approved the next phase of improvements. Members discussed the water treatment plant, municipal funding opportunities, and the website renewal agreement.',
      key_takeaways: ['Authorization to tender for the water treatment plant', 'Approval of the agenda', 'Adoption of the minutes', `Approval of the ${longTopic}`, 'Approval of the Catalyst Agreement website renewal and upgrade'],
      topics,
      decisions: [{ decision: `Approve the ${longTopic}`, context: `The council agreed to proceed with the application. Reference: ${unbrokenTopic}`, source_timestamp: 0 }],
    }],
    action_items: [{ id: 'task', task: `Prepare the next application for the ${longTopic}`, assignee: `Planning department ${unbrokenTopic}`, due_date: 'Before the next council meeting', completed: complete, source_timestamp: 60 }],
  });
  await context.addInitScript(() => {
    localStorage.setItem('voxmind_access_token', 'layout-fixture');
    localStorage.setItem('voxmind_user', JSON.stringify({ id: 'test', fullName: 'Swayam', email: 'review@example.test' }));
    localStorage.setItem('voxmind-theme', 'light');
  });
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data = [];
    if (path.endsWith(`/recordings/${id}`)) data = recording();
    else if (path.endsWith('/questions')) data = [{
      id: 'question', recording_id: id, question: `What was approved for the ${longTopic}? ${unbrokenTopic}`,
      answer: `The council approved the application. ${unbrokenTopic}`, supported_by_transcript: true, timestamps: [0, 60, 120],
    }];
    else if (path.endsWith('/action-items/task')) { complete = route.request().postDataJSON().completed; data = recording().action_items[0]; }
    else if (path.endsWith('/audio')) return route.fulfill({ status: 204 });
    await route.fulfill({ json: { success: true, data } });
  });
  const fits = async (label) => {
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: page overflow`);
    // Check inside cards too: clipping an overflowing child must not pass this test.
    const overflow = await page.locator('.intelligence-panel, [role="tab"], .topic-badge, .briefing-card, .takeaway-list li, .insight-card, .conversation-card, .transcript-segment').evaluateAll((elements) => elements.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => ({ className: el.className, width: el.clientWidth, content: el.scrollWidth })));
    check(!overflow.length, `${label}: card overflow ${JSON.stringify(overflow)}`);
    const panel = await page.locator('.intelligence-panel').boundingBox();
    const tabs = await page.getByRole('tab').all();
    for (const tab of tabs) {
      const box = await tab.boundingBox();
      check(box.x >= panel.x && box.x + box.width <= panel.x + panel.width && box.height >= 44, `${label}: tab must fit and remain touchable`);
      check(await tab.locator('svg').evaluate((el) => el.getBoundingClientRect().width >= 22), `${label}: visible tab icon`);
    }
  };
  const screenshot = async (path) => {
    await page.evaluate(async () => {
      await Promise.all(document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => {})));
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await page.screenshot({ path, fullPage: true });
  };
  try {
    await page.goto(`${base}/app/recordings/${id}`);
    await page.getByRole('heading', { name: recording().title, exact: true }).waitFor();
    for (const theme of ['Light', 'Dark']) {
      await page.getByRole('button', { name: 'Toggle theme' }).click();
      await page.getByRole('menuitem', { name: theme, exact: true }).click();
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1100 });
        for (const tab of ['Summary', 'Decisions', 'Actions', 'Ask AI']) {
          await page.getByRole('tab', { name: tab, exact: true }).click();
          await fits(`${theme} ${width}px ${tab}`);
          if (tab === 'Summary') {
            check(await page.locator('.topic-badge').filter({ hasText: longTopic }).isVisible(), 'Full long topic is visible');
            check(await page.locator('.topic-badge').filter({ hasText: unbrokenTopic }).evaluate((el) => getComputedStyle(el).whiteSpace === 'normal'), 'Unbroken topics can wrap');
          }
          if (width === 1440 && tab === 'Summary') await screenshot(`/tmp/voxmind-polished-${theme.toLowerCase()}.png`);
          if (width === 390 && tab === 'Summary') await screenshot(`/tmp/voxmind-polished-mobile-${theme.toLowerCase()}.png`);
        }
        const player = await page.locator('.recording-player').boundingBox();
        const panel = await page.locator('.intelligence-panel').boundingBox();
        const transcript = await page.locator('.transcript-panel').boundingBox();
        if (width <= 1024) check(player.y < panel.y && panel.y < transcript.y, 'Mobile puts insights between playback and transcript');
        if (width >= 1440) check(Math.abs(player.y - panel.y) < 2, 'Wide layout aligns transcript and insight columns');
      }
    }
    await page.getByRole('tab', { name: 'Actions', exact: true }).click();
    check(await page.getByRole('progressbar').getAttribute('aria-valuenow') === '0', 'Action progress starts at saved value');
    await page.getByRole('checkbox').click();
    await page.getByText('1 of 1 complete', { exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('input[type="checkbox"]')?.checked);
    check(await page.getByRole('progressbar').getAttribute('aria-valuenow') === '1', 'Completing a task updates progress');
    await page.getByRole('tab', { name: 'Summary', exact: true }).click();
    check(await page.getByRole('tabpanel', { name: 'Summary', exact: true }).evaluate((el) => getComputedStyle(el).animationName) === 'detail-reveal', 'Tab content animates on entry');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    check(await page.locator('.takeaway-list li').first().evaluate((el) => getComputedStyle(el).animationName) === 'none', 'Reduced motion disables card animation');
    check(await page.getByRole('tabpanel', { name: 'Summary', exact: true }).evaluate((el) => getComputedStyle(el).animationName) === 'none', 'Reduced motion disables tab animation');
    assert.deepEqual(errors, []);
    console.log(`${checks} detail layout checks passed across seven widths, both themes and all four tabs.`);
  } catch (error) {
    await page.screenshot({ path: '/tmp/voxmind-layout-failure.png', fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
