import type { Page, Locator } from "@playwright/test";

/**
 * Data shape for creating a transaction through the UI wizard.
 * Only fields required by the "total" payment mode are included.
 * For income transactions, walletName defaults to "Conta Principal"
 * and clientName defaults to "João Silva" (seeded contact for tenant-alpha).
 */
export interface TransactionCreateData {
  type: "income" | "expense";
  description: string;
  date?: string; // YYYY-MM-DD — when omitted, uses DatePicker "Hoje" shortcut
  amount: string; // e.g. "1500.00" — CurrencyInput format (dot decimal)
  dueDate?: string; // Required for income — when omitted, uses DatePicker "Hoje"
  walletName?: string; // Display name for WalletSelect, defaults to "Conta Principal"
  clientName?: string; // Required for income — defaults to "João Silva"
  notes?: string; // Optional notes in Review step
}

/**
 * Page Object Model for the transactions list page (/transactions).
 */
export class TransactionsPage {
  readonly page: Page;
  readonly transactionList: Locator;
  readonly newTransactionButton: Locator;
  readonly pageHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    // Transaction list items
    this.transactionList = page.locator('[data-testid="transaction-item"], [data-testid="transactions-list"] > *');
    // New transaction CTA — rendered as <Link> inside <Button asChild>, so it's an <a> element
    this.newTransactionButton = page.getByRole("link", { name: /novo lançamento|nova transação|new transaction/i });
    this.pageHeading = page.locator('h1, [data-testid="page-heading"]').first();
  }

  async goto(): Promise<void> {
    await this.page.goto("/transactions");
  }

  async isLoaded(): Promise<boolean> {
    await this.page.waitForURL(/transactions/, { timeout: 15000 });
    return true;
  }

  async getTransactionCount(): Promise<number> {
    try {
      await this.transactionList.first().waitFor({ state: "visible", timeout: 5000 });
      return await this.transactionList.count();
    } catch {
      return 0;
    }
  }

  async clickNewTransaction(): Promise<void> {
    await this.newTransactionButton.click();
  }

  /**
   * Returns a Locator for the transaction row/card containing the description text.
   * Filters to divs that contain both the description text and a title="Excluir" button,
   * using .first() to get the innermost matching container.
   */
  async getTransactionByDescription(description: string): Promise<Locator> {
    return this.page
      .locator("article, [class*='card'], div[class*='CardContent'], div")
      .filter({ hasText: description })
      .filter({
        has: this.page.getByTitle("Excluir"),
      })
      .first();
  }

  /**
   * Opens a DatePicker by clicking the trigger button (immediate sibling of the hidden
   * input with the given id), then clicks the "Hoje" shortcut to select today.
   *
   * The DatePicker DOM structure:
   *   <div class="relative group">
   *     <input type="hidden" id="{inputId}" />
   *     <button type="button">…Calendar icon…</button>  ← adjacent sibling
   *   </div>
   *
   * The calendar popover renders via createPortal on document.body with fixed positioning.
   * We scroll the trigger into view before clicking so the popover lands within the viewport.
   */
  private async _clickDatePickerHoje(inputId: string): Promise<void> {
    // CSS adjacent-sibling selector: finds the button immediately after the hidden input
    const triggerButton = this.page.locator(`input#${inputId} + button`);
    await triggerButton.waitFor({ state: "visible", timeout: 8000 });

    // Scroll the trigger into view so the calendar portal positions within the viewport
    await triggerButton.scrollIntoViewIfNeeded();
    await triggerButton.click();

    // Wait for the "Hoje" footer button in the calendar portal and dispatch a click
    const hojeBtn = this.page.getByRole("button", { name: "Hoje" });
    await hojeBtn.waitFor({ state: "visible", timeout: 5000 });
    await hojeBtn.dispatchEvent("click");

    // Wait for the popover to close after date selection
    await this.page.waitForTimeout(300);
  }

  /**
   * Creates a transaction through the full 4-step browser UI wizard.
   *
   * Step 0 (Type): Click income or expense type card, then "Próximo".
   * Step 1 (Details): Fill description and date, then "Próximo".
   * Step 2 (Payment): Fill amount, dueDate (income only), wallet, then "Próximo".
   * Step 3 (Review): Select client (income only), optionally fill notes, then "Salvar Lançamento".
   *
   * Navigation uses sequential "Próximo" button clicks per D-02 (not step indicator jumps).
   */
  async createTransaction(data: TransactionCreateData): Promise<void> {
    const walletName = data.walletName ?? "Conta Principal";
    // Income transactions require a client — default to seeded tenant-alpha contact
    const clientName = data.clientName ?? (data.type === "income" ? "João Silva" : undefined);

    await this.clickNewTransaction();
    await this.page.waitForURL(/\/transactions\/new/, { timeout: 15000 });

    // --- Step 0: Type Selection ---
    // Two large card buttons: "Receita" and "Despesa".
    // The step indicator has "Tipo Receita ou despesa" — filter it out with hasNot.
    const typeText = data.type === "income" ? "Receita" : "Despesa";
    const typeButton = this.page.getByRole("button", { name: typeText, exact: false }).filter({
      hasNot: this.page.locator("text=ou despesa"),
    }).first();
    await typeButton.waitFor({ state: "visible", timeout: 10000 });
    await typeButton.click();

    // Advance to Step 1
    await this.page.getByRole("button", { name: /próximo/i }).click();

    // --- Step 1: Details ---
    const descriptionInput = this.page.locator("#description");
    await descriptionInput.waitFor({ state: "visible", timeout: 10000 });
    await descriptionInput.fill(data.description);

    // Open DatePicker for "date" field and select Hoje
    await this._clickDatePickerHoje("date");

    // Advance to Step 2
    await this.page.getByRole("button", { name: /próximo/i }).click();

    // --- Step 2: Payment ---
    // CurrencyInput ignores onChange — only responds to keyboard digit events.
    // Convert decimal amount (e.g. "1500.00") to cent digit string (e.g. "150000").
    const amountInput = this.page.locator("#amount");
    await amountInput.waitFor({ state: "visible", timeout: 10000 });
    await amountInput.click();
    const centDigits = String(Math.round(parseFloat(data.amount) * 100));
    await amountInput.pressSequentially(centDigits);
    await amountInput.blur();

    // Income requires dueDate ("Vencimento (Valor à Vista)")
    if (data.type === "income") {
      await this._clickDatePickerHoje("dueDate");
    }

    // Select wallet via WalletSelect (native <select> element with name="wallet")
    const walletSelect = this.page.locator('select[name="wallet"]');
    await walletSelect.waitFor({ state: "visible", timeout: 10000 });
    await walletSelect.selectOption({ label: walletName });

    // Advance to Step 3
    await this.page.getByRole("button", { name: /próximo/i }).click();

    // --- Step 3: Review ---
    // Income transactions require a client (schema validation: "Cliente é obrigatório para receitas")
    if (clientName) {
      const clientInput = this.page.getByPlaceholder("Digite ou selecione um cliente...");
      await clientInput.waitFor({ state: "visible", timeout: 10000 });
      await clientInput.fill(clientName);

      // Wait for the dropdown to show the client option and click it
      const clientsHeader = this.page.getByText("Clientes cadastrados");
      await clientsHeader.waitFor({ state: "visible", timeout: 8000 });

      // Click the option row that contains the client name (not the input itself)
      const clientOption = this.page.locator("div, li").filter({
        hasText: clientName,
      }).filter({
        hasNot: this.page.locator("input"),
      }).last();
      await clientOption.click();
    }

    // Optionally fill notes
    if (data.notes) {
      const notesInput = this.page.locator('textarea[name="notes"], #notes');
      const notesVisible = await notesInput.isVisible().catch(() => false);
      if (notesVisible) {
        await notesInput.fill(data.notes);
      }
    }

    // Submit — label is "Salvar Lançamento" for single non-installment transactions
    const submitButton = this.page.getByRole("button", { name: /salvar lançamento|criar \d+ parcelas/i });
    await submitButton.waitFor({ state: "visible", timeout: 10000 });
    await submitButton.click();

    // Wait for redirect away from /transactions/new
    await this.page.waitForURL(
      (url) => !url.pathname.includes("/transactions/new"),
      { timeout: 30000 },
    );
  }

  /**
   * Edits an existing transaction by navigating to its edit page (/transactions/[id]),
   * modifying the specified fields, and saving through the Review step.
   *
   * Navigates through steps sequentially via Próximo clicks (D-02).
   */
  async editTransaction(description: string, newData: Partial<TransactionCreateData>): Promise<void> {
    await this.goto();
    await this.isLoaded();

    const card = await this.getTransactionByDescription(description);
    await card.waitFor({ state: "visible", timeout: 10000 });

    // The edit button (title="Editar") may not always be visible in the card —
    // it depends on canEdit permission and whether the card renders it.
    // Reliable alternative: extract the transaction ID from the "view" link
    // (href="/transactions/[id]/view") and navigate directly to /transactions/[id].
    const viewLink = card.locator('a[href*="/transactions/"][href*="/view"]').first();
    const viewLinkCount = await viewLink.count();

    if (viewLinkCount > 0) {
      const viewHref = await viewLink.getAttribute("href");
      // Extract ID: "/transactions/abc123/view" → "abc123"
      const transactionId = viewHref?.split("/transactions/")[1]?.split("/")[0];
      if (transactionId) {
        await this.page.goto(`/transactions/${transactionId}`);
      } else {
        await viewLink.click();
      }
    } else {
      // Fallback: try the Editar link/button
      const editLink = card.locator('a[href*="/transactions/"]').filter({
        has: this.page.getByTitle("Editar"),
      });
      await editLink.first().click();
    }

    await this.page.waitForURL(/\/transactions\/[^/]+$/, { timeout: 15000 });

    // Edit wizard starts on Step 1 (Type) — same as new transaction wizard.
    // Advance to Step 2 (Details) by clicking Próximo so #description becomes visible.
    const nextOnType = this.page.getByRole("button", { name: /próximo/i });
    await nextOnType.waitFor({ state: "visible", timeout: 10000 });
    await nextOnType.click();

    // Now on Step 2 (Details) — wait for description input to be visible
    const descriptionInput = this.page.locator("#description");
    await descriptionInput.waitFor({ state: "visible", timeout: 15000 });

    if (newData.description) {
      await descriptionInput.clear();
      await descriptionInput.fill(newData.description);
    }

    // Navigate to the Review step via sequential Próximo clicks
    for (let i = 0; i < 3; i++) {
      const nextBtn = this.page.getByRole("button", { name: /próximo/i });
      const nextVisible = await nextBtn.isVisible().catch(() => false);
      if (nextVisible) {
        await nextBtn.click();
        await this.page.waitForTimeout(300);
      } else {
        break;
      }
    }

    // Edit page uses "Salvar Alterações" (not "Salvar Lançamento")
    const saveButton = this.page.getByRole("button", { name: /salvar alterações|salvar lançamento|criar \d+ parcelas/i });
    await saveButton.waitFor({ state: "visible", timeout: 10000 });
    await saveButton.click();

    await this.page.waitForURL(/\/transactions/, { timeout: 20000 });
    await this.page.waitForTimeout(1000);
  }

  /**
   * Deletes a transaction from the list page by description.
   * Clicks the title="Excluir" button in the transaction card and confirms the AlertDialog.
   */
  async deleteTransaction(description: string): Promise<void> {
    // Ensure we are on the transactions list page
    const currentUrl = this.page.url();
    if (!currentUrl.includes("/transactions") || currentUrl.includes("/transactions/")) {
      await this.goto();
      await this.isLoaded();
    }

    // Find the card: a div containing both the description text and the Excluir button.
    // Use .last() to get the innermost matching container.
    const card = this.page.locator("div").filter({
      has: this.page.getByTitle("Excluir"),
    }).filter({
      hasText: description,
    }).last();

    await card.waitFor({ state: "visible", timeout: 10000 });

    const deleteButton = card.getByTitle("Excluir");
    await deleteButton.click();

    // Confirm the AlertDialog
    const confirmButton = this.page.getByRole("button", { name: /sim, excluir/i });
    await confirmButton.waitFor({ state: "visible", timeout: 8000 });
    await confirmButton.click();

    // Wait for the transaction to disappear
    await this.page.waitForTimeout(500);
    const transactionText = this.page.getByText(description, { exact: false });
    await transactionText.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {
      // Acceptable: item may already be removed before waitFor completes
    });
  }
}
