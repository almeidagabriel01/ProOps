/**
 * FIN-10 through FIN-18: Proposal approval with closedValue — transaction sync E2E tests.
 *
 * Validates that syncApprovedProposalTransactions correctly uses closedValue as the
 * effectiveTotalValue when set (and falls back to totalValue when closedValue is falsy).
 * All financial arithmetic is verified via Admin Firestore SDK — no UI interaction needed.
 *
 * Key invariants under test:
 *  - effectiveTotalValue = closedValue > 0 ? closedValue : totalValue
 *  - Down payment % is recalculated from effectiveTotalValue
 *  - Fixed down payment is capped: Math.min(downPaymentValue, effectiveTotalValue)
 *  - installmentValue = (effectiveTotalValue - effectiveDownPayment) / installmentsCount
 *  - After approval, proposal doc is updated: installmentValue and downPaymentValue saved back
 *  - Installment transactions carry isInstallment: true; down payment transactions do not
 *  - closedValue: 0 is falsy — effectiveTotalValue falls back to totalValue
 *
 * Tests:
 *  FIN-10: Single transaction; closedValue overrides totalValue
 *  FIN-11: Down payment % + installments, all derived from closedValue
 *  FIN-12: Fixed down payment + installments
 *  FIN-13: Only installments (no down payment)
 *  FIN-14: Only down payment (no installments)
 *  FIN-15: Fixed down payment capped by closedValue (persistence guard fix)
 *  FIN-16: Re-approval after revert to draft with updated closedValue
 *  FIN-17: Regression — no closedValue uses totalValue
 *  FIN-18: Regression — down payment % with no closedValue
 */

import { test, expect } from "../fixtures/auth.fixture";
import type { APIRequestContext } from "@playwright/test";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { USER_ADMIN_ALPHA } from "../seed/data/users";
import { PROPOSAL_ALPHA_DRAFT } from "../seed/data/proposals";
import { getTestDb } from "../helpers/admin-firestore";

// ─── Module-level helpers ──────────────────────────────────────────────────────

async function approveProposal(
  request: APIRequestContext,
  idToken: string,
  proposalId: string,
): Promise<void> {
  // draft → sent
  const sentResp = await request.put(`/api/backend/v1/proposals/${proposalId}`, {
    headers: { Authorization: `Bearer ${idToken}` },
    data: { status: "sent" },
  });
  expect(sentResp.status()).toBe(200);

  // sent → approved (triggers syncApprovedProposalTransactions synchronously)
  const approvedResp = await request.put(`/api/backend/v1/proposals/${proposalId}`, {
    headers: { Authorization: `Bearer ${idToken}` },
    data: { status: "approved" },
  });
  expect(approvedResp.status()).toBe(200);
}

async function getProposalTransactions(
  proposalId: string,
): Promise<Array<{ id: string } & Record<string, unknown>>> {
  const db = getTestDb();
  const snap = await db.collection("transactions").where("proposalId", "==", proposalId).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
}

async function getProposalDoc(proposalId: string): Promise<Record<string, unknown>> {
  const db = getTestDb();
  const doc = await db.collection("proposals").doc(proposalId).get();
  return doc.data() as Record<string, unknown>;
}

// ─── Shared product shape (matches API expectations) ──────────────────────────

const BASE_PRODUCTS = PROPOSAL_ALPHA_DRAFT.items.map((item) => ({
  id: item.productId,
  name: item.productName,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  total: item.total,
}));

// ─── FIN-10: Single transaction — closedValue overrides totalValue ─────────────

