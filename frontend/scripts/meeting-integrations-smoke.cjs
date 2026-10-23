const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { randomUUID } = require("node:crypto");
const { existsSync } = require("node:fs");
const base = process.env.VOXMIND_BASE_URL || "http://127.0.0.1:5173";
const executablePath =
  process.env.CHROMIUM_PATH ||
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let checks = 0;
  try {
    const registration = await page.request.post(
      `${base}/api/v1/auth/register`,
      {
        data: {
          email: `meetings-ui-${randomUUID()}@example.test`,
          password: "Meeting-ui-test-123!",
          fullName: "Meeting integration review",
        },
      },
    );
    assert.equal(registration.status(), 201);
    const session = (await registration.json()).data;
    await context.addInitScript(
      ({ token, user }) => {
        localStorage.setItem("voxmind_access_token", token);
        localStorage.setItem("voxmind_user", JSON.stringify(user));
      },
      { token: session.access_token, user: session.user },
    );
    // Actual running backend: absent provider apps must show setup, never fake a connection.
    await page.goto(`${base}/app/api`);
    await page
      .getByRole("heading", { name: "Connect once. Keep the conversation." })
      .waitFor();
    const actual = await page.request.get(
      `${base}/api/v1/meeting-integrations`,
      { headers: { Authorization: `Bearer ${session.access_token}` } },
    );
    assert.equal(actual.status(), 200);
    const actualConnections = (await actual.json()).data;
    for (const account of actualConnections.filter(
      (account) => !account.configured,
    )) {
      const card = page.locator(".meeting-provider-card").filter({
        has: page.getByRole("heading", { name: account.name, exact: true }),
      });
      await card.getByRole("button", { name: "Set up connection" }).click();
      await page
        .getByRole("dialog", { name: `Enable ${account.name} imports` })
        .waitFor();
      assert(
        await page.getByText(account.callbackUrl, { exact: true }).isVisible(),
      );
      checks++;
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.waitForFunction(el => el === document.activeElement, await card.getByRole("button", { name: "Set up connection" }).elementHandle());
      assert(
        await card
          .getByRole("button", { name: "Set up connection" })
          .evaluate((el) => el === document.activeElement),
        "Setup dialog returns focus to its opener",
      );
      checks++;
    }
    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Setup cards overflow at ${width}`,
      );
      checks++;
    }
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.locator("main").focus();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "/tmp/voxmind-meeting-integrations.png",
      fullPage: true,
      animations: "disabled",
    });

    // Provider fixtures test frontend interactions without authorizing a real external account.
    const connections = ["zoom", "google-meet", "webex"].map(
      (provider, index) => ({
        provider,
        name: ["Zoom", "Google Meet", "Webex"][index],
        configured: true,
        connected: true,
        connectedAt: new Date().toISOString(),
        missingVariables: [],
        callbackUrl: `${base}/api/v1/meeting-integrations/${provider}/callback`,
        scopes: [],
      }),
    );
    const imports = [];
    let providerFailure = false;
    let importsStarted = 0;
    await page.route("**/api/v1/meeting-integrations**", async (route) => {
      const url = new URL(route.request().url());
      const parts = url.pathname.split("/");
      const provider = parts[4];
      if (url.pathname.endsWith("/meeting-integrations"))
        return route.fulfill({ json: { success: true, data: connections } });
      if (url.pathname.endsWith("/meeting-integrations/imports"))
        return route.fulfill({ json: { success: true, data: imports } });
      if (url.pathname.endsWith("/recordings")) {
        if (providerFailure)
          return route.fulfill({
            status: 403,
            json: {
              success: false,
              message:
                "Recording access is restricted for this fixture account.",
            },
          });
        const second = url.searchParams.get("cursor") === "page-2";
        const id = `remote-${provider}${second ? "-second" : ""}`;
        return route.fulfill({
          json: {
            success: true,
            data: {
              recordings: [
                {
                  id,
                  title: `${provider} project review${second ? " two" : ""}`,
                  createdAt: new Date().toISOString(),
                  durationSeconds: 600,
                  sizeBytes: 1024 * 1024,
                  mimeType: "audio/mp4",
                  import: imports.find((job) => job.externalId === id) || null,
                },
                ...(!second
                  ? [
                      {
                        id: `large-${provider}`,
                        title: "Recording above size limit",
                        createdAt: new Date().toISOString(),
                        durationSeconds: 3600,
                        sizeBytes: 200 * 1024 * 1024,
                        mimeType: "video/mp4",
                        import: null,
                      },
                    ]
                  : []),
              ],
              nextCursor: second ? null : "page-2",
              maxImportSizeMb: 100,
            },
          },
        });
      }
      if (
        url.pathname.endsWith("/imports") &&
        route.request().method() === "POST"
      ) {
        const { recordingId } = route.request().postDataJSON();
        importsStarted++;
        const job = {
          id: randomUUID(),
          provider,
          externalId: recordingId,
          title: `${provider} project review`,
          status: "queued",
          recordingId: null,
          error: null,
          createdAt: new Date().toISOString(),
        };
        imports.push(job);
        return route.fulfill({
          status: 202,
          json: { success: true, data: job },
        });
      }
      if (
        url.pathname.endsWith("/connection") &&
        route.request().method() === "DELETE"
      ) {
        connections.find((account) => account.provider === provider).connected =
          false;
        return route.fulfill({
          json: { success: true, data: { disconnected: true } },
        });
      }
      return route.continue();
    });
    await page.reload();
    for (const account of connections) {
      const card = page.locator(".meeting-provider-card").filter({
        has: page.getByRole("heading", { name: account.name, exact: true }),
      });
      await card.getByRole("button", { name: "Browse recordings" }).click();
      const dialog = page.getByRole("dialog", {
        name: `${account.name} recordings`,
      });
      await dialog.waitFor();
      await dialog
        .getByRole("heading", {
          name: `${account.provider} project review`,
          exact: true,
        })
        .waitFor();
      const large = dialog
        .locator(".meeting-cloud-recording")
        .filter({ hasText: "Recording above size limit" });
      assert(
        await large
          .getByRole("button", { name: "Import recording" })
          .isDisabled(),
      );
      checks++;
      await dialog
        .getByRole("button", { name: "Load more recordings" })
        .click();
      await dialog
        .getByRole("heading", {
          name: `${account.provider} project review two`,
          exact: true,
        })
        .waitFor();
      checks++;
      const first = dialog.locator(".meeting-cloud-recording").filter({
        has: page.getByRole("heading", {
          name: `${account.provider} project review`,
          exact: true,
        }),
      });
      await first.getByRole("button", { name: "Import recording" }).click();
      await first.getByRole("button", { name: "Importing" }).waitFor();
      checks++;
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      const latest = imports[imports.length - 1];
      latest.status = "imported";
      latest.recordingId = `local-${account.provider}`;
      await page
        .locator(".meeting-import-history")
        .getByRole("button", { name: "Refresh", exact: true })
        .click();
      const row = page
        .locator(".meeting-import-row")
        .filter({ hasText: `${account.provider} project review` });
      await row.getByRole("link", { name: "Open" }).waitFor();
      assert(
        (
          await row.getByRole("link", { name: "Open" }).getAttribute("href")
        ).includes(`local-${account.provider}`),
      );
      checks++;
    }
    assert.equal(importsStarted, 3);
    // Narrow screens must also fit actual recording lists, not only provider cards.
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      const card = page.locator(".meeting-provider-card").filter({
        has: page.getByRole("heading", { name: "Zoom", exact: true }),
      });
      await card.getByRole("button", { name: "Browse recordings" }).click();
      await page
        .getByRole("heading", { name: "zoom project review", exact: true })
        .last()
        .waitFor();
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Recording dialog overflows at ${width}`,
      );
      checks++;
      await page.keyboard.press("Escape");
    }
    await page
      .getByRole("button", { name: "Disconnect Zoom", exact: true })
      .click();
    await page.getByRole("dialog", { name: "Disconnect Zoom?" }).waitFor();
    await page
      .getByRole("button", { name: "Keep connection", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Disconnect Zoom", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Disconnect account", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Connect Zoom", exact: true })
      .waitFor();
    checks++;
    assert.equal(imports.length, 3, "Disconnect preserves history");
    providerFailure = true;
    const webex = page.locator(".meeting-provider-card").filter({
      has: page.getByRole("heading", { name: "Webex", exact: true }),
    });
    await webex.getByRole("button", { name: "Browse recordings" }).click();
    await page
      .getByRole("heading", { name: "Couldn’t load recordings" })
      .waitFor();
    assert(
      await page
        .getByRole("button", { name: "Reconnect account", exact: true })
        .isVisible(),
    );
    checks++;
    assert.deepEqual(errors, []);
    console.log(
      `PASS: ${checks} browser checks for meeting integrations. Actual server setup states; fixture provider listing, pagination, size limits, import progress, library links, disconnect and errors. No real provider account was authorized.`,
    );
  } catch (error) {
    await page.screenshot({
      path: "/tmp/voxmind-meeting-browser-failure.png",
      fullPage: true,
    });
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
