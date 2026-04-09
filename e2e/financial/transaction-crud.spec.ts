/**
 * Transaction CRUD E2E tests — FIN-01, FIN-02, FIN-03.
 *
 * FIN-01: Create transaction — drives the full 4-step UI wizard and verifies the
 *         transaction appears in the list after creation.
 * FIN-02: Edit transaction — creates a transaction, edits its description, and
 *         verifies the change persists in the list.
 * FIN-03: Delete transaction — creates a transaction, deletes it, and verifies it
 *         disappears from the list.
 *
 * All tests follow the create-then-delete isolation pattern per D-03:
 * - Each test creates its own data and cleans up after itself.
 * - Seeded TRANSACTION_ALPHA_INCOME / TRANSACTION_ALPHA_EXPENSE are never mutated (D-09).
 * - Date.now() in descriptions prevents collisions between parallel test runs.
 */

import { test, expect } from "../fixtures/auth.fixture";
import { TransactionsPage } from "../pages/transactions.page";

// ─── FIN-01: Create transaction ───────────────────────────────────────────────

test.describe("FIN-01: Create transaction", () => {
  test("creates an income transaction via UI wizard and it appears in the list", async ({ authenticatedPage }) => {
    const transactionsPage = new TransactionsPage(authenticatedPage);
    await transactionsPage.goto();
    await transactionsPage.isLoaded();

    const testDescription = `Test Income ${Date.now()}`;

    await transactionsPage.createTransaction({
      type: "income",
      description: testDescription,
      amount: "1500.00",
      walletName: "Conta Principal",
    });

    // Navigate back to transactions list (createTransaction redirects away from /new)
    await transactionsPage.goto();
    await transactionsPage.isLoaded();

    // Assert the new transaction appears in the list
    const item = await transactionsPage.getTransactionByDescription(testDescription);
    await expect(item).toBeVisible();

    // Cleanup: delete the created transaction (create-then-delete per D-03)
    await transactionsPage.deleteTransaction(testDescription);
  });
});

// ─── FIN-02: Edit transaction ─────────────────────────────────────────────────

test.describe("FIN-02: Edit transaction", () => {
  test("edits an income transaction description and the change persists in the list", async ({ authenticatedPage }) => {
    const transactionsPage = new TransactionsPage(authenticatedPage);
    await transactionsPage.goto();
    await transactionsPage.isLoaded();

    // Create a fresh transaction to edit (create-then-delete pattern per D-03)
    const originalDescription = `Edit Target ${Date.now()}`;
    await transactionsPage.createTransaction({
      type: "income",
      description: originalDescription,
      amount: "2000.00",
      walletName: "Conta Principal",
    });

    // Navigate back to list and verify the original transaction is visible
    await transactionsPage.goto();
    await transactionsPage.isLoaded();

    const beforeEdit = await transactionsPage.getTransactionByDescription(originalDescription);
    await expect(beforeEdit).toBeVisible();

    // Edit the transaction description
    const editedDescription = `Edited Transaction ${Date.now()}`;
    await transactionsPage.editTransaction(originalDescription, {
      description: editedDescription,
    });

    // Navigate back to list and verify the edited description appears
    await transactionsPage.goto();
    await transactionsPage.isLoaded();

    const afterEdit = await transactionsPage.getTransactionByDescription(editedDescription);
    await expect(afterEdit).toBeVisible();

    // Cleanup: delete the edited transaction
    await transactionsPage.deleteTransaction(editedDescription);
  });
});

// ─── FIN-03: Delete transaction ───────────────────────────────────────────────