test.describe("FIN-10: Single transaction with closedValue override", () => {
  test("FIN-10: approved single transaction amount equals closedValue, not totalValue", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `FIN-10 ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: 3100,
        products: BASE_PRODUCTS,
        closedValue: 5000,
        installmentsWallet: "wallet-alpha-main",
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    await approveProposal(authenticatedPage.request, idToken, proposalId);

    const txs = await getProposalTransactions(proposalId);
    expect(txs).toHaveLength(1);
    expect((txs[0].amount as number)).toBeCloseTo(5000, 2);

    const totalAmount = txs.reduce((sum, tx) => sum + (tx.amount as number), 0);
    expect(totalAmount).toBeCloseTo(5000, 2);

    // Cleanup
    const deleteResp = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(deleteResp.status());
  });
});

// ─── FIN-11: Down payment % + installments from closedValue ───────────────────

test.describe("FIN-11: Down payment percentage + installments derived from closedValue", () => {
  test("FIN-11: 4 transactions total, amounts derived from closedValue 6000 with 30% down", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `FIN-11 ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: 3100,
        products: BASE_PRODUCTS,
        closedValue: 6000,
        downPaymentEnabled: true,
        downPaymentType: "percentage",
        downPaymentPercentage: 30,
        installmentsEnabled: true,
        installmentsCount: 3,
        downPaymentWallet: "wallet-alpha-main",
        installmentsWallet: "wallet-alpha-main",
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    await approveProposal(authenticatedPage.request, idToken, proposalId);

    const txs = await getProposalTransactions(proposalId);
    // 1 down payment + 3 installments
    expect(txs).toHaveLength(4);

    const totalAmount = txs.reduce((sum, tx) => sum + (tx.amount as number), 0);
    expect(totalAmount).toBeCloseTo(6000, 2);

    // Down payment = 6000 * 30% = 1800
    const downPaymentTxs = txs.filter((tx) => !tx.isInstallment);
    expect(downPaymentTxs).toHaveLength(1);
    expect((downPaymentTxs[0].amount as number)).toBeCloseTo(1800, 2);

    // Each installment = (6000 - 1800) / 3 = 1400
    const installmentTxs = txs.filter((tx) => tx.isInstallment === true);
    expect(installmentTxs).toHaveLength(3);
    for (const tx of installmentTxs) {
      expect((tx.amount as number)).toBeCloseTo(1400, 2);
    }

    // Verify proposal doc updated with computed values
    const proposalData = await getProposalDoc(proposalId);
    expect((proposalData.installmentValue as number)).toBeCloseTo(1400, 2);
    expect((proposalData.downPaymentValue as number)).toBeCloseTo(1800, 2);

    // Cleanup
    const deleteResp = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(deleteResp.status());
  });
});

// ─── FIN-12: Fixed down payment + installments ────────────────────────────────

test.describe("FIN-12: Fixed down payment + installments derived from closedValue", () => {
  test("FIN-12: 6 transactions total, fixed 1000 down + 5 installments of 1000 from closedValue 6000", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `FIN-12 ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: 3100,
        products: BASE_PRODUCTS,
        closedValue: 6000,
        downPaymentEnabled: true,
        downPaymentType: "fixed",
        downPaymentValue: 1000,
        installmentsEnabled: true,
        installmentsCount: 5,
        downPaymentWallet: "wallet-alpha-main",
        installmentsWallet: "wallet-alpha-main",
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    await approveProposal(authenticatedPage.request, idToken, proposalId);

    const txs = await getProposalTransactions(proposalId);
    // 1 down payment + 5 installments
    expect(txs).toHaveLength(6);

    const totalAmount = txs.reduce((sum, tx) => sum + (tx.amount as number), 0);
    expect(totalAmount).toBeCloseTo(6000, 2);

    // Down payment = 1000 (fixed, within closedValue limit)
    const downPaymentTxs = txs.filter((tx) => !tx.isInstallment);
    expect(downPaymentTxs).toHaveLength(1);
    expect((downPaymentTxs[0].amount as number)).toBeCloseTo(1000, 2);

    // Each installment = (6000 - 1000) / 5 = 1000
    const installmentTxs = txs.filter((tx) => tx.isInstallment === true);
    expect(installmentTxs).toHaveLength(5);
    for (const tx of installmentTxs) {
      expect((tx.amount as number)).toBeCloseTo(1000, 2);
    }

    // Proposal doc: installmentValue updated
    const proposalData = await getProposalDoc(proposalId);
    expect((proposalData.installmentValue as number)).toBeCloseTo(1000, 2);

    // Cleanup
    const deleteResp = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(deleteResp.status());
  });
});

// ─── FIN-13: Only installments (no down payment) ──────────────────────────────

test.describe("FIN-13: Only installments, no down payment, closedValue override", () => {
  test("FIN-13: 4 installment transactions of 2000 each from closedValue 8000", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `FIN-13 ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: 3100,
        products: BASE_PRODUCTS,
        closedValue: 8000,
        downPaymentEnabled: false,
        installmentsEnabled: true,
        installmentsCount: 4,
        installmentsWallet: "wallet-alpha-main",
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    await approveProposal(authenticatedPage.request, idToken, proposalId);

    const txs = await getProposalTransactions(proposalId);
    expect(txs).toHaveLength(4);

    // All transactions must be installments
    for (const tx of txs) {
      expect(tx.isInstallment).toBe(true);
    }

    const totalAmount = txs.reduce((sum, tx) => sum + (tx.amount as number), 0);
    expect(totalAmount).toBeCloseTo(8000, 2);

    // Each = 8000 / 4 = 2000
    for (const tx of txs) {
      expect((tx.amount as number)).toBeCloseTo(2000, 2);
    }

    // Proposal doc: installmentValue updated
    const proposalData = await getProposalDoc(proposalId);
    expect((proposalData.installmentValue as number)).toBeCloseTo(2000, 2);

    // Cleanup
    const deleteResp = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(deleteResp.status());
  });
});

