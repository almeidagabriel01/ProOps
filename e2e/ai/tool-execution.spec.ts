/**
 * AI Tool Execution E2E Tests — Group B (requires GEMINI_API_KEY)
 *
 * Covers:
 *   AI-04: Tool execution creates real Firestore data (create_contact → clients collection)
 *   AI-05: Inactive module causes Lia to refuse tool execution (whatsapp module disabled)
 *   AI-11 Group B: Member role user cannot execute admin-only tools (delete_contact)
 *
 * All tests skip gracefully when GEMINI_API_KEY is not set.
 * Run in CI with: GEMINI_API_KEY=<key> npx playwright test e2e/ai/tool-execution.spec.ts
 */

import { test, expect } from "@playwright/test";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { getTestDb } from "../helpers/admin-firestore";
import { USER_AI_ADMIN, USER_AI_MEMBER } from "../seed/data/ai";

const FUNCTIONS_BASE =
  "http://127.0.0.1:5001/demo-proops-test/southamerica-east1/api";

test.describe.configure({ mode: "serial" });

// ─── AI-04: Tool execution creates real Firestore data ────────────────────────

test.describe("AI-04: Tool execution creates real Firestore data", () => {
  test.skip(!process.env.GEMINI_API_KEY, "Requires GEMINI_API_KEY");

  const db = getTestDb();
  let createdContactId: string | null = null;

  test.afterEach(async () => {
    // Clean up by created ID
    if (createdContactId) {
      try {
        await db.doc(`clients/${createdContactId}`).delete();
      } catch {
        // Ignore if already deleted
      }
      createdContactId = null;
    }
    // Also clean up by querying for the test contact name (covers all variants)
    const snap = await db
      .collection("clients")
      .where("tenantId", "==", "ai-test")
      .where("name", "==", "Contato E2E AI Test")
      .get();
    for (const doc of snap.docs) {
      await doc.ref.delete();
    }
  });

  test("(API) creating a contact via AI chat creates Firestore document", async () => {
    test.skip(!process.env.GEMINI_API_KEY, "Requires GEMINI_API_KEY");

    const { idToken } = await signInWithEmailPassword(
      USER_AI_ADMIN.email,
      USER_AI_ADMIN.password,
    );

    // create_contact is available to all members on starter+ plans.
    // ai-test tenant is pro plan, so this tool is available.
    // The tool does NOT require confirmation (no request_confirmation call for create_contact).
    const response = await fetch(`${FUNCTIONS_BASE}/v1/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        message:
          "Crie um contato com nome Contato E2E AI Test e email e2e@test.com",
        sessionId: "test-tool-execution-ai04",
      }),
    });

    // SSE response — should be 200 (stream started)
    expect(response.status).toBe(200);

    // Read the full SSE body
    const body = await response.text();

    // Parse SSE events
    const lines = body.split("\n").filter((l) => l.startsWith("data: "));
    const rawEvents = lines
      .map((l) => l.replace("data: ", "").trim())
      .filter((l) => l !== "[DONE]" && l.length > 0);

    // Look for tool_call event for create_contact
    let foundToolCall = false;
    for (const raw of rawEvents) {
      try {
        const event = JSON.parse(raw) as Record<string, unknown>;
        if (event.type === "tool_call") {
          const toolCall = event.toolCall as Record<string, unknown>;
          if (toolCall.name === "create_contact") {
            foundToolCall = true;
          }
        }
      } catch {
        // Not JSON — text chunk, skip
      }
    }

    // Give a moment for any async Firestore writes to complete
    await new Promise((r) => setTimeout(r, 2000));

    // Verify the contact was created in Firestore (primary assertion)
    const snap = await db
      .collection("clients")
      .where("tenantId", "==", "ai-test")
      .where("name", "==", "Contato E2E AI Test")
      .limit(1)
      .get();

    expect(snap.empty).toBe(false);
    if (!snap.empty) {
      createdContactId = snap.docs[0].id;
      const data = snap.docs[0].data();
      expect(data.tenantId).toBe("ai-test");
      expect(data.name).toBe("Contato E2E AI Test");
    }

    // Also confirm Gemini called the tool (informational — not the primary assertion)
    // If this fails but Firestore check passes, it means Gemini called the tool without
    // emitting a tool_call SSE event (unlikely, but the Firestore check is authoritative)
    if (!foundToolCall) {
      console.warn(
        "[AI-04] No tool_call SSE event detected for create_contact, but contact exists in Firestore",
      );
    }
  });
});

// ─── AI-05: Inactive module causes Lia to refuse ──────────────────────────────

test.describe("AI-05: Inactive module causes Lia to refuse", () => {
  test.skip(!process.env.GEMINI_API_KEY, "Requires GEMINI_API_KEY");

  const db = getTestDb();

  test.afterEach(async () => {
    // Restore ai-test tenant to original state: pro plan, whatsappEnabled: true
    await db.collection("tenants").doc("ai-test").update({
      plan: "pro",
      planId: "pro",
      whatsappEnabled: true,
    });
  });

  test("disabled whatsapp module filters tool from Gemini and prevents execution", async () => {
    // Temporarily upgrade ai-test to enterprise so send_whatsapp_message is plan-eligible,
    // then disable whatsappEnabled to test module gating specifically.
    // Without this upgrade, the tool is already filtered by plan rank (pro < enterprise),
    // and we couldn't distinguish plan-gating from module-gating.
    await db.collection("tenants").doc("ai-test").update({
      plan: "enterprise",
      planId: "enterprise",
      whatsappEnabled: false,
    });

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
        message: "Enviar mensagem WhatsApp para o cliente João",
        sessionId: "test-inactive-module-ai05",
      }),
    });

    // The SSE stream should start normally (200)
    expect(response.status).toBe(200);

    const body = await response.text();
    const lines = body.split("\n").filter((l) => l.startsWith("data: "));
    const rawEvents = lines
      .map((l) => l.replace("data: ", "").trim())
      .filter((l) => l !== "[DONE]" && l.length > 0);

    // Collect full text response from all text chunks
    const textChunks: string[] = [];
    let whatsappToolCalled = false;

    for (const raw of rawEvents) {
      try {
        const event = JSON.parse(raw) as Record<string, unknown>;
        if (event.type === "text") {
          textChunks.push(String(event.content ?? ""));
        }
        if (event.type === "tool_call") {
          const toolCall = event.toolCall as Record<string, unknown>;
          if (toolCall.name === "send_whatsapp_message") {
            whatsappToolCalled = true;
          }
        }
      } catch {
        // Not JSON — raw text chunk
      }
    }

    // When whatsappEnabled=false, buildAvailableTools() filters out send_whatsapp_message.
    // Gemini never receives the tool declaration, so it cannot call it.
    // The response will be a natural language message indicating the action is unavailable.
    expect(whatsappToolCalled).toBe(false);

    // The full text response should not indicate the WhatsApp message was sent successfully
    const fullText = textChunks.join(" ");
    expect(fullText.toLowerCase()).not.toContain("mensagem enviada");
    expect(fullText.toLowerCase()).not.toContain("whatsapp enviado");
  });
});

// ─── AI-11 Group B: Member blocked from admin tool execution ──────────────────

test.describe("AI-11 Group B: Member blocked from admin tool execution", () => {
  test.skip(!process.env.GEMINI_API_KEY, "Requires GEMINI_API_KEY");

  const db = getTestDb();

  test.afterEach(async () => {
    // Clean up: ensure the delete target document is removed
    try {
      await db.doc("clients/ai-test-delete-target").delete();
    } catch {
      // Already deleted or never created — ignore
    }
    // Also clean up any contacts named "Contato Para Deletar" for ai-test tenant
    const snap = await db
      .collection("clients")
      .where("tenantId", "==", "ai-test")
      .where("name", "==", "Contato Para Deletar")
      .get();
    for (const doc of snap.docs) {
      await doc.ref.delete();
    }
  });

  test("member user cannot execute admin-only tool (delete_contact)", async () => {
    // Create a test contact document that the member will attempt to delete via Lia
    await db.collection("clients").doc("ai-test-delete-target").set({
      tenantId: "ai-test",
      name: "Contato Para Deletar",
      email: "deletar@test.com",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Sign in as member user (role: "member")
    // USER_AI_MEMBER has tenantId: "ai-test", role: "member"
    const { idToken } = await signInWithEmailPassword(
      USER_AI_MEMBER.email,
      USER_AI_MEMBER.password,
    );

    // Ask Lia to delete the contact.
    // delete_contact has minRole: "admin" in TOOL_REGISTRY.
    // buildAvailableTools() filters it out for members (normalizedRole "MEMBER" not in ADMIN_ROLES).
    // Gemini never receives the delete_contact function declaration.
    const response = await fetch(`${FUNCTIONS_BASE}/v1/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        message: "Excluir o contato Contato Para Deletar",
        sessionId: "test-member-admin-tool-ai11b",
      }),
    });

    expect(response.status).toBe(200);

    const body = await response.text();
    const lines = body.split("\n").filter((l) => l.startsWith("data: "));
    const rawEvents = lines
      .map((l) => l.replace("data: ", "").trim())
      .filter((l) => l !== "[DONE]" && l.length > 0);

    // Check that delete_contact was NOT called as a tool
    let deleteToolCalled = false;
    for (const raw of rawEvents) {
      try {
        const event = JSON.parse(raw) as Record<string, unknown>;
        if (event.type === "tool_call") {
          const toolCall = event.toolCall as Record<string, unknown>;
          if (toolCall.name === "delete_contact") {
            deleteToolCalled = true;
          }
        }
        // Also check if executor double-check fired (tool_result with permission error)
        if (event.type === "tool_result") {
          const toolResult = event.toolResult as Record<string, unknown>;
          const errMsg = String(toolResult.error ?? "");
          if (errMsg.includes("permissao de administrador")) {
            deleteToolCalled = true;
          }
        }
      } catch {
        // Not JSON — text chunk, skip
      }
    }

    // Primary assertion: the contact document must still exist after the attempt
    // If delete_contact was bypassed or called, the document would be gone
    const contactSnap = await db.doc("clients/ai-test-delete-target").get();
    expect(contactSnap.exists).toBe(true);

    // Secondary: confirm the tool was never actually invoked
    expect(deleteToolCalled).toBe(false);
  });
});
