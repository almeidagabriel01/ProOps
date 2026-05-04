import type { Page, Locator } from "@playwright/test";

/**
 * Page Object Model for the products list page (/products).
 */
export class ProductsPage {
  readonly page: Page;
  readonly newProductButton: Locator;
  readonly pageHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    // "Novo Produto" renders as a <Link><Button> — the outer <a> is the link role.
    this.newProductButton = page.getByRole("link", { name: /novo produto/i });
    this.pageHeading = page.locator("h1").first();
  }

  /**
   * After typing into a SearchableSelect search input, either:
   * - clicks the "Cadastrar" button if the option doesn't exist yet, or
   * - clicks the existing matching option button in the dropdown.
   *
   * Must be called while the dropdown is open (after filling the input).
   */
  private async _selectOrCreateOption(label: string): Promise<void> {
    // Wait briefly for the dropdown to render
    await this.page.waitForTimeout(300);

    // The "Cadastrar" button appears when no exact match exists.
    // Selector: button with text matching 'Cadastrar "label"'
    const createBtn = this.page
      .locator("button")
      .filter({ hasText: new RegExp(`Cadastrar.*${label}`, "i") })
      .first();

    // The existing option appears as a button with exact label text (inside the dropdown popover)
    const existingOption = this.page
      .locator("div.absolute button")
      .filter({ hasText: new RegExp(`^${label}$`, "i") })
      .first();

    try {
      // Race: check which is visible first (500ms each)
      const createVisible = await createBtn
        .isVisible()
        .catch(() => false);

      if (createVisible) {
        await createBtn.click();
      } else {
        // Try the existing option
        await existingOption.waitFor({ state: "visible", timeout: 5000 });
        await existingOption.click();
      }
    } catch {
      // Fallback: try create button with a longer wait
      await createBtn.waitFor({ state: "visible", timeout: 5000 });
      await createBtn.click();
    }

    await this.page.waitForTimeout(400);
  }

  async goto(): Promise<void> {
    await this.page.goto("/products");
  }

  async isLoaded(): Promise<boolean> {
    await this.page.waitForURL(/\/products$/, { timeout: 15000 });
    // Wait for the heading to confirm the page has rendered (avoids skeleton race condition).
    await this.pageHeading.waitFor({ state: "visible", timeout: 15000 });
    return true;
  }

  getProductByName(name: string): Locator {
    return this.page.getByRole("link", { name }).first();
  }

  /**
   * Creates a product through the 4-step wizard UI.
   *
   * For tenant-alpha (niche: automacao_residencial):
   * Step 1 — Informações: name, category (DynamicSelect), manufacturer (DynamicSelect)
   * Step 2 — Preço: price (CurrencyInput), markup (Input), inventoryValue (Input)
   * Step 3 — Imagens: skipped (no upload)
   * Step 4 — Resumo: clicks "Criar Produto"
   *
   * @param data.price - digits only, e.g. "15000" = R$ 150,00
   */
  async createProduct(data: {
    name: string;
    category: string;
    manufacturer: string;
    price: string;
  }): Promise<void> {
    await this.newProductButton.click();
    await this.page.waitForURL(/\/products\/new/, { timeout: 15000 });

    // --- Step 1: Informações ---
    await this.page.locator("#name").waitFor({ state: "visible", timeout: 15000 });
    await this.page.locator("#name").fill(data.name);

    // Category via DynamicSelect → SearchableSelect
    // The search input placeholder is "Buscar categoria..."
    const categoryInput = this.page.locator("#category").locator("..").locator('input[type="text"]');
    await categoryInput.click();
    await categoryInput.fill(data.category);
    await this._selectOrCreateOption(data.category);

    // Manufacturer via DynamicSelect → SearchableSelect
    const manufacturerInput = this.page.locator("#manufacturer").locator("..").locator('input[type="text"]');
    await manufacturerInput.click();
    await manufacturerInput.fill(data.manufacturer);
    await this._selectOrCreateOption(data.manufacturer);

    // Advance to step 2 (Preço)
    await this.page.getByRole("button", { name: /próximo/i }).click();

    // --- Step 2: Preço ---
    // CurrencyInput with id="price" — uses keyboard event interception.
    // Click to focus, then type digits (e.g. "15000" → R$ 150,00).
    await this.page.locator("#price").waitFor({ state: "visible", timeout: 10000 });
    await this.page.locator("#price").click();
    await this.page.keyboard.type(data.price);

    // Advance to step 3 (Imagens)
    await this.page.getByRole("button", { name: /próximo/i }).click();
    await this.page.waitForTimeout(300);

    // --- Step 3: Imagens — skip, click Próximo ---
    await this.page.getByRole("button", { name: /próximo/i }).click();
    await this.page.waitForTimeout(300);

    // --- Step 4: Resumo — click "Criar Produto" ---
    const submitButton = this.page.getByRole("button", { name: /criar produto/i });
    await submitButton.waitFor({ state: "visible", timeout: 10000 });
    await submitButton.click();

    // Wait for redirect back to /products after creation
    await this.page.waitForURL(/\/products$/, { timeout: 20000 });
  }

  /**
   * Edits an existing product by navigating to /products/[id].
   * allowClickAhead=true when productId is set, so step buttons are clickable.
   */
  async editProduct(productId: string, data: { name?: string }): Promise<void> {
    await this.page.goto(`/products/${productId}`);
    await this.page.waitForURL(new RegExp(`/products/${productId}`), { timeout: 15000 });

    await this.page.locator("#name").waitFor({ state: "visible", timeout: 15000 });

    if (data.name) {
      await this.page.locator("#name").clear();
      await this.page.locator("#name").fill(data.name);
    }

    // Jump to last step (Resumo) using step indicator — allowClickAhead=true for existing products
    await this.page.getByRole("button", { name: /resumo/i }).click();

    // Wait for "Salvar alterações" button on the Resumo step
    const saveButton = this.page.getByRole("button", { name: /salvar alterações/i });
    await saveButton.waitFor({ state: "visible", timeout: 10000 });
    await saveButton.click();

    await this.page.waitForTimeout(1000);
  }

  /**
   * Deletes a product from the list page by finding the row that contains the
   * product name link, then clicking the "Excluir" (title="Excluir") button.
   * Confirms the AlertDialog.
   */
  async deleteProduct(productName: string): Promise<void> {
    // The DataTable renders rows as grid divs. Find the smallest div that contains
    // both the product name link and the Excluir button.
    const row = this.page.locator("div").filter({
      has: this.page.getByRole("link", { name: productName }),
    }).filter({
      has: this.page.locator('button[title="Excluir"]'),
    }).last();

    await row.locator('button[title="Excluir"]').click();

    // Confirm the AlertDialog ("Excluir Produto" title, "Excluir" confirm button)
    const dialogTitle = this.page.getByText("Excluir Produto");
    await dialogTitle.waitFor({ state: "visible", timeout: 8000 });

    const confirmButton = this.page.getByRole("button", { name: /^excluir$/i });
    await confirmButton.waitFor({ state: "visible", timeout: 5000 });
    await confirmButton.click();

    // Wait for the product link to disappear from the list
    await this.page
      .getByRole("link", { name: productName })
      .waitFor({ state: "hidden", timeout: 10000 })
      .catch(() => {
        // Acceptable: item may already be gone before waitFor resolves
      });
  }
}