// ─── FIN-14: Only down payment (no installments) ──────────────────────────────

test.describe("FIN-14: Only down payment, no installments, closedValue override", () => {
  test("FIN-14: single down payment transaction of 3500 from closedValue 3500", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `FIN-14 ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: 3100,
        products: BASE_PRODUCTS,
        closedValue: 3500,
        downPaymentEnabled: true,
        downPaymentType: "fixed",
        downPaymentValue: 3500,
        installmentsEnabled: false,
        downPaymentWallet: "wallet-alpha-main",
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    await approveProposal(authenticatedPage.request, idToken, proposalId);

    const txs = await getProposalTransactions(proposalId);
    expect(txs).toHaveLength(1);
    expect((txs[0].amount as number)).toBeCloseTo(3500, 2);

    // Down payment — must carry isDownPayment and must not carry isInstallment
    expect(txs[0].isDownPayment).toBe(true);
    expect(txs[0].isInstallment).toBeFalsy();
    // When entry equals the full amount (no remaining balance), no groupId is needed
    expect(txs[0].proposalGroupId).toBeNull();

    const totalAmount = txs.reduce((sum, tx) => sum + (tx.amount as number), 0);
    expect(totalAmount).toBeCloseTo(3500, 2);

    // Cleanup
    const deleteResp = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(deleteResp.status());
  });
});

// ─── FIN-15: Fixed down payment capped by closedValue ─────────────────────────

test.describe("FIN-15: Fixed down payment capped by closedValue (persistence guard fix)", () => {
  test("FIN-15: downPaymentValue 10000 is capped to closedValue 5000; proposal doc updated", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `FIN-15 ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: 3100,
        products: BASE_PRODUCTS,
        closedValue: 5000,
        downPaymentEnabled: true,
        downPaymentType: "fixed",
        downPaymentValue: 10000,
        installmentsEnabled: false,
        downPaymentWallet: "wallet-alpha-main",
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    await approveProposal(authenticatedPage.request, idToken, proposalId);

    const txs = await getProposalTransactions(proposalId);
    expect(txs).toHaveLength(1);

    // Math.min(10000, 5000) = 5000 — the cap must be applied
    expect((txs[0].amount as number)).toBeCloseTo(5000, 2);
    expect(txs[0].isInstallment).toBeFalsy();

    // Proposal doc: downPaymentValue written back as 5000 (persistence guard)
    const proposalData = await getProposalDoc(proposalId);
    expect((proposalData.downPaymentValue as number)).toBeCloseTo(5000, 2);

    // Cleanup
    const deleteResp = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(deleteResp.status());
  });
});

// ─── FIN-16: Re-approval after revert to draft ────────────────────────────────

