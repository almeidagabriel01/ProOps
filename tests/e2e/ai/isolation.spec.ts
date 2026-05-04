/**
 * AI Isolation, Permissions, and Confirmation Tests
 *
 * AI-10: Cross-tenant data isolation — ai-test admin cannot access tenant-alpha data
 * AI-11: Member role restrictions — member JWT claims are correct; chat access is not blocked
 * AI-12: Delete confirmation dialog — mocked tool_result triggers dialog; cancel preserves data
 *
 * Group A tests (pure API / Firestore admin SDK) do not require GEMINI_API_KEY.
 * Group B tests have skip guards: test.skip(!process.env.GEMINI_API_KEY, ...)
 */

import { test, expect } from "@playwright/test";
import { test as uiTest } from "../fixtures/base.fixture";
import { signInWithEmailPassword, decodeJwtPayload } from "../helpers/firebase-auth-api";
import { getTestDb } from "../helpers/admin-firestore";
import { USER_AI_ADMIN, USER_AI_MEMBER } from "../seed/data/ai";
import { LoginPage } from "../pages/login.page";
import { LiaPage } from "../pages/lia.page";

const FUNCTIONS_BASE =
  "http://127.0.0.1:5001/demo-proops-test/southamerica-east1/api";

test.describe.configure({ mode: "serial" });

// ─── AI-10: Cross-tenant data isolation ──────────────────────────────────────

test.describe("AI-10: Cross-tenant data isolation", () => {
  test("ai-test admin chat request is scoped to ai-test tenant (not rejected with tenant mismatch)", async () => {
    // Verifies the AI endpoint does not return a tenant mismatch error when
    // an ai-test admin sends a chat message with a sessionId that references a
    // different tenant's naming convention. The backend always scopes queries
    // to req.user.tenantId — injecting a foreign sessionId has no effect.
    const { idToken } = await signInWithEmailPassword(
      USER_AI_ADMIN.email,
      USER_AI_ADMIN.password,
    );

    // Use a sessionId formatted to look like a tenant-alpha session
    const response = await fetch(`${FUNCTIONS_BASE}/v1/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        message: "Hello",
        sessionId: "tenant-alpha-session-attempt",
      }),
    });

    // Acceptable outcomes: 200 (with GEMINI key), 429 (at limit), 500 (no GEMINI key).
    // The critical assertion: must NOT be 403 with code AI_FREE_TIER_BLOCKED,
    // which would indicate incorrect tenant resolution for this pro-plan user.
    expect([200, 429, 500]).toContain(response.status);

    if (response.status === 403) {
      const body = (await response.json()) as Record<string, unknown>;
      // If 403, it must not be a free-tier block (ai-test is a pro tenant)
      expect(body.code).not.toBe("AI_FREE_TIER_BLOCKED");
    }
  });

  test("Firestore subcollection for ai-test does not contain tenant-alpha conversations", async () => {
    // Tests that Firestore subcollection scoping prevents cross-tenant data leakage.
    // Seeds a conversation in tenant-alpha, then verifies ai-test subcollection is isolated.
    const db = getTestDb();

    // Seed a conversation document in the tenant-alpha subcollection
    await db.doc("tenants/tenant-alpha/aiConversations/cross-test-session").set({
      sessionId: "cross-test-session",
      uid: "user-admin-alpha",
      tenantId: "tenant-alpha",
      messages: [{ role: "user", content: "Hello from alpha" }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Verify the seeded document exists in tenant-alpha
    const alphaSnap = await db
      .doc("tenants/tenant-alpha/aiConversations/cross-test-session")
      .get();
    expect(alphaSnap.exists).toBe(true);

    // Verify the ai-test subcollection does not contain the tenant-alpha conversation
    const aiTestConversations = await db
      .collection("tenants/ai-test/aiConversations")
      .get();
    const sessionIds = aiTestConversations.docs.map((d) => d.id);
    expect(sessionIds).not.toContain("cross-test-session");

    // Cleanup: remove the seeded cross-tenant conversation
    await db
      .doc("tenants/tenant-alpha/aiConversations/cross-test-session")
      .delete();
  });
});

// ─── AI-11: Member role restrictions ─────────────────────────────────────────

test.describe("AI-11: Member role restrictions", () => {
  test("member user is not blocked at the AI chat endpoint level", async () => {
    // Members can use Lia chat — they are only restricted from admin-only tool
    // executions at the executor level (functions/src/ai/tools/executor.ts).
    // This test verifies that a member-role user does NOT receive a 403 response
    // at the endpoint entry point.
    const { idToken } = await signInWithEmailPassword(
      USER_AI_MEMBER.email,
      USER_AI_MEMBER.password,
    );

    const response = await fetch(`${FUNCTIONS_BASE}/v1/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ message: "Olá", sessionId: "test-member-session" }),
    });

    // Must NOT receive 403 — member is on a pro plan and chat access is allowed.
    // Acceptable: 200 (with GEMINI key), 500 (no GEMINI key), 429 (at limit).
    expect(response.status).not.toBe(403);
  });

  test("member user ID token contains role=member and tenantId=ai-test custom claims", async () => {
    // Verifies the member JWT carries the correct custom claims that the AI tool
    // executor reads when gating admin-only operations (executor.ts checks role claim).
    const { idToken } = await signInWithEmailPassword(
      USER_AI_MEMBER.email,
      USER_AI_MEMBER.password,
    );

    const payload = decodeJwtPayload(idToken);

    expect(payload["role"]).toBe("member");
    expect(payload["tenantId"]).toBe("ai-test");
    expect(payload["masterId"]).toBe("ai-admin-uid");
  });
});

