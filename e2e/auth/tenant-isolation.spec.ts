/**
 * AUTH-06: Tenant isolation tests.
 * These tests verify that multi-tenant data isolation is enforced at both:
 * 1. Firestore security rules layer (direct emulator REST calls)
 * 2. Backend API layer (via Next.js proxy with signed ID tokens)
 *
 * CRITICAL: If any test in this file fails, CI must block the PR.
 * These tests protect against cross-tenant data leakage.
 */

import { test, expect } from "../fixtures/base.fixture";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { PROPOSAL_BETA_DRAFT } from "../seed/data/proposals";
import { USER_ADMIN_ALPHA, USER_ADMIN_BETA } from "../seed/data/users";

const FIRESTORE_EMULATOR_URL =
  "http://127.0.0.1:8080/v1/projects/demo-proops-test/databases/(default)/documents";

test.describe("AUTH-06: Tenant isolation", () => {
  test("alpha token cannot read beta proposal from Firestore", async () => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const response = await fetch(
      `${FIRESTORE_EMULATOR_URL}/proposals/${PROPOSAL_BETA_DRAFT.id}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      },
    );

    expect(response.status).toBe(403);
  });

  test("alpha token cannot write to beta proposal in Firestore", async () => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const response = await fetch(
      `${FIRESTORE_EMULATOR_URL}/proposals/${PROPOSAL_BETA_DRAFT.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            title: { stringValue: "Hacked by Alpha" },
          },
        }),
      },
    );

    expect(response.status).toBe(403);
  });

  test("backend API blocks cross-tenant proposal update", async ({ request }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const response = await request.put(`/api/backend/proposals/${PROPOSAL_BETA_DRAFT.id}`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      data: {
        title: "Cross-tenant attack",
      },
    });

    // Functions emulator is started in global-setup (--only auth,firestore,storage,functions).
    // 403 = tenantId mismatch caught by Express middleware; 404 = document not found after tenant filter.
    expect([403, 404]).toContain(response.status());
  });

  test("beta token cannot read alpha proposal from Firestore", async () => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_BETA.email,
      USER_ADMIN_BETA.password,
    );

    const response = await fetch(
      `${FIRESTORE_EMULATOR_URL}/proposals/proposal-alpha-draft`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      },
    );

    expect(response.status).toBe(403);
  });
});
