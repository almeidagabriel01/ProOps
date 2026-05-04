/**
 * FIN-09: Proposal approval → transaction sync E2E test.
 *
 * Validates that approving a proposal triggers syncApprovedProposalTransactions
 * and the resulting income transaction appears in the financial module.
 *
 * Flow (per D-08/D-09/D-10/D-11/D-12):
 *  1. Create a simple single-payment proposal via API (status: "draft").
 *  2. Transition draft → sent via API (required before approval).
 *  3. Transition sent → approved via API — triggers syncApprovedProposalTransactions synchronously.
 *  4. Navigate to /transactions and verify the synced transaction is visible by title match.
 *  5. Cleanup: delete proposal via API (cascade-deletes synced transactions if controller handles it;
 *     otherwise also delete the synced transaction via UI).
 */

import { test, expect } from "../fixtures/auth.fixture";
import { TransactionsPage } from "../pages/transactions.page";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { USER_ADMIN_ALPHA } from "../seed/data/users";
import { PROPOSAL_ALPHA_DRAFT } from "../seed/data/proposals";

test.describe("FIN-09: Proposal approval → transaction sync", () => {
  test("approving a proposal creates a matching income transaction in the financial module", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const proposalTitle = `FIN-09 Sync Test ${timestamp}`;

    // Step 1: Create a fresh draft proposal via API.
    // Use PROPOSAL_ALPHA_DRAFT fields for client/items — simple single-item, no installments.
    const createResponse = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: proposalTitle,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: PROPOSAL_ALPHA_DRAFT.total,
        products: PROPOSAL_ALPHA_DRAFT.items.map((item) => ({
          id: item.productId,
          name: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
      },
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const proposalId = createData.proposalId;
    expect(proposalId).toBeTruthy();

    // Step 2: Transition draft → sent (required before approval — controller validates transition).
    const sentResponse = await authenticatedPage.request.put(
      `/api/backend/v1/proposals/${proposalId}`,
      {
        headers: { Authorization: `Bearer ${idToken}` },
        data: { status: "sent" },
      },
    );
    expect(sentResponse.status()).toBe(200);

    // Step 3: Transition sent → approved — triggers syncApprovedProposalTransactions.
    // The sync runs synchronously before the API returns 200, so no polling needed (D-09 note).
    const approveResponse = await authenticatedPage.request.put(
      `/api/backend/v1/proposals/${proposalId}`,
      {
        headers: { Authorization: `Bearer ${idToken}` },
        data: { status: "approved" },
      },
    );
    expect(approveResponse.status()).toBe(200);

    // Step 4: Navigate to /transactions and find the synced transaction.
    // normalizeProposalTransactionTitle() = trim() only — description matches the proposal title exactly.
    const transactionsPage = new TransactionsPage(authenticatedPage);
    await transactionsPage.goto();
    await transactionsPage.isLoaded();

    // The transaction may appear on the first load since sync is synchronous.
    // If not immediately visible, reload once to account for any stale frontend cache.
    let syncedItem = await transactionsPage.getTransactionByDescription(proposalTitle);
    const isVisible = await syncedItem.isVisible().catch(() => false);
    if (!isVisible) {
      await authenticatedPage.reload();
      await transactionsPage.isLoaded();
      syncedItem = await transactionsPage.getTransactionByDescription(proposalTitle);
    }

    await expect(syncedItem).toBeVisible({ timeout: 10000 });

    // Step 5: Cleanup — delete the proposal via API.
    // If the proposal controller cascades deletion to synced transactions, this is sufficient.
    const deleteProposalResponse = await authenticatedPage.request.delete(
      `/api/backend/v1/proposals/${proposalId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(deleteProposalResponse.status());

    // Verify synced transaction is also gone (cascade check).
    // Reload transactions list — if the transaction persists, delete it via UI.
    await transactionsPage.goto();
    await transactionsPage.isLoaded();
    const afterDelete = await transactionsPage.getTransactionByDescription(proposalTitle);
    const stillVisible = await afterDelete.isVisible().catch(() => false);

    if (stillVisible) {
      // Cascade did not delete it — clean up via UI delete
      await transactionsPage.deleteTransaction(proposalTitle);
    }
  });
});
