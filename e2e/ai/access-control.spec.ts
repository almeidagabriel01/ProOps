/**
 * AI access control E2E tests (AI-01, AI-02, AI-03).
 *
 * AI-01: Free tier access is blocked — API returns 403 AI_FREE_TIER_BLOCKED for free tenant,
 *        and users with role="free" do not see the Lia trigger button in the UI.
 * AI-02: Starter tenant sees usage badge "0 de 80 mensagens usadas" after opening the panel.
 * AI-03: Pro tenant sees usage badge "0 de 400 mensagens usadas" after opening the panel.
 *
 * Architecture notes:
 * - API tests use plain `test` from @playwright/test (no browser page needed).
 * - UI tests use `test as uiTest` from base.fixture, which wires emulator routes.
 * - test.describe.configure({ mode: "serial" }) enforces sequential execution.
 * - USER_AI_FREE (role="admin") is used for the API 403 test — free TENANT plan gating.
 * - USER_AI_FREE_ROLE (role="free") is used for the UI trigger-hidden test — role gating.
 *   protected-app-shell.tsx gates: user.role !== "free" && planTier !== undefined.
 */

import { test, expect } from "@playwright/test";
import { test as uiTest } from "../fixtures/base.fixture";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import {
  USER_AI_FREE,
  USER_AI_FREE_ROLE,
  USER_AI_ADMIN,
  USER_AI_STARTER,
} from "../seed/data/ai";
import { LoginPage } from "../pages/login.page";
import { LiaPage } from "../pages/lia.page";

const FUNCTIONS_BASE =
  "http://127.0.0.1:5001/demo-proops-test/southamerica-east1/api";

test.describe.configure({ mode: "serial" });

// ─── AI-01: Free tier access blocked ─────────────────────────────────────────

test.describe("AI-01: Free tier access blocked", () => {
  test("free tenant POST /v1/ai/chat returns 403 with AI_FREE_TIER_BLOCKED", async () => {
    const { idToken } = await signInWithEmailPassword(
      USER_AI_FREE.email,
      USER_AI_FREE.password,
    );
    const response = await fetch(`${FUNCTIONS_BASE}/v1/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ message: "Hello", sessionId: "test-session-free" }),
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.code).toBe("AI_FREE_TIER_BLOCKED");
  });
});

// ─── AI-01: Free tier trigger button hidden (UI) ──────────────────────────────

uiTest.describe("AI-01: Free tier trigger button hidden", () => {
  uiTest(
    "user with role=free does not see Lia trigger button",
    async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(USER_AI_FREE_ROLE.email, USER_AI_FREE_ROLE.password);
      // role=free users are redirected to "/" (landing page), not to dashboard routes
      await page.waitForURL("/", { timeout: 30000 });

      // Wait for page to be fully loaded (auth context + plan limits resolved)
      await page.waitForTimeout(2000);

      // USER_AI_FREE_ROLE has role="free" in custom claims.
      // protected-app-shell.tsx gate: user.role !== "free" → LiaContainer is NOT rendered.
      // This assertion is definitive — no conditional branches.
      await expect(page.getByRole("button", { name: "Abrir Lia" })).not.toBeVisible();
    },
  );
});

// ─── AI-02: Starter badge shows 80-message limit ─────────────────────────────

uiTest.describe("AI-02: Starter badge shows 80-message limit", () => {
  uiTest(
    "starter tenant badge displays '0 de 80 mensagens usadas'",
    async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(USER_AI_STARTER.email, USER_AI_STARTER.password);
      await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, {
        timeout: 30000,
      });

      const lia = new LiaPage(page);
      // Open Lia panel to make badge visible
      await lia.openPanel();

      // Badge should show starter limit (80 messages)
      const badgeText = await lia.getBadgeText();
      expect(badgeText).toBe("0 de 80 mensagens usadas");
    },
  );
});

// ─── AI-03: Pro badge shows 400-message limit ─────────────────────────────────

uiTest.describe("AI-03: Pro badge shows 400-message limit", () => {
  uiTest(
    "pro tenant badge displays '0 de 400 mensagens usadas'",
    async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(USER_AI_ADMIN.email, USER_AI_ADMIN.password);
      await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, {
        timeout: 30000,
      });

      const lia = new LiaPage(page);
      await lia.openPanel();

      const badgeText = await lia.getBadgeText();
      expect(badgeText).toBe("0 de 400 mensagens usadas");
    },
  );
});
