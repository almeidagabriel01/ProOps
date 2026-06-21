/**
 * LANDING-CONTATO-01: /contato must be fully public.
 *
 * Bug: providers.tsx was missing /contato in isPublicMarketingPage, causing
 * the page to fall into the ProtectedRoute branch — showing the internal app
 * shell when logged in and redirecting to /login when logged out.
 *
 * These tests verify both the exact reported scenarios and their variants.
 */

import { test, expect } from "../fixtures/auth.fixture";

async function clearAuthState(page: import("@playwright/test").Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.evaluate(async () => {
    const dbs = (await indexedDB.databases?.()) ?? [];
    await Promise.all(
      dbs.map(
        (db) =>
          new Promise<void>((resolve) => {
            if (!db.name) return resolve();
            const req = indexedDB.deleteDatabase(db.name);
            req.onsuccess = req.onerror = req.onblocked = () => resolve();
          }),
      ),
    );
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
  });
}

test.describe("LANDING-CONTATO-01: /contato is fully public", () => {
  test("unauthenticated user can access /contato without redirect", async ({ page }) => {
    await clearAuthState(page);

    await page.goto("/contato");
    await page.waitForLoadState("networkidle");

    // Must stay on /contato — not redirected to /login
    await expect(page).toHaveURL(/\/contato/, { timeout: 10000 });

    // The public contact form rendered. Anchored on the email field (stable,
    // copy-independent) rather than heading text, which is part of the page's
    // marketing copy and changes with redesigns.
    await expect(page.locator('input[name="email"]')).toBeVisible();

    // ProtectedAppShell must NOT be mounted
    const dataShell = await page.evaluate(() => document.documentElement.dataset.shell);
    expect(dataShell).toBeUndefined();
  });

  test("unauthenticated user with query string stays on /contato", async ({ page }) => {
    await clearAuthState(page);

    await page.goto("/contato?utm_source=landing");
    await page.waitForLoadState("networkidle");

    // Must not redirect to /login?redirect=/contato
    await expect(page).toHaveURL(/\/contato/, { timeout: 10000 });
    expect(page.url()).not.toContain("/login");
  });

  test("authenticated user sees landing chrome on /contato, not app shell", async ({ authenticatedPage: page }) => {
    await page.goto("/contato");
    // Don't wait for networkidle — authenticated sessions on /contato still
    // load the root providers tree (including Firestore auth-state listeners
    // and other background queries) which never let the network go fully
    // idle. Wait for the public contact form's email field instead (stable,
    // copy-independent — the page's heading is marketing copy that changes).
    await page
      .locator('input[name="email"]')
      .waitFor({ state: "visible", timeout: 30000 });

    // Must stay on /contato
    await expect(page).toHaveURL(/\/contato/, { timeout: 10000 });

    // The public contact form rendered (not the app shell).
    await expect(page.locator('input[name="email"]')).toBeVisible();

    // ProtectedAppShell must NOT be mounted (data-shell is set only when shell is active)
    const dataShell = await page.evaluate(() => document.documentElement.dataset.shell);
    expect(dataShell).toBeUndefined();
  });
});
