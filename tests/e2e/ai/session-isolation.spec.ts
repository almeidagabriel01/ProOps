/**
 * AI-15: Session ownership isolation.
 * Verifies that a user cannot load another user's conversation session.
 * conversation-store.ts returns [] when uid mismatches — this test confirms
 * the endpoint still returns 200 (history simply empty, not a 403 leak).
 */

import { test, expect } from "@playwright/test";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { getTestDb } from "../helpers/admin-firestore";
import { USER_AI_ADMIN, USER_AI_MEMBER } from "../seed/data/ai";

const FUNCTIONS_BASE =
  "http://127.0.0.1:5001/demo-proops-test/southamerica-east1/api";

test.describe.configure({ mode: "serial" });

test.describe("AI-15: Session ownership isolation", () => {
  const db = getTestDb();
  const STOLEN_SESSION = "stolen-session-ai15";

  test.afterEach(async () => {
    try {
      await db.doc(`tenants/ai-test/aiConversations/${STOLEN_SESSION}`).delete();
    } catch { /* ignore */ }
  });

  test("sending another user's sessionId does not expose their history", async () => {
    // Seed a conversation owned by the admin user
    await db.doc(`tenants/ai-test/aiConversations/${STOLEN_SESSION}`).set({
      sessionId: STOLEN_SESSION,
      uid: "ai-admin-uid",
      tenantId: "ai-test",
      messages: [{ role: "user", content: "secret message", timestamp: new Date() }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Member user tries to use the admin's sessionId
    const { idToken } = await signInWithEmailPassword(
      USER_AI_MEMBER.email,
      USER_AI_MEMBER.password,
    );

    const response = await fetch(`${FUNCTIONS_BASE}/v1/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ message: "olá", sessionId: STOLEN_SESSION }),
    });

    // Must succeed (200) — ownership mismatch returns empty history, not an error
    expect(response.status).toBe(200);
    const text = await response.text();
    // The stolen session history must NOT appear in the response
    expect(text).not.toContain("secret message");
  });

  test("admin cannot use member sessionId (cross-user within same tenant)", async () => {
    const MEMBER_SESSION = "member-session-ai15";
    await db.doc(`tenants/ai-test/aiConversations/${MEMBER_SESSION}`).set({
      sessionId: MEMBER_SESSION,
      uid: "ai-member-uid",
      tenantId: "ai-test",
      messages: [{ role: "user", content: "member only content", timestamp: new Date() }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { idToken } = await signInWithEmailPassword(
      USER_AI_ADMIN.email,
      USER_AI_ADMIN.password,
    );
    const response = await fetch(`${FUNCTIONS_BASE}/v1/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ message: "olá", sessionId: MEMBER_SESSION }),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain("member only content");

    await db.doc(`tenants/ai-test/aiConversations/${MEMBER_SESSION}`).delete().catch(() => {});
  });
});
