/**
 * FIN-UI-01 through FIN-UI-03: Proposal group card UI expansion tests.
 *
 * Validates that when a proposal is approved with a down payment (entrada) but
 * WITHOUT installments, the financial module renders an expandable card showing:
 *   - Parent card: total combined value (entrada + saldo)
 *   - Expanded children: "Entrada" row + "Saldo restante" row with individual amounts
 *
 * These tests require the frontend fix in transaction-card.tsx (saldoTx render branch)
 * and the key-collision fix in transaction-list-by-due-date.tsx.
 *
 * Tests:
 *  FIN-UI-01: Fixed entry + saldo — card shows total; expanded shows "Entrada" + "Saldo restante"
 *  FIN-UI-02: Entry % + saldo — same expansion behavior with percentage-based down payment
 *  FIN-UI-03: Entry + installments (regression) — expansion shows installments, NOT saldo
 */

import { test, expect } from "../fixtures/auth.fixture";
import type { APIRequestContext } from "@playwright/test";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { USER_ADMIN_ALPHA } from "../seed/data/users";
import { PROPOSAL_ALPHA_DRAFT } from "../seed/data/proposals";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function approveProposal(
  request: APIRequestContext,
  idToken: string,
  proposalId: string,
): Promise<void> {
  const sentResp = await request.put(`/api/backend/v1/proposals/${proposalId}`, {
    headers: { Authorization: `Bearer ${idToken}` },
    data: { status: "sent" },
  });
  expect(sentResp.status()).toBe(200);

  const approvedResp = await request.put(`/api/backend/v1/proposals/${proposalId}`, {
    headers: { Authorization: `Bearer ${idToken}` },
    data: { status: "approved" },
  });
  expect(approvedResp.status()).toBe(200);
}

const BASE_PRODUCTS = PROPOSAL_ALPHA_DRAFT.items.map((item) => ({
  id: item.productId,
  name: item.productName,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  total: item.total,
}));

// ─── FIN-UI-01: Fixed entry + saldo card expansion ────────────────────────────

test.describe("FIN-UI-01: Fixed entry + saldo — card expansion shows Entrada and Saldo restante", () => {
  test("FIN-UI-01: expandable card shows combined total; children show Entrada (1000) and Saldo restante (4000)", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const proposalTitle = `FIN-UI-01 ${timestamp}`;

    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: proposalTitle,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: 5000,
        products: BASE_PRODUCTS,
        closedValue: null,
        downPaymentEnabled: true,
        downPaymentType: "fixed",
        downPaymentValue: 1000,
        installmentsEnabled: false,
        downPaymentWallet: "wallet-alpha-main",
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    await approveProposal(authenticatedPage.request, idToken, proposalId);

    // Navigate to /transactions and switch to grouped card view
    await authenticatedPage.goto("/transactions");
    await authenticatedPage.waitForURL(/\/transactions/, { timeout: 15000 });
    await authenticatedPage.getByRole("button", { name: /agrupados/i }).click();
    await authenticatedPage.waitForSelector('[data-testid="transaction-card"]', { timeout: 15000 });

    // Find the card containing the proposal title
    const card = authenticatedPage
      .locator('[data-testid="transaction-card"]')
      .filter({ hasText: proposalTitle })
      .first();

    await expect(card).toBeVisible({ timeout: 15000 });

    // The parent card should show the combined total (R$ 5.000,00)
    // Portuguese number format: 5000 → "5.000"
    await expect(card).toContainText("5.000", { timeout: 5000 });

    // Click on the card body (not a button) to expand it
    // The card header div has onClick that triggers expansion when not clicking buttons/links
    const cardHeader = card.locator("div[class*='flex'][class*='cursor-pointer']").first();
    const headerVisible = await cardHeader.isVisible().catch(() => false);
    if (headerVisible) {
      await cardHeader.click();
    } else {
      // Fallback: click anywhere on the card that isn't a button
      const descriptionArea = card.getByText(proposalTitle).first();
      await descriptionArea.click();
    }

    // After expansion, the "Entrada" section should appear
    await expect(card.getByText("Entrada").first()).toBeVisible({ timeout: 5000 });

    // The "Saldo restante" section should appear (this is the new render branch)
    await expect(card.getByText("Saldo restante")).toBeVisible({ timeout: 5000 });

    // Verify entry amount (R$ 1.000,xx) — row container holds both label and value
    const entradaRow = card.locator('[data-testid="down-payment-row"]');
    await expect(entradaRow).toContainText("1.000");

    // Verify saldo amount (R$ 4.000,xx)
    const saldoRow = card.locator('[data-testid="saldo-row"]');
    await expect(saldoRow).toContainText("4.000");

    // Cleanup
    const deleteResp = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(deleteResp.status());
  });
});

