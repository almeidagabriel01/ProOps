import { test, expect, type Page } from "@playwright/test";

/**
 * NAV-BF: Browser back/forward white-screen regression lock.
 *
 * Bug: a back/forward navigation restores a CACHED render in which Framer Motion
 * entrance animations (`initial:{opacity:0 / translate}`) never re-fire, leaving
 * the content present in the DOM but visually invisible — a blank white page
 * that only a manual reload fixed.
 *
 * Fix: a document-level `pageshow` listener (inline script in app/layout.tsx)
 * reloads the page on any back/forward restore, signalled by either
 * `event.persisted` (bfcache) or `PerformanceNavigationTiming.type ===
 * "back_forward"`. After that reload the navigation type is "reload" and the
 * entrance animations play normally.
 *
 * This test asserts BOTH:
 *   1. the recovery fired — after a back/forward the navigation type is "reload"
 *      (if the listener is removed it stays "back_forward" and this fails); and
 *   2. the outcome — the page is actually visible (content is not stuck at
 *      opacity:0).
 *
 * Runs on public pages only — no auth/session needed.
 */

async function navigationType(page: Page): Promise<string> {
  try {
    return await page.evaluate(() => {
      const e = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      return e?.type ?? "navigate";
    });
  } catch {
    // The recovery reload is in flight — the execution context was destroyed
    // mid-navigation. Return a sentinel so expect.poll keeps retrying until the
    // reload settles and the type stabilises to "reload".
    return "navigating";
  }
}

/** Fraction of <main> descendants rendered at ~opacity:0 (white-screen signal). */
async function hiddenRatio(page: Page): Promise<number> {
  return page.evaluate(() => {
    const scope = document.querySelector("main") || document.body;
    const els = Array.from(scope.querySelectorAll("*")).slice(0, 250);
    let zero = 0;
    let total = 0;
    for (const el of els) {
      const o = parseFloat(getComputedStyle(el).opacity);
      if (!Number.isNaN(o)) {
        total++;
        if (o < 0.05) zero++;
      }
    }
    return total ? zero / total : 0;
  });
}

const PAIRS: Array<[string, string]> = [
  ["/", "/contato"],
  ["/contato", "/agendar"],
];

test.describe("NAV-BF: browser back/forward recovers (no white screen)", () => {
  for (const [a, b] of PAIRS) {
    test(`back/forward between ${a} and ${b} auto-recovers and renders`, async ({
      page,
    }) => {
      await page.goto(a, { waitUntil: "load" });
      await page.goto(b, { waitUntil: "load" });

      // BACK → a: the recovery script turns the back/forward restore into a
      // fresh reload (navType "reload"), then content renders visibly.
      await page.goBack();
      await expect
        .poll(() => navigationType(page), { timeout: 15000 })
        .toBe("reload");
      await page.waitForTimeout(1500);
      expect(await hiddenRatio(page)).toBeLessThan(0.5);

      // FORWARD → b: same guarantee in the other direction.
      await page.goForward();
      await expect
        .poll(() => navigationType(page), { timeout: 15000 })
        .toBe("reload");
      await page.waitForTimeout(1500);
      expect(await hiddenRatio(page)).toBeLessThan(0.5);
    });
  }
});
