/**
 * E2E tests for AI plan limit scenarios: AI-06, AI-07, AI-08.
 *
 * AI-06: At-limit pro tenant gets 429 AI_LIMIT_EXCEEDED from POST /v1/ai/chat.
 * AI-07: 429 response body contains messagesUsed, messagesLimit, and resetAt.
 * AI-08: At-limit tenant sees disabled input with correct placeholder, badge text,
 *         and reset date in tooltip.
 *
 * Architecture notes:
 * - AI-06 and AI-07 are pure API tests (no browser).
 * - AI-08 is a UI test using the base fixture for emulator routing.
 * - Uses tenant "ai-test" (pro plan, 400 message limit) via USER_AI_ADMIN.
 * - beforeEach seeds aiUsage to 400 (pro limit); afterEach clears it.
 * - test.describe.configure({ mode: "serial" }) prevents Firestore state collisions.
 */

import { test, expect } from "@playwright/test";
import { test as uiTest } from "../fixtures/base.fixture";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { getTestDb } from "../helpers/admin-firestore";
import { USER_AI_ADMIN, seedAiUsage, clearAiUsage } from "../seed/data/ai";
import { LoginPage } from "../pages/login.page";
import { LiaPage } from "../pages/lia.page";

const FUNCTIONS_BASE =
  "http://127.0.0.1:5001/demo-proops-test/southamerica-east1/api";

// ─── AI-06: Plan limit enforcement at message cap ────────────────────────────

test.describe("AI-06: Plan limit enforcement at message cap", () => {
  test.describe.configure({ mode: "serial" });

  const db = getTestDb();

  test.beforeEach(async () => {
    await seedAiUsage(db, "ai-test", 400);
  });

  test.afterEach(async () => {
    await clearAiUsage(db, "ai-test");
  });

  test("at-limit pro tenant gets 429 AI_LIMIT_EXCEEDED", async () => {
    const { idToken } = await signInWithEmailPassword(
      USER_AI_ADMIN.email,
      USER_AI_ADMIN.password,
    );

    const response = await fetch(`${FUNCTIONS_BASE}/v1/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        message: "Hello",
        sessionId: "test-session-limit",
      }),
    });

    expect(response.status).toBe(429);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.code).toBe("AI_LIMIT_EXCEEDED");
  });
});

// ─── AI-07: Limit response includes correct metadata ─────────────────────────

test.describe("AI-07: Limit response includes correct metadata", () => {
  test.describe.configure({ mode: "serial" });

  const db = getTestDb();

  test.beforeEach(async () => {
    await seedAiUsage(db, "ai-test", 400);
  });

  test.afterEach(async () => {
    await clearAiUsage(db, "ai-test");
  });

  test("429 response contains messagesUsed, messagesLimit, and resetAt", async () => {
    const { idToken } = await signInWithEmailPassword(
      USER_AI_ADMIN.email,
      USER_AI_ADMIN.password,
    );

    const response = await fetch(`${FUNCTIONS_BASE}/v1/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        message: "Hello",
        sessionId: "test-session-meta",
      }),
    });

    expect(response.status).toBe(429);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.code).toBe("AI_LIMIT_EXCEEDED");
    expect(body.messagesUsed).toBe(400);
    expect(body.messagesLimit).toBe(400);
    expect(body.resetAt).toBeDefined();
    // resetAt must be an ISO date string pointing to the future (1st of next month)
    expect(typeof body.resetAt).toBe("string");
    expect(new Date(body.resetAt as string).getTime()).toBeGreaterThan(
      Date.now(),
    );
  });
});

// ─── AI-08: At-limit disabled input with reset date ──────────────────────────

uiTest.describe("AI-08: At-limit disabled input with reset date", () => {
  const db = getTestDb();

  uiTest.beforeEach(async () => {
    // Seed ai-test tenant to exactly at pro limit (400 messages used)
    await seedAiUsage(db, "ai-test", 400);
  });

  uiTest.afterEach(async () => {
    await clearAiUsage(db, "ai-test");
  });

  uiTest(
    "at-limit tenant sees disabled input with correct placeholder",
    async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(USER_AI_ADMIN.email, USER_AI_ADMIN.password);
      await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, {
        timeout: 30000,
      });

      const lia = new LiaPage(page);
      await lia.openPanel();

      // Input should be disabled when at limit
      await expect(lia.messageInput).toBeDisabled({ timeout: 10000 });

      // Placeholder should show the limit reached message
      const placeholder = await lia.getInputPlaceholder();
      expect(placeholder).toBe("Limite de mensagens atingido.");
    },
  );

  uiTest(
    "at-limit badge shows 400 de 400 mensagens usadas",
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
      expect(badgeText).toBe("400 de 400 mensagens usadas");
    },
  );

  uiTest(
    "send button tooltip shows reset date when at limit",
    async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(USER_AI_ADMIN.email, USER_AI_ADMIN.password);
      await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, {
        timeout: 30000,
      });

      const lia = new LiaPage(page);
      await lia.openPanel();

      // Aguarda o botão aparecer e estabilizar sem depender de networkidle
      const sendButton = page.getByRole("button", { name: "Enviar mensagem" });
      await sendButton.waitFor({ state: "attached", timeout: 10000 });
      await page.waitForTimeout(500); // aguarda re-render do uso

      // Re-localiza após estabilização para evitar detach
      await page
        .getByRole("button", { name: "Enviar mensagem" })
        .hover({ force: true });

      // Tooltip deve aparecer
      const tooltip = page.getByRole("tooltip");
      await expect(tooltip).toBeVisible({ timeout: 5000 });
      await expect(tooltip).toContainText("Renova em");
    },
  );
});