test.describe("FIN-16: Re-approval after reverting to draft with updated closedValue", () => {
  test("FIN-16: after revert + closedValue update, re-approval creates new transaction and removes old one", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `FIN-16 ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: 3100,
        products: BASE_PRODUCTS,
        closedValue: 4000,
        installmentsWallet: "wallet-alpha-main",
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    // First approval
    await approveProposal(authenticatedPage.request, idToken, proposalId);

    const txsAfterFirst = await getProposalTransactions(proposalId);
    expect(txsAfterFirst).toHaveLength(1);
    expect((txsAfterFirst[0].amount as number)).toBeCloseTo(4000, 2);

    // Revert to draft
    const revertResp = await authenticatedPage.request.put(
      `/api/backend/v1/proposals/${proposalId}`,
      {
        headers: { Authorization: `Bearer ${idToken}` },
        data: { status: "draft" },
      },
    );
    expect(revertResp.status()).toBe(200);

    // Update closedValue to 6000
    const updateResp = await authenticatedPage.request.put(
      `/api/backend/v1/proposals/${proposalId}`,
      {
        headers: { Authorization: `Bearer ${idToken}` },
        data: { closedValue: 6000 },
      },
    );
    expect(updateResp.status()).toBe(200);

    // Re-approve
    await approveProposal(authenticatedPage.request, idToken, proposalId);

    // Must have exactly 1 transaction — the old 4000 gone, new 6000 in its place
    const txsAfterSecond = await getProposalTransactions(proposalId);
    expect(txsAfterSecond).toHaveLength(1);
    expect((txsAfterSecond[0].amount as number)).toBeCloseTo(6000, 2);

    // Cleanup
    const deleteResp = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(deleteResp.status());
  });
});

// ─── FIN-17: Regression — no closedValue uses totalValue ──────────────────────

test.describe("FIN-17: Regression — omitted closedValue falls back to totalValue", () => {
  test("FIN-17: proposal without closedValue creates single transaction of totalValue 3100", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `FIN-17 ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: 3100,
        products: BASE_PRODUCTS,
        closedValue: null,
        installmentsWallet: "wallet-alpha-main",
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    await approveProposal(authenticatedPage.request, idToken, proposalId);

    const txs = await getProposalTransactions(proposalId);
    expect(txs).toHaveLength(1);
    expect((txs[0].amount as number)).toBeCloseTo(3100, 2);

    // Cleanup
    const deleteResp = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(deleteResp.status());
  });
});

// ─── FIN-18: Regression — down payment % with no closedValue uses totalValue ──

test.describe("FIN-18: Regression — down payment percentage without closedValue uses totalValue", () => {
  test("FIN-18: 3 transactions from totalValue 4000 with 25% down + 2 installments", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `FIN-18 ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: 4000,
        products: BASE_PRODUCTS,
        closedValue: null,
        downPaymentEnabled: true,
        downPaymentType: "percentage",
        downPaymentPercentage: 25,
        installmentsEnabled: true,
        installmentsCount: 2,
        downPaymentWallet: "wallet-alpha-main",
        installmentsWallet: "wallet-alpha-main",
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    await approveProposal(authenticatedPage.request, idToken, proposalId);

    const txs = await getProposalTransactions(proposalId);
    // 1 down payment + 2 installments
    expect(txs).toHaveLength(3);

    const totalAmount = txs.reduce((sum, tx) => sum + (tx.amount as number), 0);
    expect(totalAmount).toBeCloseTo(4000, 2);

    // Down payment = 4000 * 25% = 1000
    const downPaymentTxs = txs.filter((tx) => !tx.isInstallment);
    expect(downPaymentTxs).toHaveLength(1);
    expect((downPaymentTxs[0].amount as number)).toBeCloseTo(1000, 2);

    // Each installment = (4000 - 1000) / 2 = 1500
    const installmentTxs = txs.filter((tx) => tx.isInstallment === true);
    expect(installmentTxs).toHaveLength(2);
    for (const tx of installmentTxs) {
      expect((tx.amount as number)).toBeCloseTo(1500, 2);
    }

    // Cleanup
    const deleteResp = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(deleteResp.status());
  });
});

// ─── FIN-19: Entry % + no installments + closedValue ──────────────────────────

test.describe("FIN-19: Entry percentage + no installments with closedValue override", () => {
  test("FIN-19: 2 transactions — 25% entry of closedValue 4000 + remaining saldo 3000", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `FIN-19 ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: 3100,
        products: BASE_PRODUCTS,
        closedValue: 4000,
        downPaymentEnabled: true,
        downPaymentType: "percentage",
        downPaymentPercentage: 25,
        installmentsEnabled: false,
        downPaymentWallet: "wallet-alpha-main",
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    await approveProposal(authenticatedPage.request, idToken, proposalId);

    const txs = await getProposalTransactions(proposalId);
    // 1 down payment (25% of 4000 = 1000) + 1 saldo (3000)
    expect(txs).toHaveLength(2);

    const totalAmount = txs.reduce((sum, tx) => sum + (tx.amount as number), 0);
    expect(totalAmount).toBeCloseTo(4000, 2);

    const fin19DownPaymentTxs = txs.filter((tx) => tx.isDownPayment === true);
    expect(fin19DownPaymentTxs).toHaveLength(1);
    expect((fin19DownPaymentTxs[0].amount as number)).toBeCloseTo(1000, 2);

    const fin19SingleTxs = txs.filter((tx) => !tx.isDownPayment && !tx.isInstallment);
    expect(fin19SingleTxs).toHaveLength(1);
    expect((fin19SingleTxs[0].amount as number)).toBeCloseTo(3000, 2);

    // Both transactions must share the same proposalGroupId
    const fin19GroupId = fin19DownPaymentTxs[0].proposalGroupId;
    expect(fin19GroupId).not.toBeNull();
    expect(fin19SingleTxs[0].proposalGroupId).toBe(fin19GroupId);

    // Cleanup
    const fin19Delete = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(fin19Delete.status());
  });
});

