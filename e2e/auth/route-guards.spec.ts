import { test, expect } from "../fixtures/base.fixture";

/**
 * AUTH-05: Route guard tests — unauthenticated redirect.
 *
 * These tests verify that the Next.js middleware redirects unauthenticated
 * users to /login with redirect and redirect_reason query params
 * (middleware.ts lines 117-120: loginUrl.searchParams.set).
 *
 * All tests deliberately run WITHOUT any auth cookies.
 */

test.describe("AUTH-05: Route guards — unauthenticated redirect", () => {
  test.beforeEach(async ({ context }) => {
    // Clear both the primary session cookie and the legacy auth hint cookie
    // so the middleware sees a fully unauthenticated request.
    await context.clearCookies();
  });

  test("navigating to /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("navigating to /proposals redirects to /login", async ({ page }) => {
    await page.goto("/proposals");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("navigating to /transactions redirects to /login", async ({ page }) => {
    await page.goto("/transactions");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("redirect URL includes the original path as 'redirect' query param", async ({ page }) => {
    // [DIAGNOSTIC — remove in Task 2 if root cause confirmed]
    const navLog: string[] = [];
    const respLog: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navLog.push(`NAV ${frame.url()}`);
    });
    page.on("response", (resp) => {
      const loc = resp.headers()["location"];
      if (resp.status() >= 300 && resp.status() < 400) {
        respLog.push(`REDIR ${resp.status()} ${resp.url()} -> ${loc ?? "(none)"}`);
      }
    });

    await page.goto("/dashboard");
    console.log("DIAG-AFTER-GOTO url=", page.url());

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    console.log("DIAG-AFTER-MATCH url=", page.url());

    // Wait briefly to capture any post-match bounce
    await page.waitForTimeout(2000);
    console.log("DIAG-AFTER-WAIT url=", page.url());

    // Inspect IndexedDB for Firebase persisted user
    const idbUser = await page.evaluate(async () => {
      try {
        const dbs = await indexedDB.databases?.();
        return JSON.stringify(dbs ?? "indexedDB.databases() unavailable");
      } catch (e) {
        return `ERR ${(e as Error).message}`;
      }
    });
    console.log("DIAG-IDB-DBS=", idbUser);

    console.log("DIAG-NAV-CHAIN:\n" + navLog.join("\n"));
    console.log("DIAG-REDIR-CHAIN:\n" + respLog.join("\n"));

    // The Next.js middleware sets redirect=<path> in the 307 Location header.
    // Playwright follows the redirect and the final URL should include the param.
    expect(new URL(page.url()).searchParams.get("redirect")).toBe("/dashboard");
  });

  test("redirect URL includes 'redirect_reason=session_expired' query param", async ({ page }) => {
    // [DIAGNOSTIC — remove in Task 2 if root cause confirmed]
    const navLog: string[] = [];
    const respLog: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navLog.push(`NAV ${frame.url()}`);
    });
    page.on("response", (resp) => {
      const loc = resp.headers()["location"];
      if (resp.status() >= 300 && resp.status() < 400) {
        respLog.push(`REDIR ${resp.status()} ${resp.url()} -> ${loc ?? "(none)"}`);
      }
    });

    await page.goto("/proposals");
    console.log("DIAG-AFTER-GOTO url=", page.url());

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    console.log("DIAG-AFTER-MATCH url=", page.url());

    // Wait briefly to capture any post-match bounce
    await page.waitForTimeout(2000);
    console.log("DIAG-AFTER-WAIT url=", page.url());

    // Inspect IndexedDB for Firebase persisted user
    const idbUser = await page.evaluate(async () => {
      try {
        const dbs = await indexedDB.databases?.();
        return JSON.stringify(dbs ?? "indexedDB.databases() unavailable");
      } catch (e) {
        return `ERR ${(e as Error).message}`;
      }
    });
    console.log("DIAG-IDB-DBS=", idbUser);

    console.log("DIAG-NAV-CHAIN:\n" + navLog.join("\n"));
    console.log("DIAG-REDIR-CHAIN:\n" + respLog.join("\n"));

    // The Next.js middleware sets redirect_reason=session_expired (middleware.ts line 119).
    expect(new URL(page.url()).searchParams.get("redirect_reason")).toBe(
      "session_expired",
    );
  });
});
