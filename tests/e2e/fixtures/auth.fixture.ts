import type { Browser, Page } from "@playwright/test";
import { test as base, expect } from "./base.fixture";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { USER_ADMIN_ALPHA, USER_ADMIN_BETA } from "../seed/data/users";
import * as admin from "firebase-admin";

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

// We set the __session cookie server-side by navigating to the dev-only
// `/api/auth/dev-session` route with a valid idToken. That route issues the
// HttpOnly cookie via Set-Cookie and redirects to the requested page, ensuring
// the SSR middleware sees the cookie on the very first request.

async function createAuthenticatedPage(
  browser: Browser,
  email: string,
  password: string,
): Promise<Page> {
  // Create a new browser context and set the __session cookie server-side
  // so it will be present on the very first navigation (SSR request).
  const context = await browser.newContext();

  // Sign in to the Auth emulator to obtain an idToken
  const { idToken } = await signInWithEmailPassword(email, password);

  // Create a new page and navigate to the dev-only server endpoint that
  // sets the __session cookie server-side and redirects to the requested page.
  const page = await context.newPage();
  await interceptFirebaseRequests(page);

    // Navigate to root so page.evaluate has a same-origin context to call POST /api/auth/session
    await page.goto("http://localhost:3001/", { waitUntil: "networkidle" });

    // Request server to create session cookie via POST /api/auth/session using the idToken.
    const createSessionResult = await page.evaluate(async (token) => {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken: token }),
      });
      return { status: res.status, ok: res.ok, text: await res.text() };
    }, idToken);

    // eslint-disable-next-line no-console
    console.log('[auth.fixture] createSessionResult ->', createSessionResult);

    // Log cookies present in the browser context after the POST
    try {
      // eslint-disable-next-line no-console
      console.log('[auth.fixture] context.cookies ->', await context.cookies());
    } catch (e) {
      // ignore
    }

    // Now navigate to the protected page; SSR should see the cookie set by the previous POST.
    // As a diagnostic step, call a debug endpoint that echoes the server's
    // received Cookie header to verify whether the browser sent __session.
    const debugCookie = await page.evaluate(async () => {
      const res = await fetch('/api/debug/cookie', { credentials: 'include' });
      try {
        return await res.json();
      } catch (e) {
        return { error: String(e) };
      }
    });
    // eslint-disable-next-line no-console
    console.log('[auth.fixture] debugCookie ->', debugCookie);

    await page.goto('http://localhost:3001/transactions', { waitUntil: 'networkidle' });

  // Debug: log the current page URL so test runs surface navigation status.
  // eslint-disable-next-line no-console
    console.log('[auth.fixture] page.url after goto ->', page.url());

  return page;
}

/**
 * Auth fixture that provides pre-authenticated browser contexts.
 * Uses LoginPage to log in seeded users before handing the page to tests.
 */
export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ browser }, provide) => {
    const page = await createAuthenticatedPage(
      browser,
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    await page.waitForURL(/\/transactions/, { timeout: 30000 });

    await provide(page);
    await page.context().close();
  },

  authenticatedAsBeta: async ({ browser }, provide) => {
    const page = await createAuthenticatedPage(
      browser,
      USER_ADMIN_BETA.email,
      USER_ADMIN_BETA.password,
    );

    await page.waitForURL(/\/transactions/, { timeout: 30000 });

    await provide(page);
    await page.context().close();
  },
});

export { expect };
