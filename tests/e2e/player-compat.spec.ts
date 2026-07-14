import { test, expect, Page } from "@playwright/test";

/**
 * Player rendering / legacy WebView compatibility regression suite.
 *
 * These tests target the synthetic /__compat-test route, which reproduces the
 * three CSS primitives the Player relies on and that break on Chromium < 87
 * (old Android TV boxes, e.g. X96Q_PRO1 / WebView 80):
 *
 *   - `position: absolute; inset: 0`  (shorthand added in Chrome 87)
 *   - `.inset-0`  Tailwind utility (compiled to the shorthand)
 *   - `aspect-video` / `aspect-ratio`
 *
 * The compat layer (src/lib/legacy-webview.ts) is toggled via a URL param
 * `?legacyCompat=on|off|auto` so tests stay hermetic (no localStorage side
 * effects between runs).
 *
 * A regression here means: after a change to the Player CSS or the compat
 * shim, one of the primitives no longer fills its intended box on a legacy
 * WebView — which would translate to a black/broken screen in production.
 */

const VIEWPORT = { width: 1280, height: 1800 };

/** Bounding boxes are floats — tolerate sub-pixel rounding. */
function expectBoxEqual(actual: { x: number; y: number; width: number; height: number } | null, expected: { x: number; y: number; width: number; height: number }, tol = 1) {
  expect(actual, "element has a bounding box").not.toBeNull();
  if (!actual) return;
  expect(Math.abs(actual.x - expected.x), `x=${actual.x} vs ${expected.x}`).toBeLessThanOrEqual(tol);
  expect(Math.abs(actual.y - expected.y), `y=${actual.y} vs ${expected.y}`).toBeLessThanOrEqual(tol);
  expect(Math.abs(actual.width - expected.width), `w=${actual.width} vs ${expected.width}`).toBeLessThanOrEqual(tol);
  expect(Math.abs(actual.height - expected.height), `h=${actual.height} vs ${expected.height}`).toBeLessThanOrEqual(tol);
}

async function gotoCompat(page: Page, compat: "on" | "off" | "auto" = "auto") {
  await page.goto(`/__compat-test?legacyCompat=${compat}`, { waitUntil: "domcontentloaded" });
  // Wait for the synthetic layout + the compat script to run.
  await page.waitForSelector('[data-testid="root"]');
  await page.waitForFunction(() => Boolean((window as any).__LEGACY_WEBVIEW__));
}

test.describe("Player CSS primitives — modern mode (compat OFF)", () => {
  test.use({ viewport: VIEWPORT });

  test("compat layer is disabled and does not tag the document", async ({ page }) => {
    await gotoCompat(page, "off");
    const attr = await page.evaluate(() => document.documentElement.getAttribute("data-legacy-webview"));
    expect(attr).toBeNull();
    const report = await page.evaluate(() => (window as any).__LEGACY_WEBVIEW__);
    expect(report.isLegacy).toBe(false);
  });

  test("inset:0 (shorthand, tailwind, longhand) all fill the viewport-sized root", async ({ page }) => {
    await gotoCompat(page, "off");
    const expected = { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height };
    for (const id of ["inset-tailwind", "inset-inline", "inset-longhand"]) {
      const box = await page.locator(`[data-testid="${id}"]`).boundingBox();
      expectBoxEqual(box, expected, 1);
    }
  });

  test("aspect-video keeps a 16:9 ratio inside a 640px container", async ({ page }) => {
    await gotoCompat(page, "off");
    const box = await page.locator('[data-testid="aspect-video"]').boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    expect(box.width).toBeCloseTo(640, 0);
    // 640 * 9/16 = 360
    expect(box.height).toBeGreaterThanOrEqual(358);
    expect(box.height).toBeLessThanOrEqual(362);
  });

  test("fixed overlay covers the full viewport", async ({ page }) => {
    await gotoCompat(page, "off");
    const box = await page.locator('[data-testid="fixed-overlay"]').boundingBox();
    expectBoxEqual(box, { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height }, 1);
    await expect(page.getByTestId("fixed-overlay-label")).toBeVisible();
  });
});

test.describe("Player CSS primitives — legacy mode forced ON", () => {
  test.use({ viewport: VIEWPORT });

  test("compat layer tags the document and injects the shim stylesheet", async ({ page }) => {
    await gotoCompat(page, "on");
    const attr = await page.evaluate(() => document.documentElement.getAttribute("data-legacy-webview"));
    expect(attr).toBe("1");
    const hasStyle = await page.evaluate(() => Boolean(document.getElementById("legacy-webview-shim")));
    expect(hasStyle).toBe(true);
    const report = await page.evaluate(() => (window as any).__LEGACY_WEBVIEW__);
    expect(report.isLegacy).toBe(true);
    expect(report.reasons).toContain("manual=on");
  });

  test("Tailwind .inset-0 still fills the viewport under the shim", async ({ page }) => {
    await gotoCompat(page, "on");
    // This is the exact primitive that regressed on WebView 80 before the shim.
    const box = await page.locator('[data-testid="inset-tailwind"]').boundingBox();
    expectBoxEqual(box, { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height }, 1);
  });

  test("aspect-video is remapped to padding-bottom 56.25% (16:9)", async ({ page }) => {
    await gotoCompat(page, "on");
    const el = page.locator('[data-testid="aspect-video"]');
    // Shim uses padding-bottom hack rather than aspect-ratio.
    const paddingBottom = await el.evaluate((n) => getComputedStyle(n as HTMLElement).paddingBottom);
    // 640px container → 56.25% → 360px
    expect(paddingBottom).toMatch(/^360(\.\d+)?px$/);
    const box = await el.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    expect(box.height).toBeGreaterThanOrEqual(358);
    expect(box.height).toBeLessThanOrEqual(362);
  });

  test("fixed overlay is still full-viewport under the shim", async ({ page }) => {
    await gotoCompat(page, "on");
    const box = await page.locator('[data-testid="fixed-overlay"]').boundingBox();
    expectBoxEqual(box, { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height }, 1);
  });
});

test.describe("Compat override — URL param does not leak into localStorage", () => {
  test("?legacyCompat=on is not persisted", async ({ page }) => {
    await gotoCompat(page, "on");
    const persisted = await page.evaluate(() => localStorage.getItem("sf.legacyCompat"));
    expect(persisted).toBeNull();
  });
});
