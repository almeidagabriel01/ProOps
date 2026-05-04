/**
 * BILL-04: Plan limit enforcement E2E tests.
 *
 * Verifies that free-tier tenants at their monthly proposal limit receive
 * 402 PLAN_LIMIT_PROPOSALS_MONTHLY, and that tenants below the limit can
 * still create proposals (201).
 *
 * Architecture notes:
 * - Pure API tests — no browser page.
 * - Uses tenant-beta via USER_ADMIN_BETA auth claims.
 * - test.describe.configure({ mode: 'serial' }) enforces sequential execution
 *   to prevent plan cache collisions with subscription.spec.ts.
 * - Cache TTL: TENANT_PLAN_CACHE_TTL_MS=5000 is set in functions/.env.local.
 *   A 6s wait (waitForCacheExpiry) is used between plan state changes to ensure
 *   the cache expires before the next assertion.
 * - Plan enforcement is skipped for draft proposals — payload uses status "in_progress".
 */

import { test, expect } from "@playwright/test";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { getTestDb } from "../helpers/admin-firestore";
import { seedBillingState, restoreTenantState } from "../seed/data/billing";
import { USER_ADMIN_BETA } from "../seed/data/users";

const FUNCTIONS_BASE =
  "http://127.0.0.1:5001/demo-proops-test/southamerica-east1/api";

/** Minimum valid proposal payload that triggers plan limit enforcement (non-draft). */
const PROPOSAL_PAYLOAD = {
  title: "Proposta E2E Plan Limits Test",
  clientId: "test-client-plan-limits",
  clientName: "Cliente Plan Limits Test",
  totalValue: 100,
  status: "in_progress",
  products: [],
};

/** Wait for the plan cache to expire (TTL=5000ms via .env.local + 1s buffer). */
async function waitForCacheExpiry(): Promise<void> {
  await new Promise((r) => setTimeout(r, 6000));
}

test.describe.configure({ mode: "serial" });

test.describe("BILL-04: Free plan blocks proposal creation at limit", () => {
  const db = getTestDb();

  test.beforeEach(async () => {
    // Seed tenant-beta to free plan with 5 proposals created (at the free tier limit of 5).
    await seedBillingState(db, "tenant-beta", "free", 5);
    // Wait for any stale plan cache from previous tests to expire.
    await waitForCacheExpiry();
  });

  test.afterEach(async () => {
    await restoreTenantState(db, "tenant-beta");
  });

  test("free plan tenant at proposal limit receives 402 with PLAN_LIMIT_PROPOSALS_MONTHLY", async () => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_BETA.email,
      USER_ADMIN_BETA.password,
    );

    const response = await fetch(`${FUNCTIONS_BASE}/v1/proposals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(PROPOSAL_PAYLOAD),
    });

    expect(response.status).toBe(402);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.code).toBe("PLAN_LIMIT_PROPOSALS_MONTHLY");
    expect(body.used).toBe(5);
    expect(body.limit).toBe(5);
    expect(body.tier).toBe("free");
    expect(body.message).toContain("Limite de propostas");
  });

  test("free plan tenant BELOW limit can still create a proposal", async () => {
    // Override usage to 4 (one below the free limit of 5).
    await seedBillingState(db, "tenant-beta", "free", 4);
    // Wait for cache to expire so the updated usage is picked up.
    await waitForCacheExpiry();

    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_BETA.email,
      USER_ADMIN_BETA.password,
    );

    const response = await fetch(`${FUNCTIONS_BASE}/v1/proposals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(PROPOSAL_PAYLOAD),
    });

    expect(response.status).toBe(201);

    const body = (await response.json()) as Record<string, unknown>;

    // Clean up the created proposal.
    if (body.id) {
      await fetch(`${FUNCTIONS_BASE}/v1/proposals/${body.id as string}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
    }
  });
});
