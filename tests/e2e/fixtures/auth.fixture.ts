import type { Page } from "@playwright/test";
import { test as base, expect } from "./base.fixture";
import { LoginPage } from "../pages/login.page";
import { USER_ADMIN_ALPHA, USER_ADMIN_BETA } from "../seed/data/users";

interface AuthFixtures {
  /** Pre-authenticated page as tenant-alpha admin (admin@alpha.test) */
  authenticatedPage: Page;
  /** Pre-authenticated page as tenant-beta admin (admin@beta.test) */
  authenticatedAsBeta: Page;
}

// Override fetch AND XHR in the browser before any SDK code runs.
// Needed because .env.local bakes real Firebase credentials into the client
// bundle; Firebase SDK would otherwise talk to Google's production servers.
async function interceptFirebaseRequests(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Override fetch
    const _fetch = window.fetch;
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      const rewritten = url
        .replace("https://identitytoolkit.googleapis.com", "http://127.0.0.1:9099/identitytoolkit.googleapis.com")
        .replace("https://securetoken.googleapis.com", "http://127.0.0.1:9099/securetoken.googleapis.com")
        .replace("https://firestore.googleapis.com", "http://127.0.0.1:8080");
      if (rewritten !== url) {
        return _fetch(rewritten, init);
      }
      return _fetch(input, init);
    } as typeof fetch;

    // Override XHR (Firebase SDK may use XHR for some requests)
    const _open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: unknown[]) {
      const urlStr = url.toString()
        .replace("https://identitytoolkit.googleapis.com", "http://127.0.0.1:9099/identitytoolkit.googleapis.com")
        .replace("https://securetoken.googleapis.com", "http://127.0.0.1:9099/securetoken.googleapis.com")
        .replace("https://firestore.googleapis.com", "http://127.0.0.1:8080");
      return (_open as (this: XMLHttpRequest, method: string, url: string | URL, ...args: unknown[]) => void).call(this, method, urlStr, ...rest);
    };
  });
}

/**
 * Auth fixture that provides pre-authenticated browser contexts.
 * Uses LoginPage to log in seeded users before handing the page to tests.
 */
export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, provide) => {
    await interceptFirebaseRequests(page);

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_ADMIN_ALPHA.email, USER_ADMIN_ALPHA.password);

    // Wait for redirect to an authenticated route (dashboard or any main route)
    await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, { timeout: 30000 });

    await provide(page);
  },

  authenticatedAsBeta: async ({ page }, provide) => {
    await interceptFirebaseRequests(page);

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_ADMIN_BETA.email, USER_ADMIN_BETA.password);

    // Wait for redirect to an authenticated route
    await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, { timeout: 30000 });

    await provide(page);
  },
});

export { expect };