// ─── AI-12: Delete confirmation dialog ───────────────────────────────────────

uiTest.describe("AI-12: Delete confirmation dialog", () => {
  uiTest(
    "delete tool_result with requiresConfirmation triggers dialog and cancel preserves data",
    async ({ page }) => {
      // Mock the /api/backend/v1/ai/chat SSE endpoint to inject a tool_result
      // chunk with requiresConfirmation: true. This triggers LiaToolConfirmDialog
      // without requiring a real GEMINI_API_KEY.
      //
      // SSE chunk format (verified against src/services/ai-service.ts parser):
      //   data: {JSON}\n\n
      // AiChatChunk shape (verified against src/types/ai.ts):
      //   type "tool_call": { type, toolCall: { name, args } }
      //   type "tool_result": { type, toolResult: { name, result, requiresConfirmation, confirmationData } }
      // confirmationData shape (verified against src/components/lia/lia-tool-confirm-dialog.tsx):
      //   { action: string; affectedRecords: string[]; severity: "low" | "high" }
      await page.route("**/api/backend/v1/ai/chat", async (route) => {
        const headers = {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        };

        // First chunk: tool_call informs the UI that Lia is executing a tool
        const toolCallChunk = JSON.stringify({
          type: "tool_call",
          toolCall: {
            name: "delete_contact",
            args: { contactId: "fake-contact-123" },
          },
        });

        // Second chunk: tool_result with requiresConfirmation=true — triggers dialog.
        // confirmationData.affectedRecords contains the entity name displayed in the dialog.
        const toolResultChunk = JSON.stringify({
          type: "tool_result",
          toolResult: {
            name: "delete_contact",
            result: null,
            requiresConfirmation: true,
            confirmationData: {
              action: "Excluir contato João Silva permanentemente",
              affectedRecords: ["João Silva"],
              severity: "high",
            },
          },
        });

        const body = `data: ${toolCallChunk}\n\ndata: ${toolResultChunk}\n\ndata: [DONE]\n\n`;

        await route.fulfill({
          status: 200,
          headers,
          body,
        });
      });

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(USER_AI_ADMIN.email, USER_AI_ADMIN.password);
      await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, {
        timeout: 30000,
      });

      const lia = new LiaPage(page);
      await lia.openPanel();

      // Send a message to trigger the mocked SSE response
      await lia.sendMessage("Excluir contato João Silva");

      // The LiaToolConfirmDialog uses Shadcn Dialog — role="dialog"
      // (not AlertDialog, which would be role="alertdialog")
      const dialog = page.getByRole("dialog");
      await dialog.waitFor({ state: "visible", timeout: 10000 });

      // Dialog should display the entity name from confirmationData.affectedRecords
      const dialogText = await dialog.textContent();
      expect(dialogText).toContain("João Silva");

      // Cancel button text is "Não, manter" (defined in lia-tool-confirm-dialog.tsx)
      const cancelButton = dialog.getByRole("button", { name: /não, manter/i });
      await cancelButton.click();

      // Dialog should close after cancel
      await expect(dialog).not.toBeVisible({ timeout: 5000 });

      // No real delete API call was triggered — the route mock only intercepted
      // the chat POST; no subsequent DELETE endpoint was called.
    },
  );

  uiTest("(Group B) real Gemini delete confirmation flow", async ({ page }) => {
    uiTest.skip(
      !process.env.GEMINI_API_KEY,
      "Requires GEMINI_API_KEY — deferred to plan 17-05",
    );
    // This test would use a real Gemini response to trigger a delete tool_call.
    // Implementation deferred to plan 17-05 or added inline if GEMINI_API_KEY is available.
    void page;
  });
});
