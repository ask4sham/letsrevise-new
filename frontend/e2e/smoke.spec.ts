import { test, expect } from "@playwright/test";

/**
 * Phase 4C — Browser smoke (no auth-heavy flows).
 * Verifies the app shell loads and critical exam strings/assets are not broken at the SPA entry.
 *
 * For authenticated teacher/student journeys, set SMOKE_AUTH_STORAGE if you add storageState later.
 */

test.describe("Stability smoke", () => {
  test("home / app shell loads without page error", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));

    const res = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(res, "navigation response").toBeTruthy();
    expect(res!.status(), "HTTP status").toBeLessThan(500);

    await expect(page.locator("body")).toBeVisible();
    // HashRouter apps still mount #root
    await expect(page.locator("#root")).toBeVisible({ timeout: 15_000 });

    expect(pageErrors, `pageerrors: ${pageErrors.join("; ")}`).toEqual([]);
  });

  test("login route is reachable", async ({ page }) => {
    await page.goto("/#/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#root")).toBeVisible({ timeout: 15_000 });
    // Soft assert: some form of auth UI or brand text appears
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(20);
  });

  test("production-like bundle markers when SMOKE_CHECK_BUNDLE=1", async ({ request, baseURL }) => {
    test.skip(process.env.SMOKE_CHECK_BUNDLE !== "1", "Set SMOKE_CHECK_BUNDLE=1 to enable");
    const home = await request.get(baseURL!);
    expect(home.ok()).toBeTruthy();
    const html = await home.text();
    const m = html.match(/static\/js\/main\.([a-z0-9]+)\.js/);
    expect(m, "main bundle in HTML").toBeTruthy();
    const js = await request.get(`${baseURL}/static/js/main.${m![1]}.js`);
    expect(js.ok()).toBeTruthy();
    const text = await js.text();
    expect(text.includes("exam-composite-table-input")).toBeTruthy();
    expect(text.includes("exam-composite-reveal-btn")).toBeTruthy();
    const env = text.match(/REACT_APP_TABLE_PARTS_ENABLED:"([^"]*)"/);
    const tableOn =
      (env && env[1] === "true") || text.includes("TABLE_PARTS_ENABLED:!0");
    expect(tableOn, "table flag on in served bundle").toBeTruthy();
  });
});
