/* Run against the development server and a local backend; no inference required. */
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { existsSync } = require("node:fs");
const { chromium } = require("playwright");

const base = process.env.VOXMIND_BASE_URL || "http://127.0.0.1:5173";
const executablePath =
  process.env.CHROMIUM_PATH ||
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const viewports = [320, 390, 768, 1024, 1440, 1920];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let collectionId;
  let token;
  let checks = 0;
  const check = (condition, message) => {
    assert.ok(condition, message);
    checks += 1;
  };
  async function fits(label) {
    const { width, documentWidth } = await page.evaluate(() => ({
      width: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    check(
      documentWidth <= width,
      `${label}: horizontal overflow (${documentWidth} > ${width})`,
    );
  }
  try {
    console.log("Checking authentication and collections…");
    // Forms run against the real API, with a unique account on the local development database.
    await page.goto(`${base}/login`);
    await page.getByRole("button", { name: "Open your workspace" }).click();
    await page
      .getByText("Email address is required.", { exact: true })
      .waitFor();
    check(
      await page.locator('#email[aria-invalid="true"]').count(),
      "Login exposes validation errors",
    );
    await page.goto(`${base}/register`);
    const suffix = randomUUID();
    const email = `frontend-review-${suffix}@example.test`;
    const password = `Review-${suffix}!`;
    await page.getByLabel("Your name", { exact: true }).fill("Frontend Review");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Create workspace", exact: true })
      .click();
    await page.waitForURL("**/app/overview");
    token = await page.evaluate(() =>
      localStorage.getItem("voxmind_access_token"),
    );
    check(!!token, "Registration persists a real session");
    await page
      .getByText("A little space for something brilliant.", { exact: true })
      .waitFor();
    checks += 1;

    await page.goto(`${base}/app/collections`);
    await page
      .getByRole("button", { name: "New Collection", exact: true })
      .click();
    await page
      .getByPlaceholder("e.g. Q4 Executive Leadership Syncs")
      .fill(`Review ${suffix}`);
    const created = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/v1/collections") &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Create Collection", exact: true })
      .click();
    const response = await created;
    check(response.status() === 201, "Collection is saved through the API");
    collectionId = (await response.json()).data.id;
    await page
      .getByRole("heading", { name: `Review ${suffix}`, exact: true })
      .waitFor();
    checks += 1;

    await page
      .getByRole("button", { name: `Delete Review ${suffix}`, exact: true })
      .click();
    await page.getByRole("dialog", { name: "Delete collection?" }).waitFor();
    await page
      .getByRole("button", { name: "Keep collection", exact: true })
      .click();
    await page
      .getByRole("heading", { name: `Review ${suffix}`, exact: true })
      .waitFor();
    checks += 1;

    // A deterministic detail fixture exercises transcript and responsive detail layouts.
    // It is not a substitute for real speech-to-text or model inference tests.
    const now = new Date().toISOString();
    await page.route("**/api/v1/recordings/frontend-review-fixture", (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            id: "frontend-review-fixture",
            title: "Design review — a clearer workspace",
            filename: "design-review.wav",
            workspace_id: "review",
            user_id: "review",
            file_size_bytes: 4096,
            duration_seconds: 88,
            mime_type: "audio/wav",
            status: "completed",
            language: "en",
            created_at: now,
            updated_at: now,
            segments: [
              {
                id: "s1",
                recording_id: "frontend-review-fixture",
                segment_index: 0,
                start_time: 0,
                end_time: 8,
                speaker: "Alex",
                text: "Let’s make the workspace easier to use on every screen.",
                confidence: 0.98,
              },
            ],
            summaries: [],
            action_items: [],
          },
        },
      }),
    );
    console.log("Checking responsive screens…");
    await page.goto(`${base}/app/recordings/frontend-review-fixture`);
    await page
      .getByRole("heading", {
        name: "Design review — a clearer workspace",
        exact: true,
      })
      .waitFor();
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export/ }).click();
    const download = await downloadEvent;
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const markdown = Buffer.concat(chunks).toString("utf8");
    check(
      markdown.includes("# Design review — a clearer workspace") &&
        markdown.includes("**[0:00] Alex**"),
      "Markdown export contains actual title and transcript",
    );
    const routes = [
      "overview",
      "recordings",
      "collections",
      "ask",
      "api",
      "settings",
      "recordings/frontend-review-fixture",
    ];
    for (const width of viewports) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of routes) {
        await page.goto(`${base}/app/${route}`);
        await page.locator("h1").waitFor();
        await fits(`${route} at ${width}px`);
        const geometry = await page
          .getByRole("button", { name: "Search workspace" })
          .evaluate((el) => ({
            height: el.getBoundingClientRect().height,
            icon: el.querySelector("svg").getBoundingClientRect().width,
          }));
        check(
          geometry.height >= 56 && geometry.icon >= 26,
          "Prominent search control at every viewport",
        );
        if (width >= 1024) {
          check(
            await page
              .locator(".desktop-sidebar .nav-item svg")
              .first()
              .evaluate((el) => el.getBoundingClientRect().width >= 26),
            "Large navigation icons",
          );
        }
        check(
          (await page.locator("main").innerText()).trim().length > 30,
          `${route} renders its content`,
        );
      }
      for (const route of ["login", "register"]) {
        await page.goto(`${base}/${route}`);
        await page.locator("h1").waitFor();
        await fits(`${route} at ${width}px`);
      }
    }
    console.log("Checking keyboard navigation and themes…");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/app/overview`);
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
    const drawer = page.getByRole("dialog");
    await drawer.waitFor();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      check(
        await page.evaluate(
          () => !!document.activeElement?.closest('[role="dialog"]'),
        ),
        "Drawer traps keyboard focus",
      );
    }
    await page.keyboard.press("Escape");
    await drawer.waitFor({ state: "hidden" });
    await page.waitForFunction(el => el === document.activeElement, await page.getByRole("button", { name: "Open navigation", exact: true }).elementHandle());
    check(
      await page
        .getByRole("button", { name: "Open navigation", exact: true })
        .evaluate((el) => el === document.activeElement),
      "Drawer restores trigger focus",
    );
    await page.getByRole("button", { name: "Search workspace" }).click();
    await page.getByRole("dialog").waitFor();
    await page
      .getByRole("textbox", { name: "Search recordings and transcripts" })
      .fill("nonexistent recording");
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    checks += 1;
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await page.getByRole("menuitem", { name: "Dark", exact: true }).click();
    check(
      await page
        .locator("html")
        .evaluate((el) => el.classList.contains("dark")),
      "Dark theme applies",
    );
    await page.reload();
    await page.locator("h1").waitFor();
    check(
      await page
        .locator("html")
        .evaluate((el) => el.classList.contains("dark")),
      "Theme persists across reload",
    );
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await page
      .getByRole("menuitem", { name: "System Default", exact: true })
      .click();
    await page.emulateMedia({ colorScheme: "light" });
    await page.waitForFunction(() =>
      document.documentElement.classList.contains("light"),
    );
    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForFunction(() =>
      document.documentElement.classList.contains("dark"),
    );
    checks += 1;
    await page
      .getByRole("button", { name: "Upload recording", exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
    await fits("Upload dialog at 390px");
    const chooser = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Choose audio file", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await (
      await chooser
    ).setFiles({
      name: "review.wav",
      mimeType: "audio/wav",
      buffer: Buffer.from("RIFF....WAVEfmt "),
    });
    await page.getByText("review.wav", { exact: true }).waitFor();
    check(
      (await page
        .getByRole("textbox", { name: "Recording Title", exact: true })
        .inputValue()) === "review",
      "Keyboard file selection populates the recording title",
    );
    await page
      .getByRole("button", { name: "Choose audio file", exact: true })
      .evaluate((el) => {
        const transfer = new DataTransfer();
        transfer.items.add(
          new File(["invalid"], "review.txt", { type: "text/plain" }),
        );
        el.dispatchEvent(
          new DragEvent("drop", {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer,
          }),
        );
      });
    await page
      .getByRole("alert")
      .filter({ hasText: "Unsupported format .txt" })
      .waitFor();
    checks += 1;
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.goto(`${base}/login`);
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Open your workspace" }).click();
    await page.waitForURL("**/app/overview");
    checks += 1;
    assert.deepEqual(errors, [], "No browser runtime exceptions");
    console.log(
      `PASS: ${checks} checks; nine screens at six widths; real registration, login and collection creation; drawer focus, search, upload dialog, Markdown export and themes. Detail screen uses a fixture; model inference is not tested.`,
    );
  } catch (error) {
    console.error("Failed at", new URL(page.url()).pathname);
    await page.screenshot({
      path: "/tmp/voxmind-smoke-failure.png",
      fullPage: true,
    });
    throw error;
  } finally {
    if (collectionId && token) {
      const result = await page.request.delete(
        `${base}/api/v1/collections/${collectionId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      assert.ok(result.ok(), "Remove review collection");
    }
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
