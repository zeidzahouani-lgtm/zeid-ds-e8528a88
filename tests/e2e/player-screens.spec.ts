import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Regression: every screen registered in the database must load on both
 * `/player/:slug` and `/:slug` without showing "Écran introuvable".
 *
 * The route uses only publicly whitelisted anon columns via the
 * `resolve_player_screen` RPC — a failure here means a security hardening
 * pass broke the anonymous player surface again.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "https://dovvbtzpawheafcqmdbt.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvdnZidHpwYXdoZWFmY3FtZGJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MTcwODIsImV4cCI6MjA4ODM5MzA4Mn0.DFVxt9nsRfKxH9aMB7TkJAQwzC10k7hOK5wsSuLM88Y";

type ScreenRow = { id: string; name: string; slug: string | null };

async function fetchAllScreens(): Promise<ScreenRow[]> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  // Anon has whitelisted SELECT on these columns.
  const { data, error } = await supabase.from("screens").select("id, name, slug");
  if (error) throw new Error(`Unable to list screens for the test: ${error.message}`);
  return (data ?? []).filter((s): s is ScreenRow => Boolean(s.id));
}

test.describe("Player — every screen loads without 'Écran introuvable'", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  let screens: ScreenRow[] = [];

  test.beforeAll(async () => {
    screens = await fetchAllScreens();
    expect(screens.length, "at least one screen must exist to run the suite").toBeGreaterThan(0);
  });

  test("resolves every screen slug (and id fallback) on /player/:key and /:key", async ({ page }) => {
    test.setTimeout(5 * 60_000);
    const failures: string[] = [];

    for (const screen of screens) {
      const keys = [screen.slug, screen.id].filter(Boolean) as string[];
      for (const key of keys) {
        for (const path of [`/player/${key}`, `/${key}`]) {
          await page.goto(path, { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(800);
          const body = (await page.locator("body").innerText()).toLowerCase();
          if (body.includes("écran introuvable") || body.includes("ecran introuvable")) {
            failures.push(`${path} → "Écran introuvable" (screen=${screen.name})`);
          }
        }
      }
    }

    expect(failures, `screens that failed to resolve:\n${failures.join("\n")}`).toEqual([]);
  });
});