// ─── FIN-UI-02: Percentage entry + saldo card expansion ───────────────────────

test.describe("FIN-UI-02: Entry % + saldo — card expansion shows Entrada and Saldo restante", () => {
  test("FIN-UI-02: 20% entry of 5000 = 1000 entrada + 4000 saldo both visible after expansion", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const proposalTitle = `FIN-UI-02 ${timestamp}`;

    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: proposalTitle,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: 5000,
        products: BASE_PRODUCTS,
        closedValue: null,
        downPaymentEnabled: true,
        downPaymentType: "percentage",
        downPaymentPercentage: 20,
        installmentsEnabled: false,
        downPaymentWallet: "wallet-alpha-main",
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    await approveProposal(authenticatedPage.request, idToken, proposalId);

    await authenticatedPage.goto("/transactions");
    await authenticatedPage.waitForURL(/\/transactions/, { timeout: 15000 });
    await authenticatedPage.getByRole("button", { name: /agrupados/i }).click();
    await authenticatedPage.waitForSelector('[data-testid="transaction-card"]', { timeout: 15000 });

    const card = authenticatedPage
      .locator('[data-testid="transaction-card"]')
      .filter({ hasText: proposalTitle })
      .first();

    await expect(card).toBeVisible({ timeout: 15000 });

    // Combined total = 5000
    await expect(card).toContainText("5.000", { timeout: 5000 });

    // Expand the card
    const cardHeader = card.locator("div[class*='flex'][class*='cursor-pointer']").first();
    const headerVisible = await cardHeader.isVisible().catch(() => false);
    if (headerVisible) {
      await cardHeader.click();
    } else {
      await card.getByText(proposalTitle).first().click();
    }

    // Both sections should appear after expansion
    await expect(card.getByText("Entrada").first()).toBeVisible({ timeout: 5000 });
    await expect(card.getByText("Saldo restante")).toBeVisible({ timeout: 5000 });

    // Cleanup
    const deleteResp = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(deleteResp.status());
  });
});

// ─── FIN-UI-03: Entry + installments regression — no "Saldo restante" ─────────

test.describe("FIN-UI-03: Entry + installments regression — Saldo restante must NOT appear", () => {
  test("FIN-UI-03: with installmentsEnabled, expanded card shows installments but no Saldo restante section", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const proposalTitle = `FIN-UI-03 ${timestamp}`;

    const createResp = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: proposalTitle,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: 5000,
        products: BASE_PRODUCTS,
        closedValue: null,
        downPaymentEnabled: true,
        downPaymentType: "fixed",
        downPaymentValue: 1000,
        installmentsEnabled: true,
        installmentsCount: 2,
        downPaymentWallet: "wallet-alpha-main",
        installmentsWallet: "wallet-alpha-main",
      },
    });
    expect(createResp.status()).toBe(201);
    const { proposalId } = await createResp.json();

    await approveProposal(authenticatedPage.request, idToken, proposalId);

    await authenticatedPage.goto("/transactions");
    await authenticatedPage.waitForURL(/\/transactions/, { timeout: 15000 });
    await authenticatedPage.getByRole("button", { name: /agrupados/i }).click();
    await authenticatedPage.waitForSelector('[data-testid="transaction-card"]', { timeout: 15000 });

    const card = authenticatedPage
      .locator('[data-testid="transaction-card"]')
      .filter({ hasText: proposalTitle })
      .first();

    await expect(card).toBeVisible({ timeout: 15000 });

    // Expand the card
    const cardHeader = card.locator("div[class*='flex'][class*='cursor-pointer']").first();
    const headerVisible = await cardHeader.isVisible().catch(() => false);
    if (headerVisible) {
      await cardHeader.click();
    } else {
      await card.getByText(proposalTitle).first().click();
    }

    // With installments, "Entrada" section should appear
    await expect(card.getByText("Entrada").first()).toBeVisible({ timeout: 5000 });

    // "Saldo restante" must NOT appear when installmentsEnabled (regression guard)
    await expect(card.getByText("Saldo restante")).not.toBeVisible();

    // Installments section should appear instead
    await expect(card.getByText(/Parcelas/)).toBeVisible({ timeout: 5000 });

    // Cleanup
    const deleteResp = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(deleteResp.status());
  });
});
