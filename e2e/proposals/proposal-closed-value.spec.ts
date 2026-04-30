/**
 * PROP-10 through PROP-13: closedValue API contract E2E tests.
 *
 * Validates the closedValue field at the API boundary — that it is accepted,
 * stored, and cleared correctly by the proposals endpoint without triggering
 * the 400 regression bug (update with closedValue as number was rejected).
 *
 * All tests operate via direct API calls (no browser UI interaction) and verify
 * persistence via the Admin Firestore SDK. Each test is fully self-contained and
 * deletes its proposal at the end.
 *
 * Tests:
 *  PROP-10-a: Create with closedValue as number — stored correctly
 *  PROP-10-b: Update existing proposal with closedValue (the 400 bug regression path)
 *  PROP-10-c: Clear closedValue — updated to null/undefined (not 0)
 *  PROP-10-d: Update with other fields + closedValue: null — regression for combined updates
 *  PROP-10-e: Idempotency — repeated updates with same closedValue always succeed
 *  PROP-11:   Boundary — closedValue: 0 is treated as falsy; effectiveTotalValue uses totalValue
 *  PROP-12:   Very large closedValue stored as number
 *  PROP-13:   Decimal closedValue stored with correct precision
 */

import { test, expect } from "../fixtures/auth.fixture";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { USER_ADMIN_ALPHA } from "../seed/data/users";
import { PROPOSAL_ALPHA_DRAFT } from "../seed/data/proposals";
import { getTestDb } from "../helpers/admin-firestore";

// ─── Shared proposal shape ─────────────────────────────────────────────────────

const BASE_PRODUCTS = PROPOSAL_ALPHA_DRAFT.items.map((item) => ({
  id: item.productId,
  name: item.productName,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  total: item.total,
}));

// ─── PROP-10-a: Create with closedValue as number ─────────────────────────────

test.describe("PROP-10: closedValue API contract", () => {
  test("PROP-10-a: create proposal with closedValue stores it as number in Firestore", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `PROP-10-a ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: PROPOSAL_ALPHA_DRAFT.total,
        products: BASE_PRODUCTS,
        closedValue: 5000,
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();
    expect(proposalId).toBeTruthy();

    // Verify Firestore persistence
    const db = getTestDb();
    const doc = await db.collection("proposals").doc(proposalId).get();
    const data = doc.data()!;
    expect(typeof data.closedValue).toBe("number");
    expect(data.closedValue).toBe(5000);

    // Cleanup
    const deleteResp = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(deleteResp.status());
  });

  // ─── PROP-10-b: Update with closedValue (the exact 400 bug regression path) ──

  test("PROP-10-b: update existing proposal with closedValue as number returns 200 (not 400)", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();

    // Create without closedValue first
    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `PROP-10-b ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: PROPOSAL_ALPHA_DRAFT.total,
        products: BASE_PRODUCTS,
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();
    expect(proposalId).toBeTruthy();

    // PUT with closedValue — this was the exact path that returned 400
    const updateResp = await authenticatedPage.request.put(
      `/api/backend/v1/proposals/${proposalId}`,
      {
        headers: { Authorization: `Bearer ${idToken}` },
        data: { closedValue: 7500 },
      },
    );
    expect(updateResp.status()).toBe(200);

    // Verify Firestore has the updated value as a number
    const db = getTestDb();
    const doc = await db.collection("proposals").doc(proposalId).get();
    const data = doc.data()!;
    expect(typeof data.closedValue).toBe("number");
    expect(data.closedValue).toBe(7500);

    // Cleanup
    const deleteResp = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(deleteResp.status());
  });

  // ─── PROP-10-c: Clear closedValue with null ───────────────────────────────────

  test("PROP-10-c: update closedValue to null clears the override (not stored as 0)", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();

    // Create with closedValue
    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `PROP-10-c ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: PROPOSAL_ALPHA_DRAFT.total,
        products: BASE_PRODUCTS,
        closedValue: 5000,
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    // Clear closedValue with null
    const updateResp = await authenticatedPage.request.put(
      `/api/backend/v1/proposals/${proposalId}`,
      {
        headers: { Authorization: `Bearer ${idToken}` },
        data: { closedValue: null },
      },
    );
    expect(updateResp.status()).toBe(200);

    // Firestore: closedValue must be null or undefined — never 0
    const db = getTestDb();
    const doc = await db.collection("proposals").doc(proposalId).get();
    const data = doc.data()!;
    expect(data.closedValue == null).toBe(true); // null OR undefined — not 0

    // Cleanup
    const deleteResp = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(deleteResp.status());
  });

  // ─── PROP-10-d: Combined update with other fields + closedValue: null ─────────

  test("PROP-10-d: update with discount + extraExpense + closedValue: null all persist correctly", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();

    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `PROP-10-d ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: PROPOSAL_ALPHA_DRAFT.total,
        products: BASE_PRODUCTS,
        closedValue: 8000,
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    // Update multiple fields simultaneously — regression path for combined updates
    const updateResp = await authenticatedPage.request.put(
      `/api/backend/v1/proposals/${proposalId}`,
      {
        headers: { Authorization: `Bearer ${idToken}` },
        data: { discount: 10, extraExpense: 250, closedValue: null },
      },
    );
    expect(updateResp.status()).toBe(200);

    // Verify all fields persisted correctly
    const db = getTestDb();
    const doc = await db.collection("proposals").doc(proposalId).get();
    const data = doc.data()!;
    expect(data.discount).toBe(10);
    expect(data.extraExpense).toBe(250);
    expect(data.closedValue == null).toBe(true);

    // Cleanup
    const deleteResp = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(deleteResp.status());
  });

  // ─── PROP-10-e: Idempotency ────────────────────────────────────────────────────

  test("PROP-10-e: repeated updates with same closedValue all return 200 and Firestore stays consistent", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();

    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `PROP-10-e ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: PROPOSAL_ALPHA_DRAFT.total,
        products: BASE_PRODUCTS,
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    // Three identical updates — all must succeed
    for (let i = 0; i < 3; i++) {
      const updateResp = await authenticatedPage.request.put(
        `/api/backend/v1/proposals/${proposalId}`,
        {
          headers: { Authorization: `Bearer ${idToken}` },
          data: { closedValue: 6000 },
        },
      );
      expect(updateResp.status()).toBe(200);
    }

    // Firestore must always reflect the last written value
    const db = getTestDb();
    const doc = await db.collection("proposals").doc(proposalId).get();
    const data = doc.data()!;
    expect(typeof data.closedValue).toBe("number");
    expect(data.closedValue).toBe(6000);

    // Cleanup
    const deleteResp = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(deleteResp.status());
  });
});

// ─── PROP-11: closedValue: 0 treated as falsy ────────────────────────────────

test.describe("PROP-11: closedValue boundary — zero is falsy", () => {
  test("closedValue: 0 is not a valid override; approved transaction uses totalValue", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();

    // Create with closedValue: 0 (falsy) and a real totalValue
    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `PROP-11 ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: 3100,
        products: BASE_PRODUCTS,
        closedValue: 0,
        installmentsWallet: "wallet-alpha-main",
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    // draft → sent → approved
    const sentResp = await authenticatedPage.request.put(
      `/api/backend/v1/proposals/${proposalId}`,
      {
        headers: { Authorization: `Bearer ${idToken}` },
        data: { status: "sent" },
      },
    );
    expect(sentResp.status()).toBe(200);

    const approvedResp = await authenticatedPage.request.put(
      `/api/backend/v1/proposals/${proposalId}`,
      {
        headers: { Authorization: `Bearer ${idToken}` },
        data: { status: "approved" },
      },
    );
    expect(approvedResp.status()).toBe(200);

    // Verify: transaction amount must be totalValue (3100), not 0
    const db = getTestDb();
    const txsSnap = await db.collection("transactions")
      .where("proposalId", "==", proposalId)
      .get();
    const txs = txsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) } as Record<string, unknown>));

    const totalAmount = txs.reduce((sum, tx) => sum + (tx.amount as number), 0);
    expect(totalAmount).toBeCloseTo(3100, 2);

    // Cleanup
    const deleteResp = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(deleteResp.status());
  });
});

