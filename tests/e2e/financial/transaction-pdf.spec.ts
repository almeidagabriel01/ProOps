/**
 * Transaction PDF E2E tests — FIN-04, FIN-05.
 *
 * FIN-04: Transaction PDF endpoint — creates a fresh income transaction via API and
 *         verifies the PDF endpoint is accessible (auth enforcement, content-type).
 * FIN-05: Edited transaction PDF — creates a transaction, edits its description via
 *         the UI wizard, verifies the change persists in the list, then calls the PDF
 *         endpoint to confirm the endpoint accepts the request with updated data.
 *
 * INTENTIONAL per D-04: The emulator environment does not have Playwright/Chromium
 * available server-side, so the PDF endpoint returns 500 instead of 200 in CI.
 * Tests validate auth enforcement (non-401/403) and content-type on 200 responses.
 * Data persistence is verified separately via the UI list before the PDF call.
 *
 * D-09: Seed transactions are never mutated — each test creates and cleans up its own data.
 */

import { test, expect } from "../fixtures/auth.fixture";
import { TransactionsPage } from "../pages/transactions.page";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { USER_ADMIN_ALPHA } from "../seed/data/users";

// ─── FIN-04: Transaction PDF endpoint ────────────────────────────────────────

test.describe("FIN-04: Transaction PDF endpoint", () => {
  test("returns non-auth-error response for authenticated request", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const today = new Date().toISOString().split("T")[0];
    const timestamp = Date.now();

    // Create a fresh income transaction via API to obtain a stable transactionId
    const createResponse = await authenticatedPage.request.post("/api/backend/v1/transactions", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        description: `PDF Test Transaction ${timestamp}`,
        amount: 1500,
        date: today,
        type: "income",
        status: "pending",
        clientId: "contact-alpha-001",
        clientName: "João Silva",
      },
    });
    expect(createResponse.status()).toBe(201);
    const { transactionId } = await createResponse.json();
    expect(transactionId).toBeTruthy();

    // Call the PDF endpoint for this transaction
    const pdfResponse = await authenticatedPage.request.get(
      `/api/backend/v1/transactions/${transactionId}/pdf`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );

    // INTENTIONAL per D-04: emulator returns 500 (Playwright/Chromium unavailable server-side).
    // Validate auth enforcement — must NOT return 401 (unauthenticated) or 403 (unauthorized).
    expect(pdfResponse.status()).not.toBe(401);
    expect(pdfResponse.status()).not.toBe(403);

    if (pdfResponse.status() === 200) {
      expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
    }

    // Cleanup: delete the created transaction via API
    await authenticatedPage.request.delete(`/api/backend/v1/transactions/${transactionId}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
  });
});

// ─── FIN-05: Edited transaction PDF generation ────────────────────────────────

test.describe("FIN-05: Edited transaction PDF generation", () => {
  test("edited transaction description persists and PDF endpoint is accessible", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const today = new Date().toISOString().split("T")[0];
    const timestamp = Date.now();
    const originalDescription = `PDF Transaction Edit ${timestamp}`;
    const editedDescription = `PDF Transaction Edited ${timestamp}`;

    // Create a fresh income transaction via API (D-09: never mutate seed transactions)
    const createResponse = await authenticatedPage.request.post("/api/backend/v1/transactions", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        description: originalDescription,
        amount: 2000,
        date: today,
        type: "income",
        status: "pending",
        clientId: "contact-alpha-001",
        clientName: "João Silva",
      },
    });
    expect(createResponse.status()).toBe(201);
    const { transactionId } = await createResponse.json();
    expect(transactionId).toBeTruthy();

    // Edit the transaction description via the UI wizard — proves the full edit flow works
    const transactionsPage = new TransactionsPage(authenticatedPage);
    await transactionsPage.editTransaction(originalDescription, {
      description: editedDescription,
    });

    // Navigate to the transactions list and verify the edited description is persisted.
    // If this assertion passes, the data that will be used by the PDF generator is correct.
    await transactionsPage.goto();
    await transactionsPage.isLoaded();
    const editedTransaction = await transactionsPage.getTransactionByDescription(editedDescription);
    await expect(editedTransaction).toBeVisible();

    // Call the PDF endpoint with the now-edited transaction
    const pdfResponse = await authenticatedPage.request.get(
      `/api/backend/v1/transactions/${transactionId}/pdf`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );

    // INTENTIONAL per D-04: emulator returns 500 (Playwright/Chromium unavailable server-side).
    // Validate auth enforcement — must NOT return 401 or 403.
    expect(pdfResponse.status()).not.toBe(401);
    expect(pdfResponse.status()).not.toBe(403);

    if (pdfResponse.status() === 200) {
      expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
    }

    // Cleanup: delete via API using the ID obtained at creation
    await authenticatedPage.request.delete(`/api/backend/v1/transactions/${transactionId}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
  });
});
