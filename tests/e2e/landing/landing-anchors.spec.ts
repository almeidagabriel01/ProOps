/**
 * LANDING-ANCHORS-01: every in-page navbar/footer anchor must resolve to a
 * rendered section on the landing page.
 *
 * Bug: the navbar "Plataforma" link (and the footer "Plataforma" link) pointed
 * to `#showcase`, whose component (LandingShowcase) was never rendered in the
 * page tree — so clicking it resolved to nothing. The redesign attaches
 * `id="showcase"` to the Módulos section.
 *
 * These tests cover the exact reported scenario (`#showcase`) plus variants
 * (every other in-page anchor: `#modulos`, `#recursos`, `#pricing`). They fail
 * without the fix (target absent) and pass with it.
 */

import { test, expect } from "../fixtures/auth.fixture";

const ANCHOR_IDS = ["showcase", "modulos", "recursos", "pricing"] as const;

test.describe("LANDING-ANCHORS-01: navbar/footer anchors resolve", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Sections are SSR-rendered client components; the ids exist on first paint.
    await page.locator("#modulos").first().waitFor({ state: "attached", timeout: 15000 });
  });

  for (const id of ANCHOR_IDS) {
    test(`#${id} target is present in the DOM`, async ({ page }) => {
      await expect(page.locator(`#${id}`)).toBeAttached();
    });
  }

  test("real section targets are visible (recursos, pricing)", async ({ page }) => {
    // #showcase and #modulos are lightweight scroll anchors (the dedicated
    // Módulos section was removed) — they only need to resolve, not be visible.
    for (const id of ["recursos", "pricing"]) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
  });

  test("no in-page anchor points to a missing target", async ({ page }) => {
    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href^="#"]'))
        .map((a) => a.getAttribute("href"))
        .filter((h): h is string => !!h && h.length > 1),
    );

    expect(hrefs.length).toBeGreaterThan(0);

    for (const href of hrefs) {
      const resolved = await page.evaluate((h) => !!document.querySelector(h), href);
      expect(resolved, `anchor ${href} must resolve to a rendered element`).toBe(true);
    }
  });
});
