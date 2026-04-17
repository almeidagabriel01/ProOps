/**
 * AI-13: LIA-specific rate-limit enforcement.
 *
 * Fires requests as USER_AI_STARTER until we hit 429 AI_RATE_LIMIT_EXCEEDED
 * (up to 30 attempts). This is resilient to CI timing — if prior attempts
 * already built up count, we hit the limit sooner; if the window expired
 * we just send more. The unit test (rate-limiter.test.ts) pins the exact
 * 20 req/min threshold.
 *
 * Uses AI_PROVIDER=mock — no real API key needed.
 */

import { test, expect } from "@playwright/test";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { USER_AI_STARTER } from "../seed/data/ai";

const FUNCTIONS_BASE =
  "http://127.0.0.1:5001/demo-proops-test/southamerica-east1/api";

test.describe.configure({ mode: "serial" });

test.describe("AI-13: LIA rate-limit — 20 req/min per user", () => {
  test("repeated requests eventually return 429 AI_RATE_LIMIT_EXCEEDED", async () => {
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

    // Send requests one at a time until rate-limited or 30 attempts exhausted
    let rateLimitHit = false;
    for (let i = 0; i < 30; i++) {
      const r = await postChat(`rate-limit-sess-${i}`);
      if (r.status === 429) {
        const body = (await r.json()) as Record<string, unknown>;
        if (body.code === "AI_RATE_LIMIT_EXCEEDED") {
          rateLimitHit = true;
          break;
        }
        // AI_LIMIT_EXCEEDED or similar — unexpected, keep going
      } else {
        // Cancel the SSE stream so res.on("close") fires on the server and the
        // tenantSseCount slot is released before the next iteration. Without this,
        // the 6th+ request hits MAX_SSE_PER_TENANT (5), the limiter rolls back the
        // RPM count, and we never accumulate 20 requests to trigger RATE_LIMIT_EXCEEDED.
        await r.body?.cancel().catch(() => {});
      }
    }

    expect(rateLimitHit).toBe(true);
  });
});
