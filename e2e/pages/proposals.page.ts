import type { Page, Locator } from "@playwright/test";

/**
 * Page Object Model for the proposals list page (/proposals).
 */
export class ProposalsPage {
  readonly page: Page;
  readonly proposalList: Locator;
  readonly newProposalButton: Locator;
  readonly pageHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    // Proposal list items — rows in the list/table
    this.proposalList = page.locator('[data-testid="proposal-item"], [data-testid="proposals-list"] > *');
    // New proposal CTA — rendered as a <Link> (anchor tag) in the UI
    this.newProposalButton = page.getByRole("link", { name: /nova proposta|new proposal|criar/i });
    this.pageHeading = page.locator('h1, [data-testid="page-heading"]').first();
  }

  async goto(): Promise<void> {
    await this.page.goto("/proposals");
  }

  async isLoaded(): Promise<boolean> {
    await this.page.waitForURL(/\/proposals$/, { timeout: 15000 });
    // Wait for a seeded proposal link to confirm the list has rendered.
    // "Automação Residencial - Casa Verde" is always present from seed data.
    await this.page.getByRole("link", { name: /automação residencial/i }).waitFor({
      state: "visible",
      timeout: 15000,
    });
    return true;
  }

  async getProposalCount(): Promise<number> {
    try {
      await this.proposalList.first().waitFor({ state: "visible", timeout: 5000 });
      return await this.proposalList.count();
    } catch {
      return 0;
    }
  }

  async clickNewProposal(): Promise<void> {
    await this.newProposalButton.click();
  }

  async getProposalByTitle(title: string): Promise<Locator> {
    // The title renders as a link in the proposals list. Use getByRole for precision.
    return this.page.getByRole("link", { name: title }).first();
  }

  /**
   * Creates a proposal through the full browser UI wizard.
   *
   * For tenant-alpha (niche: automacao_residencial), the wizard has 5 steps:
   * 1. Contato — fills title, client, phone, validUntil
   * 2. Soluções — selects a sistema and ambiente from SearchableSelect dropdowns
   * 3. Pagamento — skipped (no payment options enabled by default)
   * 4. PDF — skipped (default settings)
   * 5. Resumo — clicks "Criar Proposta"
   *
   * Requires seed data: sistema-iluminacao-001 / ambiente-sala-001 for tenant-alpha.
   */
  async createProposal(data: { title: string; clientName: string }): Promise<void> {
    await this.clickNewProposal();
    await this.page.waitForURL(/\/proposals\/new/, { timeout: 15000 });

    // Wait for step 1 (Contato) to be visible
    await this.page.locator('#title').waitFor({ state: "visible", timeout: 15000 });

    // --- Step 1: Contato ---

    // Fill title
    await this.page.locator('#title').fill(data.title);

    // Select client via ClientSelect (input with Portuguese placeholder)
    const clientInput = this.page.getByPlaceholder("Digite ou selecione um cliente...");
    await clientInput.fill(data.clientName);
    // Wait for the "Clientes cadastrados" section header to confirm the dropdown is open,
    // then click the option row that contains the client name. The option row is a sibling
    // of the header inside the dropdown container.
    const clientsHeader = this.page.getByText("Clientes cadastrados");
    await clientsHeader.waitFor({ state: "visible", timeout: 8000 });
    // Find the clickable option row: a generic/div that contains the name text and is NOT the header
    const clientOption = this.page.locator("div, li").filter({
      hasText: data.clientName,
    }).filter({
      hasNot: this.page.locator("input"),
    }).last();
    await clientOption.click();

    // Fill phone (required field)
    const phoneInput = this.page.locator('#clientPhone');
    await phoneInput.fill('(11) 99999-9999');

    // Fill validUntil date via the custom DatePicker component.
    // The field renders a hidden <input type="hidden" id="validUntil"> and a visible
    // <button> trigger. Clicking the trigger opens a calendar popover; clicking "Hoje"
    // picks today's date (valid — not in the past).
    const validUntilTrigger = this.page.getByRole("button", { name: /selecionar data/i });
    await validUntilTrigger.click();
    // Click "Hoje" in the calendar footer to select today's date
    const hojeButton = this.page.getByRole("button", { name: /hoje/i });
    await hojeButton.waitFor({ state: "visible", timeout: 5000 });
    // Use JS click via evaluate — works even when the element is outside the CI viewport
    // (position:fixed popovers are not scrollable into view in headless).
    await hojeButton.evaluate((el) => (el as HTMLElement).click());

    // Click "Próximo" to advance to step 2
    await this.page.getByRole("button", { name: /próximo/i }).click();

    // --- Step 2: Soluções (automacao_residencial) ---
    // The SistemaSelector renders two SearchableSelect components.
    // First: select sistema using the "Buscar solução..." search input
    const sistemaSearchInput = this.page.getByPlaceholder("Buscar solução...");
    await sistemaSearchInput.waitFor({ state: "visible", timeout: 10000 });
    await sistemaSearchInput.click();
    await sistemaSearchInput.fill("Iluminação");

    // The SearchableSelect renders matching items as <button> elements.
    // Wait for the sistema button to appear and click it.
    const sistemaOption = this.page.getByRole("button", { name: /sistema de iluminação/i });
    await sistemaOption.waitFor({ state: "visible", timeout: 8000 });
    await sistemaOption.click();

    // After selecting sistema, the ambiente selector becomes enabled.
    // Its textbox placeholder is "Buscar ambiente..." once enabled.
    // Click "Abrir opções" to open the dropdown, then pick "Sala de Estar".
    const ambienteOpenBtn = this.page.getByRole("button", { name: /abrir opções/i }).last();
    await ambienteOpenBtn.waitFor({ state: "visible", timeout: 8000 });
    await ambienteOpenBtn.click();

    // Ambiente options render as <button> elements
    const ambienteOption = this.page.getByRole("button", { name: /sala de estar/i });
    await ambienteOption.waitFor({ state: "visible", timeout: 8000 });
    await ambienteOption.click();

    // Wait briefly for the sistema to be added to the proposal
    await this.page.waitForTimeout(500);

    // Click "Próximo" to advance to step 3 (Pagamento)
    await this.page.getByRole("button", { name: /próximo/i }).click();

    // --- Step 3: Pagamento — skip, click Próximo ---
    await this.page.waitForTimeout(300);
    await this.page.getByRole("button", { name: /próximo/i }).click();

    // --- Step 4: PDF — skip, click Próximo ---
    await this.page.waitForTimeout(300);
    await this.page.getByRole("button", { name: /próximo/i }).click();

    // --- Step 5: Resumo — click "Criar Proposta" ---
    // Wait for the product fetch re-render to settle before submitting.
    // ProductService.getProducts() fires on form mount and may trigger a setProducts()
    // re-render that resets form navigation state if it completes mid-submission.
    // 2000ms covers slower emulator responses under load from concurrent tests.
    await this.page.waitForTimeout(2000);
    const submitButton = this.page.getByRole("button", { name: /criar proposta/i });
    await submitButton.waitFor({ state: "visible", timeout: 10000 });
    await submitButton.click();

    // Wait for redirect away from /proposals/new to confirm the proposal was saved.
    // The redirect goes to /proposals/{id}/edit-pdf after creation.
    // We must NOT match /proposals/new or the pattern exits prematurely.
    await this.page.waitForURL(
      (url) => !url.pathname.includes("/proposals/new") && url.pathname.includes("/proposals/"),
      { timeout: 30000 },
    );
  }

  /**
   * Edits an existing proposal by navigating to /proposals/[id].
   * Because proposalId is set, allowClickAhead=true in StepWizard — step indicators are clickable.
   * Modifies only the title field on step 1 and saves.
   */
  async editProposal(proposalId: string, data: { title?: string }): Promise<void> {
    await this.page.goto(`/proposals/${proposalId}`);
    await this.page.waitForURL(new RegExp(`/proposals/${proposalId}`), { timeout: 15000 });

    // Wait for the form to load
    await this.page.locator('#title').waitFor({ state: "visible", timeout: 15000 });

    if (data.title) {
      const titleInput = this.page.locator('#title');
      await titleInput.clear();
      await titleInput.fill(data.title);
    }

    // Navigate to the last step (Resumo — step index 4) using the step indicator.
    // allowClickAhead=true for existing proposals, so clicking the step button works.
    // The step buttons are rendered as <button> elements in the StepIndicator.
    // Step 5 label is "Resumo"
    await this.page.getByRole("button", { name: /resumo/i }).click();

    // Wait for the Resumo step to be active and click "Salvar Proposta"
    const saveButton = this.page.getByRole("button", { name: /salvar proposta/i });
    await saveButton.waitFor({ state: "visible", timeout: 10000 });
    await saveButton.click();

    // Wait for save confirmation (redirect or URL stays on same page with save completed)
    await this.page.waitForURL(/(\/proposals\/[^/]+\/edit-pdf|\/proposals\/[^/]+)/, {
      timeout: 20000,
    });
    // Small wait to allow any success toast/redirect to settle
    await this.page.waitForTimeout(1000);
  }

  /**
   * Deletes a proposal from the list page by title.
   * Finds the row with matching title, clicks the Excluir (delete) button,
   * and confirms the AlertDialog.
   *
   * The delete button (Trash2 icon, title="Excluir") is in the action column.
   * On larger viewports it's a direct button; on smaller screens it's inside a dropdown.
   * Tests run at default Playwright viewport (1280x720) which shows the compact dropdown.
   */
  async deleteProposal(title: string): Promise<void> {
    // Find the row card: the innermost div that contains both the title link and
    // a "Mais ações" button. Using .filter chains and .last() in DOM order gives
    // the most specific (deepest) matching container — the row card itself.
    // This avoids the ancestor-walk bug where walking 10 levels up reaches the
    // list container (which contains ALL proposal text), causing the wrong row
    // to be matched.
    const row = this.page.locator("div").filter({
      has: this.page.getByRole("link", { name: title }),
    }).filter({
      has: this.page.getByRole("button", { name: /mais ações/i }),
    }).last();

    await row.getByRole("button", { name: /mais ações/i }).click();

    // The dropdown items render as generic divs (not menuitem role).
    // Find the Excluir item by text content.
    const deleteMenuItem = this.page.locator("div, button, li").filter({
      hasText: /^excluir$/i,
    }).last();
    await deleteMenuItem.waitFor({ state: "visible", timeout: 5000 });
    await deleteMenuItem.click();

    // Confirm the AlertDialog
    const confirmButton = this.page.getByRole("button", { name: /^excluir$/i });
    await confirmButton.waitFor({ state: "visible", timeout: 8000 });
    await confirmButton.click();

    // Wait for proposal to disappear from the list
    const proposalText = this.page.getByText(title, { exact: false }).first();
    await proposalText.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {
      // Acceptable: item may already be gone before waitFor
    });
  }

  /**
   * Returns the status badge text for a proposal row.
   * Used by PROP-06 assertions.
   */
  async getProposalStatus(title: string): Promise<string> {
    // The proposals list renders each row as a generic div containing both a title
    // link and a status button. Walk UP from each status button to find the SMALLEST
    // ancestor that contains the title text — stopping when the ancestor contains
    // more than one status button (meaning we've reached the list container, not a row).
    const statusButtons = this.page.getByRole("button", {
      name: /rascunho|enviada|aprovada|rejeitada|em aberto|em progresso/i,
    });

    const buttonCount = await statusButtons.count();
    for (let i = 0; i < buttonCount; i++) {
      const btn = statusButtons.nth(i);
      const isInRow = await btn.evaluate((el, searchTitle) => {
        let node: Element | null = el.parentElement;
        for (let depth = 0; depth < 10; depth++) {
          if (!node) break;
          // Stop if this ancestor contains more than one status button
          // (that means we've left the row boundary and are at the list container)
          const statusBtns = node.querySelectorAll(
            'button[aria-label], button'
          );
          const statusCount = Array.from(statusBtns).filter((b) =>
            /rascunho|enviada|aprovada|rejeitada|em aberto|em progresso/i.test(b.textContent ?? '')
          ).length;
          if (statusCount > 1) return false;

          // Check if this ancestor contains the title
          if (node.textContent?.includes(searchTitle)) return true;

          node = node.parentElement;
        }
        return false;
      }, title);
      if (isInRow) {
        return await btn.textContent() ?? "";
      }
    }

    return "";
  }
}
