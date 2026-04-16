/**
 * AI-13: LIA-specific rate-limit enforcement.
 *
 * Verifies that the AI rate limiter returns 429 AI_RATE_LIMIT_EXCEEDED
 * after 20 requests/minute for the same user.
 *
 * Uses AI_PROVIDER=mock (set in global-setup.ts) — no real API key needed.
 */

import { test, expect } from "@playwright/test";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { USER_AI_STARTER } from "../seed/data/ai";

const FUNCTIONS_BASE =
  "http://127.0.0.1:5001/demo-proops-test/southamerica-east1/api";

test.describe.configure({ mode: "serial" });

test.describe("AI-13: LIA rate-limit — 20 req/min per user", () => {
  test("21st request in the same minute returns 429 AI_RATE_LIMIT_EXCEEDED", async () => {
    const { idToken } = await signInWithEmailPassword(
      USER_AI_STARTER.email,
      USER_AI_STARTER.password,
    );

    const postChat = (sessionId: string) =>
      fetch(`${FUNCTIONS_BASE}/v1/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ message: "olá", sessionId }),
      });

    // Fire 20 requests sequentially — concurrent would saturate the 5-SSE-per-tenant
    // cap, causing some to be blocked and their rate-limit count undone.
    const first20: number[] = [];
    for (let i = 0; i < 20; i++) {
      first20.push(await postChat(`rate-limit-sess-${i}`).then((r) => r.status));
    }
    expect(first20.every((s) => s === 200)).toBe(true);

    // 21st request should be rate-limited
    const r21 = await postChat("rate-limit-sess-20");
    expect(r21.status).toBe(429);
    const body = (await r21.json()) as Record<string, unknown>;
    expect(body.code).toBe("AI_RATE_LIMIT_EXCEEDED");
  });
});