// ─── FIN-20: Exact bug case — fixed entry + no installments + totalValue only ──

test.describe("FIN-20: Bug regression — fixed entry without installments creates entry + saldo", () => {
  test("FIN-20: entry 2000 + saldo 8000 — both appear; sum equals totalValue 10000", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `FIN-20 ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: 10000,
        products: BASE_PRODUCTS,
        closedValue: null,
        downPaymentEnabled: true,
        downPaymentType: "fixed",
        downPaymentValue: 2000,
        installmentsEnabled: false,
        downPaymentWallet: "wallet-alpha-main",
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    await approveProposal(authenticatedPage.request, idToken, proposalId);

    const txs = await getProposalTransactions(proposalId);
    // Pre-fix: only 1 tx (entry). Post-fix: 2 txs (entry + saldo).
    expect(txs).toHaveLength(2);

    const totalAmount = txs.reduce((sum, tx) => sum + (tx.amount as number), 0);
    expect(totalAmount).toBeCloseTo(10000, 2);

    const fin20DownPaymentTxs = txs.filter((tx) => tx.isDownPayment === true);
    expect(fin20DownPaymentTxs).toHaveLength(1);
    expect((fin20DownPaymentTxs[0].amount as number)).toBeCloseTo(2000, 2);

    const fin20SingleTxs = txs.filter((tx) => !tx.isDownPayment && !tx.isInstallment);
    expect(fin20SingleTxs).toHaveLength(1);
    expect((fin20SingleTxs[0].amount as number)).toBeCloseTo(8000, 2);

    // Both must be linked via the same proposalGroupId
    const fin20GroupId = fin20DownPaymentTxs[0].proposalGroupId;
    expect(fin20GroupId).not.toBeNull();
    expect(fin20SingleTxs[0].proposalGroupId).toBe(fin20GroupId);

    // Cleanup
    const fin20Delete = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(fin20Delete.status());
  });
});

// ─── FIN-21: Bug 1 — clearing closedValue reverts totalValue to product subtotal

test.describe("FIN-21: Bug 1 — explicit closedValue:null in update reverts totalValue to product subtotal", () => {
  test("FIN-21: after update with closedValue:null, proposal.totalValue equals product subtotal (not original closedValue)", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `FIN-21 ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: 3100,
        products: BASE_PRODUCTS,
        closedValue: 5000,
        installmentsWallet: "wallet-alpha-main",
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    // Explicitly clear closedValue while re-submitting products — triggers Bug 1 path
    const updateResp = await authenticatedPage.request.put(
      `/api/backend/v1/proposals/${proposalId}`,
      {
        headers: { Authorization: `Bearer ${idToken}` },
        data: { products: BASE_PRODUCTS, closedValue: null },
      },
    );
    expect(updateResp.status()).toBe(200);

    const proposalDoc = await getProposalDoc(proposalId);
    const expectedSubtotal = BASE_PRODUCTS.reduce((sum, p) => sum + (p.total as number), 0);
    // With closedValue cleared, totalValue must revert to the computed product subtotal
    expect((proposalDoc.totalValue as number)).toBeCloseTo(expectedSubtotal, 2);
    expect((proposalDoc.totalValue as number)).not.toBeCloseTo(5000, 0);

    // Cleanup
    const fin21Delete = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(fin21Delete.status());
  });
});

