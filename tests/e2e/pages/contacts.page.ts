import type { Page, Locator } from "@playwright/test";

/**
 * Page Object Model for the contacts list page (/contacts).
 *
 * Contacts (clients) use a 3-step StepWizard:
 *   Step 1 — Informações: type toggles, name (#name), email (#email), phone (#phone)
 *   Step 2 — Endereço:    address (#address)
 *   Step 3 — Finalizar:   notes (#notes) + summary + submit
 *
 * Create submit label: "Cadastrar Cliente"
 * Edit submit label:   "Salvar Alterações" (disabled when no changes detected)
 * Delete dialog title: "Excluir Cliente"
 * Delete confirm btn:  "Excluir" (AlertDialogAction)
 */
export class ContactsPage {
  readonly page: Page;
  readonly newContactButton: Locator;
  readonly pageHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    // "Novo Cadastro" is a <Link> wrapping a <Button> in the contacts page header.
    this.newContactButton = page.getByRole("link", { name: /novo cadastro/i });
    this.pageHeading = page.locator("h1").first();
  }

  async goto(): Promise<void> {
    await this.page.goto("/contacts");
  }

  async isLoaded(): Promise<boolean> {
    await this.page.waitForURL(/\/contacts$/, { timeout: 15000 });
    return true;
  }

  /**
   * Returns a locator for the contact name link in the list table.
   * Contact names render as <Link href="/contacts/[id]"> elements.
   */
  getContactByName(name: string): Locator {
    return this.page.getByRole("link", { name }).first();
  }

  /**
   * Creates a contact through the full 3-step browser UI wizard.
   *
   * Step 1: fills name and phone (both required). "Cliente" type is pre-selected.
   * Step 2: skipped (address is optional).
   * Step 3: clicks "Cadastrar Cliente" to submit.
   * Waits for redirect back to /contacts.
   */
  async createContact(data: { name: string; phone: string }): Promise<void> {
    await this.newContactButton.click();
    await this.page.waitForURL(/\/contacts\/new/, { timeout: 15000 });

    // Wait for the name input on step 1 to be visible
    await this.page.locator("#name").waitFor({ state: "visible", timeout: 15000 });

    // Fill name
    await this.page.locator("#name").fill(data.name);

    // Fill phone — PhoneInput renders a single <input type="tel" name="phone" id="phone">
    await this.page.locator("#phone").fill(data.phone);

    // Advance step 1 → step 2
    await this.page.getByRole("button", { name: /próximo/i }).click();
    await this.page.waitForTimeout(300);

    // Advance step 2 → step 3 (address is optional, skip)
    await this.page.getByRole("button", { name: /próximo/i }).click();
    await this.page.waitForTimeout(300);

    // Step 3: submit — label is "Cadastrar Cliente"
    const submitButton = this.page.getByRole("button", { name: /cadastrar cliente/i });
    await submitButton.waitFor({ state: "visible", timeout: 10000 });
    await submitButton.click();

    // Wait for redirect back to /contacts after successful creation
    await this.page.waitForURL(/\/contacts$/, { timeout: 20000 });
  }

  /**
   * Edits an existing contact by navigating directly to /contacts/[contactId].
   * Uses allowClickAhead=true StepWizard — clicks the "Finalizar" step indicator
   * to jump to step 3, then clicks "Salvar Alterações".
   *
   * Note: "Salvar Alterações" is disabled when no changes have been made.
   * Always modify at least one field before calling this method.
   */
  async editContact(contactId: string, data: { name?: string }): Promise<void> {
    await this.page.goto(`/contacts/${contactId}`);
    await this.page.waitForURL(new RegExp(`/contacts/${contactId}`), { timeout: 15000 });

    // Wait for the form to load — name input must be visible and populated
    await this.page.locator("#name").waitFor({ state: "visible", timeout: 15000 });

    if (data.name) {
      const nameInput = this.page.locator("#name");
      await nameInput.clear();
      await nameInput.fill(data.name);
    }

    // allowClickAhead=true on edit page — click "Finalizar" step indicator to jump to step 3
    await this.page.getByRole("button", { name: /finalizar/i }).click();

    // Wait for the submit button to appear on step 3
    const saveButton = this.page.getByRole("button", { name: /salvar alterações/i });
    await saveButton.waitFor({ state: "visible", timeout: 10000 });
    await saveButton.click();

    // Wait for redirect back to /contacts
    await this.page.waitForURL(/\/contacts$/, { timeout: 20000 });
    await this.page.waitForTimeout(500);
  }

  /**
   * Deletes a contact from the list page by name.
   * Finds the DataTable card row containing the contact name link,
   * clicks the "Excluir" icon button (title="Excluir"),
   * then confirms the AlertDialog.
   *
   * The DataTable renders rows as <Card> → <CardContent> (both <div> elements),
   * NOT as <tr> elements. Each row card also contains the "Excluir" button,
   * so we filter to the deepest div that has both the name link and the button.
   */
  async deleteContact(contactName: string): Promise<void> {
    // Find the card row: deepest <div> containing both the contact link
    // and the Excluir button. Using .last() picks the most specific (deepest)
    // matching container — the CardContent div, not an outer wrapper.
    const row = this.page
      .locator("div")
      .filter({ has: this.page.getByRole("link", { name: contactName }) })
      .filter({ has: this.page.getByTitle("Excluir") })
      .last();

    // The delete button has title="Excluir" and is inside the "Ações" column
    await row.getByTitle("Excluir").click();

    // Wait for the AlertDialog to appear with title "Excluir Cliente"
    await this.page.getByText("Excluir Cliente").waitFor({ state: "visible", timeout: 8000 });

    // Click the confirm button in the AlertDialog footer
    // AlertDialogAction renders as a <button> with text "Excluir"
    const confirmButton = this.page.getByRole("button", { name: /^excluir$/i });
    await confirmButton.waitFor({ state: "visible", timeout: 5000 });
    await confirmButton.click();

    // Wait for the contact link to disappear from the list
    await this.page
      .getByRole("link", { name: contactName })
      .waitFor({ state: "hidden", timeout: 10000 })
      .catch(() => {
        // Acceptable: item may already be gone before waitFor resolves
      });
  }
}
