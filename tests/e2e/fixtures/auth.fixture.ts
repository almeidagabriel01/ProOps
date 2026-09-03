import type { Page } from "@playwright/test";
import { test as base, expect } from "./base.fixture";
import { LoginPage } from "../pages/login.page";
import { USER_ADMIN_ALPHA, USER_ADMIN_BETA } from "../seed/data/users";
import {
  PERMS_MEMBER_OPERADOR,
  PERMS_MEMBER_RESTRITO,
  type SeedPermissionUser,
} from "../seed/data/permissions";
import {
  PLAN_ENTERPRISE,
  PLAN_PASSWORD,
  PLAN_PRO,
  PLAN_STARTER,
  PLAN_STARTER_ADDON,
  type SeedPlanTenant,
} from "../seed/data/plans";

interface AuthFixtures {
  /** Pre-authenticated page as tenant-alpha admin (admin@alpha.test) */
  authenticatedPage: Page;
  /** Pre-authenticated page as tenant-beta admin (admin@beta.test) */
  authenticatedAsBeta: Page;
  /**
   * MEMBRO com apenas `proposals.canView` — o caso mais restrito que ainda
   * entra no ERP. Nenhuma fixture de membro existia antes: os seeds de membro
   * estavam lá, mas nenhum teste de UI rodava como um.
   */
  memberRestrito: Page;
  /**
   * MEMBRO operacional do financeiro: propostas e lançamentos com escrita,
   * carteira e CRM só leitura, sem notas fiscais.
   */
  memberOperador: Page;
  /** MASTER de um tenant Starter — nenhum módulo premium nativo. */
  planStarter: Page;
  /** MASTER de um tenant Pro — financeiro sim, CRM e fiscal não. */
  planPro: Page;
  /** MASTER de um tenant Enterprise — tudo. */
  planEnterprise: Page;
  /** MASTER Starter que COMPROU o add-on financeiro. */
  planStarterComAddon: Page;
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
/**
 * A home de um membro depende das permissões dele (`resolveUserHome`): quem
 * não tem `dashboard.canView` cai na primeira página permitida. Por isso a
 * espera não pode ser por `/dashboard` — o padrão das fixtures de admin não
 * serve aqui.
 */
async function loginAsMember(
  page: Page,
  user: SeedPermissionUser,
): Promise<void> {
  await interceptFirebaseRequests(page);

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(user.email, user.password);

  await page.waitForURL(
    /(dashboard|proposals|transactions|contacts|products|services|spreadsheets|crm|wallets|profile)/,
    { timeout: 30000 },
  );
}

/** MASTER de um tenant de plano: a home é sempre /dashboard (tem tudo liberado por role). */
async function loginAsPlanMaster(
  page: Page,
  seed: SeedPlanTenant,
): Promise<void> {
  await interceptFirebaseRequests(page);

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(seed.email, PLAN_PASSWORD);

  await page.waitForURL(/(dashboard|proposals)/, { timeout: 30000 });
}

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

  memberRestrito: async ({ page }, provide) => {
    await loginAsMember(page, PERMS_MEMBER_RESTRITO);
    await provide(page);
  },

  memberOperador: async ({ page }, provide) => {
    await loginAsMember(page, PERMS_MEMBER_OPERADOR);
    await provide(page);
  },

  planStarter: async ({ page }, provide) => {
    await loginAsPlanMaster(page, PLAN_STARTER);
    await provide(page);
  },

  planPro: async ({ page }, provide) => {
    await loginAsPlanMaster(page, PLAN_PRO);
    await provide(page);
  },

  planEnterprise: async ({ page }, provide) => {
    await loginAsPlanMaster(page, PLAN_ENTERPRISE);
    await provide(page);
  },

  planStarterComAddon: async ({ page }, provide) => {
    await loginAsPlanMaster(page, PLAN_STARTER_ADDON);
    await provide(page);
  },
});

export { expect };
