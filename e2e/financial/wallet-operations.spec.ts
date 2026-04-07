/**
 * Wallet operations E2E tests.
 *
 * FIN-04: Wallet creation and balance transfer
 *   - Creates a new wallet via WalletFormDialog (D-06: UI-driven)
 *   - Transfers balance between wallets via TransferDialog (D-06: UI-driven)
 *   - Verifies new wallet shows updated balance (D-08: balance via UI only)
 *   - Cleans up: transfers back, then deletes the test wallet (create-then-delete pattern)
 *
 * FIN-05: Wallet balance updates correctly after operations
 *   - Reads balances of seeded wallets before transfer (D-08: UI display only)
 *   - Transfers a known amount between seeded wallets
 *   - Re-reads balances after transfer and asserts numeric delta matches amount
 *   - Reverses the transfer to restore seeded state (D-09: seeded wallets read-only)
 *
 * Seeded wallets (read-only per D-09):
 *   - WALLET_ALPHA_MAIN: "Conta Principal", balance: 15000.00
 *   - WALLET_ALPHA_SAVINGS: "Reserva", balance: 8500.00
 */

import { test, expect } from "../fixtures/auth.fixture";
import { WalletsPage } from "../pages/wallets.page";

/**
 * Parse a pt-BR formatted currency string to a number.
 * Examples: "R$ 15.000,00" -> 15000, "R$ 500,00" -> 500, "14.500,00" -> 14500
 */
function parseBalance(balanceStr: string): number {
  // Remove currency symbol, dots (thousands separator), replace comma with dot (decimal)
  const cleaned = balanceStr.replace(/R\$\s?/g, "").replace(/\./g, "").replace(",", ".").trim();
  return parseFloat(cleaned);
}

// ─── FIN-04: Wallet creation and balance transfer ────────────────────────────

test.describe("FIN-04: Wallet creation and balance transfer", () => {
  test("creates a wallet and transfers balance between wallets via UI", async ({ authenticatedPage }) => {
    const walletsPage = new WalletsPage(authenticatedPage);
    await walletsPage.goto();
    await walletsPage.isLoaded();

    // Create a new wallet (per D-06: UI-driven)
    const testWalletName = `Test Wallet ${Date.now()}`;
    await walletsPage.createWallet({ name: testWalletName });

    // Verify the new wallet appears on the page
    await expect(authenticatedPage.getByText(testWalletName)).toBeVisible();

    // Transfer balance from seeded "Conta Principal" to the new wallet (per D-06: UI-driven)
    await walletsPage.openTransferDialog("Conta Principal");
    await walletsPage.submitTransfer({
      fromWalletName: "Conta Principal",
      toWalletName: testWalletName,
      amount: "500.00",
    });

    // Navigate away and back to ensure fresh data load (pitfall 4)
    await authenticatedPage.goto("/transactions");
    await authenticatedPage.waitForURL(/transactions/);
    await walletsPage.goto();
    await walletsPage.isLoaded();

    // Verify the new wallet now shows the transferred balance (per D-08: UI display only)
    const newWalletBalance = await walletsPage.getWalletBalance(testWalletName);
    expect(newWalletBalance).toContain("500");

    // Cleanup: transfer 500 back to Conta Principal to restore its balance
    await walletsPage.openTransferDialog(testWalletName);
    await walletsPage.submitTransfer({
      fromWalletName: testWalletName,
      toWalletName: "Conta Principal",
      amount: "500.00",
    });

    // Cleanup: delete the created wallet (now has 0 balance)
    await walletsPage.deleteWallet(testWalletName);
  });
});

// ─── FIN-05: Wallet balance updates correctly after operations ────────────────

test.describe("FIN-05: Wallet balance updates correctly after operations", () => {
  test("wallet balance updates atomically after transfer between seeded wallets", async ({ authenticatedPage }) => {
    const walletsPage = new WalletsPage(authenticatedPage);
    await walletsPage.goto();
    await walletsPage.isLoaded();

    // Read initial balances of seeded wallets (per D-08: UI display only)
    const initialMainBalance = await walletsPage.getWalletBalance("Conta Principal");
    const initialSavingsBalance = await walletsPage.getWalletBalance("Reserva");

    const initialMainNumeric = parseBalance(initialMainBalance);
    const initialSavingsNumeric = parseBalance(initialSavingsBalance);
    const transferAmount = 1000;

    // Transfer a known amount from Conta Principal to Reserva
    await walletsPage.openTransferDialog("Conta Principal");
    await walletsPage.submitTransfer({
      fromWalletName: "Conta Principal",
      toWalletName: "Reserva",
      amount: "1000.00",
    });

    // Navigate away and back to force data refresh (pitfall 4)
    await authenticatedPage.goto("/transactions");
    await authenticatedPage.waitForURL(/transactions/);
    await walletsPage.goto();
    await walletsPage.isLoaded();

    // Read post-transfer balances
    const postMainBalance = await walletsPage.getWalletBalance("Conta Principal");
    const postSavingsBalance = await walletsPage.getWalletBalance("Reserva");

    const postMainNumeric = parseBalance(postMainBalance);
    const postSavingsNumeric = parseBalance(postSavingsBalance);

    // Assert balances changed by EXACTLY the transfer amount
    // Main should decrease by 1000, Savings should increase by 1000
    expect(postMainNumeric).toBeCloseTo(initialMainNumeric - transferAmount, 0);
    expect(postSavingsNumeric).toBeCloseTo(initialSavingsNumeric + transferAmount, 0);

    // Reverse the transfer to restore seeded state for other tests (per D-09)
    await walletsPage.openTransferDialog("Reserva");
    await walletsPage.submitTransfer({
      fromWalletName: "Reserva",
      toWalletName: "Conta Principal",
      amount: "1000.00",
    });
  });
});
