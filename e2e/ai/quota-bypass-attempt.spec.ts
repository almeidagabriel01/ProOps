/**
 * AI-16: Quota bypass via pre-debit refund.
 * Uses the dedicated ai-quota tenant (pro, 400 msg/month) — never shared
 * with other spec files so parallel workers cannot contaminate usage state.
 */

import { test, expect } from "@playwright/test";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { getTestDb } from "../helpers/admin-firestore";
import { USER_AI_QUOTA, seedAiUsage, clearAiUsage } from "../seed/data/ai";

const FUNCTIONS_BASE =
  "http://127.0.0.1:5001/demo-proops-test/southamerica-east1/api";

test.describe.configure({ mode: "serial" });

test.describe("AI-16: Quota bypass — pre-debit refund", () => {
  const db = getTestDb();

  test.afterEach(async () => {
    await clearAiUsage(db, "ai-quota");
  });

  test("a confirmation-pending response does not permanently consume a message slot", async () => {
    const { idToken } = await signInWithEmailPassword(
      USER_AI_QUOTA.email,
      USER_AI_QUOTA.password,
    );

    // Seed usage to 399 (one below pro limit of 400)
    await seedAiUsage(db, "ai-quota", 399);

    // "delete something" triggers mock's request_confirmation flow → skipIncrement=true
    // → slot refunded synchronously before SSE [DONE] → usage stays at 399
    const r1 = await fetch(`${FUNCTIONS_BASE}/v1/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ message: "delete something", sessionId: "quota-bypass-1" }),
    });
    expect(r1.status).toBe(200);

    // Second request must not be blocked (refund worked, usage still at 399)
    const r2 = await fetch(`${FUNCTIONS_BASE}/v1/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ message: "olá", sessionId: "quota-bypass-2" }),
    });
    if (r2.status === 429) {
      const body = (await r2.json()) as Record<string, unknown>;
      expect(body.code).not.toBe("AI_LIMIT_EXCEEDED");
    } else {
      expect(r2.status).toBe(200);
    }
  });

  test("at-limit user is correctly blocked regardless of confirmation state", async () => {
    const { idToken } = await signInWithEmailPassword(
      USER_AI_QUOTA.email,
      USER_AI_QUOTA.password,
    );

    await seedAiUsage(db, "ai-quota", 400);

    const r = await fetch(`${FUNCTIONS_BASE}/v1/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ message: "olá", sessionId: "quota-bypass-3" }),
    });

    expect(r.status).toBe(429);
    const body = (await r.json()) as Record<string, unknown>;
    expect(body.code).toBe("AI_LIMIT_EXCEEDED");
  });
});
