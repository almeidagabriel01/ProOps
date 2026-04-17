import type { Page, Locator } from "@playwright/test";

/**
 * Page Object Model for the Lia AI assistant panel.
 * Selectors are derived from the aria-labels in the Lia components:
 * - lia-trigger-button.tsx (aria-label="Abrir Lia" / "Fechar Lia")
 * - lia-panel.tsx (aria-label="Assistente Lia")
 * - lia-usage-badge.tsx (aria-label="${N} de ${M} mensagens usadas")
 * - lia-input-bar.tsx (aria-label="Mensagem para Lia", aria-label="Enviar mensagem")
 */
export class LiaPage {
  readonly page: Page;
  readonly triggerButtonOpen: Locator;
  readonly triggerButtonClose: Locator;
  readonly panel: Locator;
  readonly usageBadge: Locator;
  readonly messageInput: Locator;
  readonly sendButton: Locator;
  readonly nearLimitBannerClose: Locator;

  constructor(page: Page) {
    this.page = page;
    this.triggerButtonOpen = page.getByRole("button", { name: "Abrir Lia" });
    this.triggerButtonClose = page.getByRole("button", { name: "Fechar Lia" });
    this.panel = page.locator('[aria-label="Assistente Lia"]');
    this.usageBadge = page.locator('[aria-label*="mensagens usadas"]');
    this.messageInput = page.getByLabel("Mensagem para Lia");
    this.sendButton = page.getByRole("button", { name: "Enviar mensagem" });
    this.nearLimitBannerClose = page.getByRole("button", { name: "Fechar aviso de limite" });
  }

  async openPanel(): Promise<void> {
    await this.triggerButtonOpen.click();
    await this.panel.waitFor({ state: "visible", timeout: 5000 });
  }

  async closePanel(): Promise<void> {
    await this.triggerButtonClose.click();
  }

  async isTriggerVisible(): Promise<boolean> {
    // Free plan: trigger button is not in the DOM at all
    return await this.triggerButtonOpen.isVisible({ timeout: 3000 }).catch(() => false);
  }

  async getBadgeText(): Promise<string | null> {
    try {
      await this.usageBadge.waitFor({ state: "visible", timeout: 5000 });
      return await this.usageBadge.getAttribute("aria-label");
    } catch {
      return null;
    }
  }

  async isInputDisabled(): Promise<boolean> {
    return await this.messageInput.isDisabled();
  }

  async getInputPlaceholder(): Promise<string | null> {
    return await this.messageInput.getAttribute("placeholder");
  }

  async sendMessage(text: string): Promise<void> {
    await this.messageInput.fill(text);
    await this.sendButton.click();
  }
}