// ─── FIN-22: Bug 1 — omitting closedValue preserves existing closedValue ───────

test.describe("FIN-22: Bug 1 — product update without closedValue in payload preserves existing closedValue", () => {
  test("FIN-22: after product-only update, proposal.totalValue remains equal to existing closedValue 8000", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `FIN-22 ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: 3100,
        products: BASE_PRODUCTS,
        closedValue: 8000,
        installmentsWallet: "wallet-alpha-main",
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    // Update products without sending closedValue — Bug 1 would have overwritten totalValue
    const updateResp = await authenticatedPage.request.put(
      `/api/backend/v1/proposals/${proposalId}`,
      {
        headers: { Authorization: `Bearer ${idToken}` },
        data: { products: BASE_PRODUCTS },
      },
    );
    expect(updateResp.status()).toBe(200);

    const proposalDoc = await getProposalDoc(proposalId);
    // closedValue not in payload → must preserve existing closedValue (8000) as totalValue
    expect((proposalDoc.totalValue as number)).toBeCloseTo(8000, 2);

    // Cleanup
    const fin22Delete = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(fin22Delete.status());
  });
});

// ─── FIN-23: Re-approval: entry+saldo → entry+installments ────────────────────

test.describe("FIN-23: Re-approval — switching from entry+saldo to entry+installments", () => {
  test("FIN-23: after revert + re-approval with installments, 0 singles remain; 3 installments created", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `FIN-23 ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: 10000,
        products: BASE_PRODUCTS,
        closedValue: null,
        downPaymentEnabled: true,
        downPaymentType: "fixed",
        downPaymentValue: 2000,
        installmentsEnabled: false,
        downPaymentWallet: "wallet-alpha-main",
        installmentsWallet: "wallet-alpha-main",
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    // First approval: entry 2000 + saldo 8000
    await approveProposal(authenticatedPage.request, idToken, proposalId);
    const txsAfterFirst = await getProposalTransactions(proposalId);
    expect(txsAfterFirst).toHaveLength(2);

    // Revert to draft
    const fin23Revert = await authenticatedPage.request.put(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` }, data: { status: "draft" } },
    );
    expect(fin23Revert.status()).toBe(200);

    // Switch to installments (3 parcelas)
    const fin23Update = await authenticatedPage.request.put(
      `/api/backend/v1/proposals/${proposalId}`,
      {
        headers: { Authorization: `Bearer ${idToken}` },
        data: { installmentsEnabled: true, installmentsCount: 3 },
      },
    );
    expect(fin23Update.status()).toBe(200);

    // Re-approve
    await approveProposal(authenticatedPage.request, idToken, proposalId);

    const txsAfterSecond = await getProposalTransactions(proposalId);
    // 1 down payment + 3 installments; 0 singles
    expect(txsAfterSecond).toHaveLength(4);

    const fin23DownPaymentTxs = txsAfterSecond.filter((tx) => tx.isDownPayment === true);
    expect(fin23DownPaymentTxs).toHaveLength(1);
    expect((fin23DownPaymentTxs[0].amount as number)).toBeCloseTo(2000, 2);

    const fin23InstallmentTxs = txsAfterSecond.filter((tx) => tx.isInstallment === true);
    expect(fin23InstallmentTxs).toHaveLength(3);
    // Each installment = (10000 - 2000) / 3 ≈ 2666.67
    for (const tx of fin23InstallmentTxs) {
      expect((tx.amount as number)).toBeCloseTo(8000 / 3, 2);
    }

    const fin23SingleTxs = txsAfterSecond.filter((tx) => !tx.isDownPayment && !tx.isInstallment);
    expect(fin23SingleTxs).toHaveLength(0);

    const fin23Total = txsAfterSecond.reduce((sum, tx) => sum + (tx.amount as number), 0);
    expect(fin23Total).toBeCloseTo(10000, 2);

    // Cleanup
    const fin23Delete = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(fin23Delete.status());
  });
});

// ─── FIN-24: Re-approval: entry+installments → entry+saldo ────────────────────

test.describe("FIN-24: Re-approval — switching from entry+installments to entry+saldo", () => {
  test("FIN-24: after revert + re-approval without installments, 0 installments remain; 1 saldo created", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `FIN-24 ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: 7000,
        products: BASE_PRODUCTS,
        closedValue: null,
        downPaymentEnabled: true,
        downPaymentType: "fixed",
        downPaymentValue: 1000,
        installmentsEnabled: true,
        installmentsCount: 3,
        downPaymentWallet: "wallet-alpha-main",
        installmentsWallet: "wallet-alpha-main",
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    // First approval: entry 1000 + 3 installments of 2000
    await approveProposal(authenticatedPage.request, idToken, proposalId);
    const txsAfterFirst = await getProposalTransactions(proposalId);
    expect(txsAfterFirst).toHaveLength(4);

    // Revert to draft
    const fin24Revert = await authenticatedPage.request.put(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` }, data: { status: "draft" } },
    );
    expect(fin24Revert.status()).toBe(200);

    // Switch to no installments
    const fin24Update = await authenticatedPage.request.put(
      `/api/backend/v1/proposals/${proposalId}`,
      {
        headers: { Authorization: `Bearer ${idToken}` },
        data: { installmentsEnabled: false, installmentsCount: 0 },
      },
    );
    expect(fin24Update.status()).toBe(200);

    // Re-approve
    await approveProposal(authenticatedPage.request, idToken, proposalId);

    const txsAfterSecond = await getProposalTransactions(proposalId);
    // 1 down payment + 1 saldo; 0 installments
    expect(txsAfterSecond).toHaveLength(2);

    const fin24DownPaymentTxs = txsAfterSecond.filter((tx) => tx.isDownPayment === true);
    expect(fin24DownPaymentTxs).toHaveLength(1);
    expect((fin24DownPaymentTxs[0].amount as number)).toBeCloseTo(1000, 2);

    const fin24SingleTxs = txsAfterSecond.filter((tx) => !tx.isDownPayment && !tx.isInstallment);
    expect(fin24SingleTxs).toHaveLength(1);
    expect((fin24SingleTxs[0].amount as number)).toBeCloseTo(6000, 2);

    const fin24InstallmentTxs = txsAfterSecond.filter((tx) => tx.isInstallment === true);
    expect(fin24InstallmentTxs).toHaveLength(0);

    const fin24Total = txsAfterSecond.reduce((sum, tx) => sum + (tx.amount as number), 0);
    expect(fin24Total).toBeCloseTo(7000, 2);

    // Cleanup
    const fin24Delete = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(fin24Delete.status());
  });
});

// ─── FIN-25: Regression for FIN-14 — entry with remaining saldo > 0 ───────────

test.describe("FIN-25: Regression — fixed entry with remaining balance (saldo > 0) creates 2 transactions", () => {
  test("FIN-25: entry 200 + saldo 800 both appear; sum equals totalValue 1000", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `FIN-25 ${timestamp}`,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: 1000,
        products: BASE_PRODUCTS,
        closedValue: null,
        downPaymentEnabled: true,
        downPaymentType: "fixed",
        downPaymentValue: 200,
        installmentsEnabled: false,
        downPaymentWallet: "wallet-alpha-main",
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    await approveProposal(authenticatedPage.request, idToken, proposalId);

    const txs = await getProposalTransactions(proposalId);
    // The bug: only 1 tx (entry). The fix: 2 txs (entry + saldo).
    expect(txs).toHaveLength(2);

    const totalAmount = txs.reduce((sum, tx) => sum + (tx.amount as number), 0);
    expect(totalAmount).toBeCloseTo(1000, 2);

    const fin25DownPaymentTxs = txs.filter((tx) => tx.isDownPayment === true);
    expect(fin25DownPaymentTxs).toHaveLength(1);
    expect((fin25DownPaymentTxs[0].amount as number)).toBeCloseTo(200, 2);

    const fin25SingleTxs = txs.filter((tx) => !tx.isDownPayment && !tx.isInstallment);
    expect(fin25SingleTxs).toHaveLength(1);
    expect((fin25SingleTxs[0].amount as number)).toBeCloseTo(800, 2);

    // Both must be linked via proposalGroupId
    const fin25GroupId = fin25DownPaymentTxs[0].proposalGroupId;
    expect(fin25GroupId).not.toBeNull();
    expect(fin25SingleTxs[0].proposalGroupId).toBe(fin25GroupId);

    // Cleanup
    const fin25Delete = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(fin25Delete.status());
  });
});
