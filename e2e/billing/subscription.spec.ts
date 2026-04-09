/**
 * Billing subscription state transition E2E tests.
 *
 * BILL-01: Free-to-pro plan upgrade unblocks proposal creation.
 * BILL-02: Admin SDK write of pro plan + active subscription unblocks proposal creation.
 * BILL-03: Admin SDK write of free plan + canceled subscription blocks proposal creation with 402.
 *
 * Architecture notes:
 * - All tests use tenant-beta (per D-07 — do not mutate tenant-alpha).
 * - Tests are pure API tests — no browser page needed.
 * - Plan limit is only enforced for non-draft proposals (status != "draft").
 * - Cache TTL: functions/.env.local sets TENANT_PLAN_CACHE_TTL_MS=5000 (min 5s).
 *   A 6s wait between state changes is used to ensure the cache expires.
 * - test.describe.serial() ensures sequential execution within each block.
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
  title: "Proposta E2E Billing Test",
  clientId: "test-client-billing",
  clientName: "Cliente Billing Test",
  totalValue: 100,
  status: "in_progress",
  products: [],
};

/** Wait for the plan cache to expire (TTL=5000ms via .env.local + 1s buffer). */
async function waitForCacheExpiry(): Promise<void> {
  await new Promise((r) => setTimeout(r, 6000));
}

test.describe.serial("BILL-01: Plan upgrade unlocks proposal creation", () => {
  const db = getTestDb();

  test.beforeEach(async () => {
    // Start blocked: free plan with 5 proposals used (at the free tier limit).
    await seedBillingState(db, "tenant-beta", "free", 5);
  });

  test.afterEach(async () => {
    await restoreTenantState(db, "tenant-beta");
  });

  test("tenant on free plan at limit is blocked, then upgrade to pro unblocks", async () => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_BETA.email,
      USER_ADMIN_BETA.password,
    );

    // Step 1: POST proposal on free plan at limit — expect 402.
    const blockedResponse = await fetch(`${FUNCTIONS_BASE}/v1/proposals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(PROPOSAL_PAYLOAD),
    });
    expect(blockedResponse.status).toBe(402);
    const blockedBody = await blockedResponse.json() as Record<string, unknown>;
    expect(blockedBody.code).toBe("PLAN_LIMIT_PROPOSALS_MONTHLY");

    // Step 2: Upgrade to pro plan. Wait for plan cache to expire.
    await seedBillingState(db, "tenant-beta", "pro");
    await waitForCacheExpiry();

    // Step 3: POST proposal again — expect 201 (pro tier is unlimited).
    const allowedResponse = await fetch(`${FUNCTIONS_BASE}/v1/proposals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(PROPOSAL_PAYLOAD),
    });
    expect(allowedResponse.status).toBe(201);
    const allowedBody = await allowedResponse.json() as Record<string, unknown>;

    // Step 4: Clean up created proposal.
    if (allowedBody.id) {
      await fetch(`${FUNCTIONS_BASE}/v1/proposals/${allowedBody.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
    }
  });
});

test.describe.serial("BILL-02: subscription.created state allows API call", () => {
  const db = getTestDb();

  test.beforeEach(async () => {
    // Start blocked: free plan with 5 proposals used.
    await seedBillingState(db, "tenant-beta", "free", 5);
    // Wait for any stale plan cache (from previous test) to expire before this test begins.
    await waitForCacheExpiry();
  });

  test.afterEach(async () => {
    await restoreTenantState(db, "tenant-beta");
  });

  test("Admin SDK write of pro plan + active subscription unblocks proposal creation", async () => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_BETA.email,
      USER_ADMIN_BETA.password,
    );

    // Step 1: Confirm blocked on free plan.
    const blockedResponse = await fetch(`${FUNCTIONS_BASE}/v1/proposals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(PROPOSAL_PAYLOAD),
    });
    expect(blockedResponse.status).toBe(402);

    // Step 2: Simulate subscription.created webhook effect via Admin SDK.
    await db.collection("tenants").doc("tenant-beta").set(
      { plan: "pro", subscriptionStatus: "active", stripeSubscriptionId: "sub_test_123" },
      { merge: true },
    );
    await waitForCacheExpiry();

    // Step 3: POST proposal again — expect 201 (unblocked).
    const allowedResponse = await fetch(`${FUNCTIONS_BASE}/v1/proposals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(PROPOSAL_PAYLOAD),
    });
    expect(allowedResponse.status).toBe(201);
    const allowedBody = await allowedResponse.json() as Record<string, unknown>;

    // Step 4: Clean up created proposal.
    if (allowedBody.id) {
      await fetch(`${FUNCTIONS_BASE}/v1/proposals/${allowedBody.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
    }
  });
});

test.describe.serial("BILL-03: subscription.cancelled state blocks API call", () => {
  const db = getTestDb();

  test.beforeEach(async () => {
    // Start on pro plan (unblocked — unlimited proposals).
    await seedBillingState(db, "tenant-beta", "pro");
    // Wait for any stale plan cache (from previous test) to expire before this test begins.
    await waitForCacheExpiry();
  });

  test.afterEach(async () => {
    await restoreTenantState(db, "tenant-beta");
  });

  test("Admin SDK write of free plan + canceled subscription blocks proposal creation", async () => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_BETA.email,
      USER_ADMIN_BETA.password,
    );

    // Step 1: Seed 5 proposals on pro plan — pro is unlimited, so this should still allow creation.
    await seedBillingState(db, "tenant-beta", "pro", 5);
    // Cache may already have pro plan from beforeEach — no wait needed here.

    // Step 2: POST proposal — expect 201 (pro plan has maxProposalsPerMonth: -1, unlimited).
    const allowedResponse = await fetch(`${FUNCTIONS_BASE}/v1/proposals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(PROPOSAL_PAYLOAD),
    });
    expect(allowedResponse.status).toBe(201);
    const allowedBody = await allowedResponse.json() as Record<string, unknown>;

    // Step 3: Clean up the created proposal.
    if (allowedBody.id) {
      await fetch(`${FUNCTIONS_BASE}/v1/proposals/${allowedBody.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
    }

    // Step 4: Simulate subscription.cancelled webhook effect via Admin SDK.
    await db.collection("tenants").doc("tenant-beta").set(
      { plan: "free", subscriptionStatus: "canceled" },
      { merge: true },
    );
    // Keep usage at 5 (already seeded) so the free plan limit check fires.
    await waitForCacheExpiry();

    // Step 5: POST proposal again — expect 402 (free plan, 5 of 5 used = blocked).
    const blockedResponse = await fetch(`${FUNCTIONS_BASE}/v1/proposals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(PROPOSAL_PAYLOAD),
    });
    expect(blockedResponse.status).toBe(402);
    const blockedBody = await blockedResponse.json() as Record<string, unknown>;
    expect(blockedBody.code).toBe("PLAN_LIMIT_PROPOSALS_MONTHLY");
  });
});
