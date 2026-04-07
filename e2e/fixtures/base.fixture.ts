import { test as base } from "@playwright/test";
import { LoginPage } from "../pages/login.page";
import { DashboardPage } from "../pages/dashboard.page";
import { ProposalsPage } from "../pages/proposals.page";
import { TransactionsPage } from "../pages/transactions.page";

interface PageFixtures {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  proposalsPage: ProposalsPage;
  transactionsPage: TransactionsPage;
}

// Proxy Firebase API calls to local emulators.
// This works regardless of which Firebase project/API key is baked into the
// client bundle via .env.local — the network request is intercepted before
// it reaches Google's servers.
async function setupEmulatorRoutes(page: import("@playwright/test").Page) {
  // Auth: identitytoolkit + securetoken both route through the Auth emulator
  await page.route("https://identitytoolkit.googleapis.com/**", async (route) => {
    const url = route.request().url().replace(
      "https://identitytoolkit.googleapis.com",
      "http://127.0.0.1:9099/identitytoolkit.googleapis.com",
    );
    const resp = await fetch(url, {
      method: route.request().method(),
      headers: route.request().headers(),
      body: route.request().postDataBuffer()?.toString() ?? undefined,
    });
    await route.fulfill({
      status: resp.status,
      headers: Object.fromEntries(resp.headers.entries()),
      body: Buffer.from(await resp.arrayBuffer()),
    });
  });

  await page.route("https://securetoken.googleapis.com/**", async (route) => {
    const url = route.request().url().replace(
      "https://securetoken.googleapis.com",
      "http://127.0.0.1:9099/securetoken.googleapis.com",
    );
    const resp = await fetch(url, {
      method: route.request().method(),
      headers: route.request().headers(),
      body: route.request().postDataBuffer()?.toString() ?? undefined,
    });
    await route.fulfill({
      status: resp.status,
      headers: Object.fromEntries(resp.headers.entries()),
      body: Buffer.from(await resp.arrayBuffer()),
    });
  });

  // Firestore REST API (used by getDoc / getDocs one-time reads)
  await page.route("https://firestore.googleapis.com/**", async (route) => {
    const url = route.request().url().replace(
      "https://firestore.googleapis.com",
      "http://127.0.0.1:8080",
    );
    const resp = await fetch(url, {
      method: route.request().method(),
      headers: route.request().headers(),
      body: route.request().postDataBuffer()?.toString() ?? undefined,
    });
    await route.fulfill({
      status: resp.status,
      headers: Object.fromEntries(resp.headers.entries()),
      body: Buffer.from(await resp.arrayBuffer()),
    });
  });
}

/**
 * Base test fixture providing typed Page Object Model instances.
 * Extend this for all e2e tests to get automatic POM instances.
 */
export const test = base.extend<PageFixtures>({
  page: async ({ page }, use) => {
    await setupEmulatorRoutes(page);
    await use(page);
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  proposalsPage: async ({ page }, use) => {
    await use(new ProposalsPage(page));
  },
  transactionsPage: async ({ page }, use) => {
    await use(new TransactionsPage(page));
  },
});

export { expect } from "@playwright/test";
