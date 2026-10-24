/* Public product pages plus real API-key creation/authorization. No live OAuth consent. */
const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const { chromium } = require('playwright');
const base = process.env.VOXMIND_BASE_URL || 'http://127.0.0.1:5173';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  let checks = 0; const check = (value, message) => { assert(value, message); checks++; };
  const fits = async (label) => check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label);
  let token; let collection;
  try {
    for (const theme of ['Light', 'Dark']) {
      await page.goto(base);
      await page.getByRole('heading', { level: 1 }).waitFor();
      await page.getByRole('button', { name: 'Toggle theme' }).click();
      await page.getByRole('menuitem', { name: theme, exact: true }).click();
      for (const width of [320, 390, 768, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        await fits(`${theme} landing at ${width}`);
        if (width === 1440) await page.screenshot({ path: `/tmp/meetingbrief-landing-${theme.toLowerCase()}.png`, fullPage: true, animations: 'disabled' });
        if (width === 390) await page.screenshot({ path: `/tmp/meetingbrief-landing-mobile-${theme.toLowerCase()}.png`, fullPage: true, animations: 'disabled' });
        for (const route of ['/login', '/register', '/app/docs', '/privacy']) {
          await page.goto(`${base}${route}`); await page.locator('h1').waitFor(); await fits(`${theme} ${route} at ${width}`);
          check(await page.locator('a[href*="github.com"]').count() === 0, 'Customer help stays on the product site');
        }
        await page.goto(base); await page.locator('h1').waitFor();
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    check(await page.getByRole('navigation', { name: 'Main navigation' }).isVisible(), 'Mobile menu opens');
    await page.keyboard.press('Escape');
    check(await page.getByRole('button', { name: 'Open menu', exact: true }).evaluate((el) => el === document.activeElement), 'Mobile menu restores focus');
    await page.goto(`${base}/app/recordings`); await page.waitForURL('**/login'); checks++;
    await page.getByLabel('Password', { exact: true }).fill('Visible-test-password');
    await page.getByRole('button', { name: 'Show password', exact: true }).click();
    check(await page.getByLabel('Password', { exact: true }).getAttribute('type') === 'text', 'Password visibility toggle works');
    await page.getByRole('button', { name: 'Hide password', exact: true }).click();
    await page.route('**/api/v1/auth/google/config', (route) => route.fulfill({ json: { success: true, data: { configured: true } } }));
    await page.reload();
    const google = page.getByRole('link', { name: 'Continue with Google', exact: true }); await google.waitFor();
    check((await google.getAttribute('href')).endsWith('/auth/google/start'), 'Google sign-in starts on the application backend');
    await page.unroute('**/api/v1/auth/google/config');
    await page.goto(`${base}/login?google=error&reason=GOOGLE_LINK_REQUIRED`);
    await page.getByText('This email already has an account.', { exact: false }).waitFor();
    check(await page.getByText('This email already has an account.', { exact: false }).isVisible(), 'Google linking errors explain the safe next step');
    await page.goto(`${base}/app/docs`);
    await page.getByText('/recordings/{id}/audio-ticket', { exact: true }).waitFor();
    await page.getByRole('link', { name: 'API quickstart', exact: true }).click();
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Download OpenAPI specification' }).click();
    const download = await downloadEvent; const stream = await download.createReadStream(); const parts = []; for await (const chunk of stream) parts.push(chunk);
    const spec = JSON.parse(Buffer.concat(parts).toString());
    check(spec.openapi === '3.1.0' && spec.info.title === 'MeetingBrief API', 'Downloadable API specification has the product name');
    check(Boolean(spec.paths['/recordings'].post && spec.paths['/recordings/{id}/ask'].post), 'Specification documents upload and questions');
    const signup = await page.request.post(`${base}/api/v1/auth/register`, { data: { email: `product-${randomUUID()}@example.test`, password: 'Product-test-password-123', fullName: 'Product test' } });
    check(signup.status() === 201, 'Real signup succeeds'); const account = (await signup.json()).data; token = account.access_token;
    await page.evaluate((account) => { localStorage.setItem('voxmind_access_token', account.access_token); localStorage.setItem('voxmind_user', JSON.stringify(account.user)); }, account);
    await page.goto(`${base}/app/api`); await page.getByRole('button', { name: 'Generate API Key', exact: true }).waitFor({ state: 'visible' });
    const create = async (name, mode) => {
      await page.getByRole('button', { name: 'Generate API Key', exact: true }).click();
      await page.getByLabel('Key Name / Purpose').fill(name);
      await page.getByRole('combobox', { name: 'API key access', exact: true }).selectOption(mode);
      await page.getByRole('combobox', { name: 'API key expiry', exact: true }).selectOption('7');
      await page.getByRole('button', { name: 'Generate Key', exact: true }).click();
      const input = page.getByRole('dialog').locator('input[readonly]'); await input.waitFor(); const key = await input.inputValue();
      check(/^mb_live_/.test(key), 'New API key uses MeetingBrief prefix');
      await page.getByRole('button', { name: 'I Have Saved My Key', exact: true }).click();
      check(await page.locator(`input[value="${key}"]`).count() === 0, 'Full secret is removed after closing the dialog');
      return key;
    };
    const readonly = await create('Product read key', 'read');
    check((await page.request.get(`${base}/api/v1/recordings`, { headers: { Authorization: `Bearer ${readonly}` } })).status() === 200, 'Read key retrieves recordings');
    check((await page.request.post(`${base}/api/v1/collections`, { headers: { Authorization: `Bearer ${readonly}` }, data: { name: 'Denied' } })).status() === 403, 'Read key cannot mutate a workspace');
    const writable = await create('Product write key', 'write');
    const created = await page.request.post(`${base}/api/v1/collections`, { headers: { Authorization: `Bearer ${writable}` }, data: { name: 'API product test' } });
    check(created.status() === 201, 'Write key can create a collection'); collection = (await created.json()).data.id;
    await page.getByRole('group', { name: 'API key Product read key', exact: true }).getByRole('button', { name: 'Revoke', exact: true }).click();
    await page.getByRole('group', { name: 'API key Product read key', exact: true }).getByText('revoked', { exact: true }).waitFor();
    check((await page.request.get(`${base}/api/v1/recordings`, { headers: { Authorization: `Bearer ${readonly}` } })).status() === 401, 'Revoked key stops working');
    await page.goto(`${base}/app/settings`); await page.getByRole('heading', { name: 'Google sign-in', exact: true }).waitFor(); checks++;
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto(base); await page.locator('h1').waitFor();
    check(await page.locator('.landing-preview-wave .signal-wave span').first().evaluate((el) => getComputedStyle(el).animationName) === 'none', 'Landing motion respects reduced-motion setting');
    assert.deepEqual(errors, []);
    console.log(`${checks} product checks passed: landing, auth, guides, responsive themes and real API key permissions.`);
  } catch (error) {
    await page.screenshot({ path: '/tmp/meetingbrief-product-failure.png', fullPage: true }).catch(() => {}); throw error;
  } finally {
    if (collection && token) await page.request.delete(`${base}/api/v1/collections/${collection}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
