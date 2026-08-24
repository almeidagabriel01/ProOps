/**
 * LANDING-ANCHOR-SCROLL-01: clicking an in-page navbar anchor must actually
 * scroll the landing page to that section.
 *
 * Bug: the landing runs Lenis (smooth scroll), which owns the document scroll
 * and re-applies its own position on every rAF. `scrollToAnchor` used
 * `window.scrollTo({ behavior: "smooth" })`, which Lenis undid in the same
 * frame — clicking "Planos" (and the Recursos/Módulos/Plataforma links, and
 * the feature-scroll step buttons) left the page exactly where it was.
 *
 * The fix routes programmatic landing scrolls through the live Lenis instance,
 * keeping `window.scrollTo` as the fallback for when Lenis does not exist.
 *
 * Covered here: the exact reported scenario (navbar "Planos") plus the
 * variants that exercise the same code path — every other navbar anchor, and
 * the reduced-motion case where Lenis is never created and the native fallback
 * has to carry the scroll.
 */

import { test, expect } from "../fixtures/auth.fixture";
import type { Page } from "@playwright/test";

const NAV_ANCHORS = [
  { label: "Planos", id: "pricing" },
  { label: "Recursos", id: "recursos" },
  { label: "Módulos", id: "modulos" },
  { label: "Plataforma", id: "showcase" },
] as const;

/** Distance in px the target's top may sit from the viewport top after the scroll. */
const LANDED_TOLERANCE = 200;

async function gotoLanding(page: Page) {
  await page.goto("/");
  await page.locator("#pricing").waitFor({ state: "attached", timeout: 20000 });
}

/**
 * The navbar pill fades in (and only becomes clickable) once the page is
 * scrolled past the hero, so every anchor click needs a real scroll first.
 * `mouse.wheel` is used because Lenis consumes wheel events — a programmatic
 * `window.scrollTo` here would hit the very bug under test.
 */
async function revealNavbar(page: Page) {
  await page.mouse.wheel(0, 900);
  await page.waitForFunction(() => window.scrollY > 200, undefined, {
    timeout: 10000,
  });
}

async function expectScrolledTo(page: Page, id: string) {
  await page.waitForFunction(
    ({ anchorId, tolerance }) => {
      const target = document.querySelector(`#${anchorId}`);
      if (!target) return false;
      return Math.abs(target.getBoundingClientRect().top) <= tolerance;
    },
    { anchorId: id, tolerance: LANDED_TOLERANCE },
    { timeout: 15000 },
  );
}

test.describe("LANDING-ANCHOR-SCROLL-01: navbar anchors scroll the page", () => {
  test("clicking 'Planos' scrolls to the pricing section (reported scenario)", async ({
    page,
  }) => {
    await gotoLanding(page);
    // Lenis boots after first paint (requestIdleCallback) and stamps `lenis` on
    // <html>. Waiting for it guarantees the regression's conditions are present.
    await page.waitForFunction(
      () => document.documentElement.classList.contains("lenis"),
      undefined,
      { timeout: 20000 },
    );

    await revealNavbar(page);
    const scrollBefore = await page.evaluate(() => window.scrollY);

    await page.getByRole("link", { name: "Planos", exact: true }).first().click();

    await expectScrolledTo(page, "pricing");
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore);
  });

  for (const { label, id } of NAV_ANCHORS) {
    test(`clicking '${label}' scrolls to #${id}`, async ({ page }) => {
      await gotoLanding(page);
      await revealNavbar(page);

      await page.getByRole("link", { name: label, exact: true }).first().click();

      await expectScrolledTo(page, id);
    });
  }

  test("anchors still scroll under prefers-reduced-motion (Lenis disabled)", async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    try {
      await gotoLanding(page);
      // Lenis is intentionally never created in this mode — the native
      // window.scrollTo fallback has to do the work.
      expect(
        await page.evaluate(() =>
          document.documentElement.classList.contains("lenis"),
        ),
      ).toBe(false);

      await revealNavbar(page);
      await page.getByRole("link", { name: "Planos", exact: true }).first().click();

      await expectScrolledTo(page, "pricing");
    } finally {
      await context.close();
    }
  });
});
