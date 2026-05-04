import type { Page, Locator } from "@playwright/test";

/**
 * Data shape for creating a wallet through the WalletFormDialog UI.
 */
export interface WalletCreateData {
  name: string;
  type?: string; // Wallet type label (e.g., "Conta Bancária", "Dinheiro")
  initialBalance?: string; // e.g., "5000.00" — dot-decimal, passed as cent digits to CurrencyInput
}

/**
 * Data shape for transferring balance between wallets via TransferDialog.
 */
export interface TransferData {
  fromWalletName: string;
  toWalletName: string;
  amount: string; // e.g., "1000.00" — dot-decimal, passed as cent digits to CurrencyInput
}

/**
 * Page Object Model for the wallets page (/wallets).
 *
 * All wallet operations (create, transfer, delete) are performed via dialogs on the same page.
 *
 * Key UI patterns:
 * - "Nova Carteira" is a <Button> (not a link) that triggers the WalletFormDialog
 * - WalletFormDialog: #name input, #type select, #initialBalance CurrencyInput (keyboard-only)
 *   Submit: "Criar Carteira" (create) or "Salvar" (edit)
 * - TransferDialog: "De" native select (by wallet ID), "Para" native select (by wallet ID),
 *   CurrencyInput for amount (keyboard-only), submit: "Transferir"
 * - Delete: AlertDialog — "Excluir" or "Excluir mesmo assim" (if wallet has balance)
 *   Force requires checking the "Entendo que o saldo será perdido" checkbox first
 * - WalletCard DropdownMenu is opacity-0 by default, appears on hover. Use force:true to click.
 */