test.describe("FIN-03: Delete transaction", () => {
  test("deletes an income transaction and it disappears from the list", async ({ authenticatedPage }) => {
    const transactionsPage = new TransactionsPage(authenticatedPage);
    await transactionsPage.goto();
    await transactionsPage.isLoaded();

    // Create a fresh transaction to delete (create-then-delete pattern per D-03)
    const deleteDescription = `Delete Target ${Date.now()}`;
    await transactionsPage.createTransaction({
      type: "income",
      description: deleteDescription,
      amount: "500.00",
      walletName: "Conta Principal",
    });

    // Navigate back to the transactions list
    await transactionsPage.goto();
    await transactionsPage.isLoaded();

    // Verify the transaction is visible before deletion
    const before = await transactionsPage.getTransactionByDescription(deleteDescription);
    await expect(before).toBeVisible();

    // Delete the transaction through the UI
    await transactionsPage.deleteTransaction(deleteDescription);

    // Verify the page remains on /transactions after deletion
    await expect(authenticatedPage).toHaveURL(/\/transactions/);

    // Verify the transaction is no longer visible in the list
    const after = await transactionsPage.getTransactionByDescription(deleteDescription);
    await expect(after).not.toBeVisible();
  });
});

// ─── FIN-07: Expense CRUD ─────────────────────────────────────────────────────

test.describe("FIN-07-A: Create expense transaction", () => {
  test("creates an expense transaction via UI wizard and it appears in the list", async ({ authenticatedPage }) => {
    const transactionsPage = new TransactionsPage(authenticatedPage);
    await transactionsPage.goto();
    await transactionsPage.isLoaded();

    const testDescription = `Test Expense ${Date.now()}`;

    await transactionsPage.createTransaction({
      type: "expense",
      description: testDescription,
      amount: "750.00",
      walletName: "Conta Principal",
    });

    await transactionsPage.goto();
    await transactionsPage.isLoaded();

    const item = await transactionsPage.getTransactionByDescription(testDescription);
    await expect(item).toBeVisible();

    await transactionsPage.deleteTransaction(testDescription);
  });
});

test.describe("FIN-07-B: Edit expense transaction", () => {
  test("edits an expense transaction description and the change persists in the list", async ({ authenticatedPage }) => {
    const transactionsPage = new TransactionsPage(authenticatedPage);
    await transactionsPage.goto();
    await transactionsPage.isLoaded();

    const originalDescription = `Expense Edit Target ${Date.now()}`;
    await transactionsPage.createTransaction({
      type: "expense",
      description: originalDescription,
      amount: "320.00",
      walletName: "Conta Principal",
    });

    await transactionsPage.goto();
    await transactionsPage.isLoaded();

    const beforeEdit = await transactionsPage.getTransactionByDescription(originalDescription);
    await expect(beforeEdit).toBeVisible();

    const editedDescription = `Edited Expense ${Date.now()}`;
    await transactionsPage.editTransaction(originalDescription, {
      description: editedDescription,
    });

    await transactionsPage.goto();
    await transactionsPage.isLoaded();

    const afterEdit = await transactionsPage.getTransactionByDescription(editedDescription);
    await expect(afterEdit).toBeVisible();

    await transactionsPage.deleteTransaction(editedDescription);
  });
});

test.describe("FIN-07-C: Delete expense transaction", () => {
  test("deletes an expense transaction and it disappears from the list", async ({ authenticatedPage }) => {
    const transactionsPage = new TransactionsPage(authenticatedPage);
    await transactionsPage.goto();
    await transactionsPage.isLoaded();

    const deleteDescription = `Expense Delete Target ${Date.now()}`;
    await transactionsPage.createTransaction({
      type: "expense",
      description: deleteDescription,
      amount: "200.00",
      walletName: "Conta Principal",
    });

    await transactionsPage.goto();
    await transactionsPage.isLoaded();

    const before = await transactionsPage.getTransactionByDescription(deleteDescription);
    await expect(before).toBeVisible();

    await transactionsPage.deleteTransaction(deleteDescription);

    await expect(authenticatedPage).toHaveURL(/\/transactions/);

    const after = await transactionsPage.getTransactionByDescription(deleteDescription);
    await expect(after).not.toBeVisible();
  });
});