// ─── PROP-12: Very large closedValue ──────────────────────────────────────────

test.describe("PROP-12: Very large closedValue", () => {
  test("closedValue: 999999.99 is accepted and stored correctly as number", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();

    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `PROP-12 ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: PROPOSAL_ALPHA_DRAFT.total,
        products: BASE_PRODUCTS,
        closedValue: 999999.99,
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    const db = getTestDb();
    const doc = await db.collection("proposals").doc(proposalId).get();
    const data = doc.data()!;
    expect(typeof data.closedValue).toBe("number");
    expect(data.closedValue).toBeCloseTo(999999.99, 2);

    // Also verify it persists through an update
    const updateResp = await authenticatedPage.request.put(
      `/api/backend/v1/proposals/${proposalId}`,
      {
        headers: { Authorization: `Bearer ${idToken}` },
        data: { closedValue: 999999.99 },
      },
    );
    expect(updateResp.status()).toBe(200);

    const docAfter = await db.collection("proposals").doc(proposalId).get();
    const dataAfter = docAfter.data()!;
    expect(typeof dataAfter.closedValue).toBe("number");
    expect(dataAfter.closedValue).toBeCloseTo(999999.99, 2);

    // Cleanup
    const deleteResp = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(deleteResp.status());
  });
});

// ─── PROP-13: Decimal closedValue ─────────────────────────────────────────────

test.describe("PROP-13: Decimal closedValue precision", () => {
  test("closedValue: 1500.50 is accepted and stored with correct fractional precision", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();

    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `PROP-13 ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: PROPOSAL_ALPHA_DRAFT.total,
        products: BASE_PRODUCTS,
        closedValue: 1500.50,
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    const db = getTestDb();
    const doc = await db.collection("proposals").doc(proposalId).get();
    const data = doc.data()!;
    expect(typeof data.closedValue).toBe("number");
    expect(data.closedValue).toBeCloseTo(1500.50, 2);

    // Cleanup
    const deleteResp = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(deleteResp.status());
  });
});