export class WalletsPage {
  readonly page: Page;
  readonly newWalletButton: Locator;
  readonly pageHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    // "Nova Carteira" button in the page header (not a link — it's a <Button>)
    this.newWalletButton = page.getByRole("button", { name: /nova carteira/i });
    this.pageHeading = page.locator("h1").first();
  }

  async goto(): Promise<void> {
    await this.page.goto("/wallets");
  }

  async isLoaded(): Promise<boolean> {
    // Use a URL predicate to match /wallets in the pathname only (not query string).
    // A plain regex like /wallets/ would falsely match /login?redirect=/wallets.
    await this.page.waitForURL(
      (url) => url.pathname === "/wallets" || url.pathname.startsWith("/wallets/"),
      { timeout: 15000 },
    );
    // Wait for the seeded "Conta Principal" wallet card to confirm the grid has rendered
    await this.page.getByText("Conta Principal").first().waitFor({
      state: "visible",
      timeout: 15000,
    });
    return true;
  }

  /**
   * Creates a new wallet via the WalletFormDialog.
   *
   * CurrencyInput only responds to keyboard digit events (same pattern as TransactionsPage).
   * Convert "5000.00" → "500000" as cent digits.
   */
  async createWallet(data: WalletCreateData): Promise<void> {
    await this.newWalletButton.click();

    // Wait for the WalletFormDialog to open — look for #name input
    const nameInput = this.page.locator("#name");
    await nameInput.waitFor({ state: "visible", timeout: 8000 });

    // Fill name
    await nameInput.fill(data.name);

    // Select type if provided — native <Select> with id="type"
    if (data.type) {
      const typeSelect = this.page.locator("#type");
      await typeSelect.selectOption({ label: data.type });
    }

    // Fill initial balance if provided — CurrencyInput responds only to keyboard digits
    if (data.initialBalance) {
      const balanceInput = this.page.locator("#initialBalance");
      await balanceInput.waitFor({ state: "visible", timeout: 5000 });
      await balanceInput.click();
      // Convert "5000.00" → "500000" (cent digits)
      const centDigits = String(Math.round(parseFloat(data.initialBalance) * 100));
      await balanceInput.pressSequentially(centDigits);
      await balanceInput.blur();
    }

    // Submit — "Criar Carteira" in create mode
    const submitButton = this.page.getByRole("button", { name: /criar carteira/i });
    await submitButton.waitFor({ state: "visible", timeout: 5000 });
    await submitButton.click();

    // Wait for dialog to close (name input disappears)
    await nameInput.waitFor({ state: "hidden", timeout: 10000 });
  }

  /**
   * Returns a locator for a wallet card identified by its name (h3 text).
   *
   * WalletCard renders as:
   *   <Card>  →  <div class="rounded-lg border bg-card ...">
   *     <CardContent className="p-5">  →  <div class="p-6 pt-0 p-5">
   *       ...
   *       <h3 class="font-semibold text-lg">{wallet.name}</h3>
   *
   * We locate the outer Card div (has class "rounded-lg border") that contains
   * an h3 with the wallet name. Using .filter({has: h3}) on the card container.
   */
  private getWalletCard(walletName: string): Locator {
    return this.page
      .locator("div.rounded-lg.border")
      .filter({ has: this.page.locator("h3").filter({ hasText: walletName }) })
      .first();
  }

  /**
   * Opens the TransferDialog from a specific wallet card's context menu.
   *
   * The DropdownMenu trigger (MoreVertical icon) is opacity-0 by default and only
   * visible on card hover. Use hover + force:true to reliably click it.
   *
   * Per pitfall 7: use the wallet card's context menu, NOT the summary card "Transferir" button
   * (which opens the dialog without pre-selecting the fromWallet).
   */
  async openTransferDialog(walletName: string): Promise<void> {
    const walletCard = this.getWalletCard(walletName);
    await walletCard.waitFor({ state: "visible", timeout: 10000 });

    // Hover over the card to make the DropdownMenu trigger visible
    await walletCard.hover();

    // Click the MoreVertical dropdown trigger — use force:true because it's opacity-0 by default
    const dropdownTrigger = walletCard.getByRole("button").filter({
      has: this.page.locator("svg"),
    }).last();
    await dropdownTrigger.click({ force: true });

    // Wait for the dropdown menu to appear and click "Transferir".
    // Radix DropdownMenuItem renders as a generic div (no ARIA menuitem role in Playwright snapshot).
    // Match by exact text content to avoid collision with the summary card "Transferir" button.
    const transferItem = this.page.locator("[data-radix-collection-item], div[role='menuitem'], div").filter({
      hasText: /^Transferir$/,
    }).last();
    await transferItem.waitFor({ state: "visible", timeout: 5000 });
    await transferItem.click();

    // Wait for the TransferDialog to open — look for the "Transferir Saldo" dialog title
    await this.page.getByRole("heading", { name: /transferir saldo/i }).waitFor({
      state: "visible",
      timeout: 8000,
    });
  }

  /**
   * Fills and submits the TransferDialog.
   *
   * TransferDialog uses native <select> elements that select by wallet.id (not name).
   * We use selectOption({ label: walletName }) to select by the visible option text.
   *
   * The "De" select options show: "{name} - R$ {balance}"
   * The "Para" select options show: "{name}"
   *
   * CurrencyInput for amount responds only to keyboard digit events.
   */
  async submitTransfer(data: TransferData): Promise<void> {
    // The "De" (from) select — options display "{name} - R$ {balance}" so we match by
    // finding the option element whose text starts with the wallet name, then select by value.
    const fromSelect = this.page.locator("select").nth(0);
    await fromSelect.waitFor({ state: "visible", timeout: 8000 });
    const fromValue = await fromSelect.evaluate(
      (sel: HTMLSelectElement, name: string) => {
        const opt = Array.from(sel.options).find((o) => o.text.startsWith(name));
        return opt?.value ?? "";
      },
      data.fromWalletName,
    );
    await fromSelect.selectOption(fromValue);

    // The "Para" (to) select — options text: "{name}" only — can match exactly
    const toSelect = this.page.locator("select").nth(1);
    await toSelect.waitFor({ state: "visible", timeout: 8000 });
    const toValue = await toSelect.evaluate(
      (sel: HTMLSelectElement, name: string) => {
        const opt = Array.from(sel.options).find((o) => o.text.startsWith(name));
        return opt?.value ?? "";
      },
      data.toWalletName,
    );
    await toSelect.selectOption(toValue);

    // CurrencyInput for amount — keyboard-only cent digits.
    // The TransferDialog's CurrencyInput has no id — find by placeholder within the dialog.
    const transferAmountInput = this.page
      .locator("[role='dialog']")
      .locator("input[placeholder='R$ 0,00']")
      .last();

    await transferAmountInput.waitFor({ state: "visible", timeout: 5000 });
    await transferAmountInput.click();
    const centDigits = String(Math.round(parseFloat(data.amount) * 100));
    await transferAmountInput.pressSequentially(centDigits);
    await transferAmountInput.blur();

    // Submit — "Transferir" button
    const submitButton = this.page.getByRole("button", { name: /^transferir$/i });
    await submitButton.waitFor({ state: "visible", timeout: 5000 });
    await submitButton.click();

    // Wait for the dialog to close
    await this.page
      .getByRole("heading", { name: /transferir saldo/i })
      .waitFor({ state: "hidden", timeout: 15000 });

    // Wait for the page to reload data after the transfer (showSkeleton may flash)
    await this.page.waitForTimeout(1000);
  }

  /**
   * Reads the balance text from a wallet card.
   * The balance is rendered in a <p> element below the "Saldo Atual" label.
   * Returns the raw formatted string, e.g. "R$ 15.000,00".
   */
  async getWalletBalance(walletName: string): Promise<string> {
    const walletCard = this.getWalletCard(walletName);

    await walletCard.waitFor({ state: "visible", timeout: 10000 });

    // The balance is a <p> element with class containing "text-2xl font-bold"
    // It follows the "Saldo Atual" label paragraph
    const balanceEl = walletCard.locator("p").filter({
      hasText: /R\$|[\d.,]+/,
    }).last();

    const balanceText = await balanceEl.textContent();
    return balanceText?.trim() ?? "";
  }

  /**
   * Deletes a wallet by name via the card's context menu.
   *
   * If the wallet has a non-zero balance, the DeleteWalletDialog shows a force checkbox
   * ("Entendo que o saldo será perdido") that must be checked before the confirm button
   * is enabled.
   *
   * The confirm button text is "Excluir" (zero balance) or "Excluir mesmo assim" (non-zero).
   */
  async deleteWallet(walletName: string): Promise<void> {
    const walletCard = this.getWalletCard(walletName);

    await walletCard.waitFor({ state: "visible", timeout: 10000 });

    // Hover to reveal the DropdownMenu trigger
    await walletCard.hover();

    // Click the MoreVertical dropdown trigger
    const dropdownTrigger = walletCard.getByRole("button").filter({
      has: this.page.locator("svg"),
    }).last();
    await dropdownTrigger.click({ force: true });

    // Click "Excluir" in the dropdown — same generic div pattern as Transferir item
    const deleteItem = this.page.locator("[data-radix-collection-item], div[role='menuitem'], div").filter({
      hasText: /^Excluir$/,
    }).last();
    await deleteItem.waitFor({ state: "visible", timeout: 5000 });
    await deleteItem.click();

    // The AlertDialog opens — check if there is a force checkbox (wallet has balance)
    await this.page.waitForTimeout(500);
    const forceCheckbox = this.page.locator("#force-delete");
    const hasForceCheckbox = await forceCheckbox.isVisible().catch(() => false);

    if (hasForceCheckbox) {
      // Check the force confirmation checkbox
      await forceCheckbox.click();
      // Wait for the confirm button to become enabled
      await this.page.waitForTimeout(300);
    }

    // Click the confirm button — "Excluir" or "Excluir mesmo assim"
    const confirmButton = this.page.getByRole("button", {
      name: /excluir mesmo assim|excluir/i,
    });
    await confirmButton.waitFor({ state: "visible", timeout: 8000 });
    await confirmButton.click();

    // Wait for the wallet to disappear from the grid
    await this.page.waitForTimeout(500);
    const walletText = this.page.getByText(walletName, { exact: false }).first();
    await walletText.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {
      // Acceptable: item may already be gone before waitFor
    });
  }
}
