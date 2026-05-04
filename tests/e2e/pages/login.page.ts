import type { Page, Locator } from "@playwright/test";

/**
 * Page Object Model for the login page (/login).
 * Uses resilient selectors: prefers data-testid, falls back to id/role selectors.
 * Selectors are based on the actual login form structure in src/app/login/.
 */
export class LoginPage {
  readonly page: Page;
  // Email input uses id="email" (from CredentialFields component)
  readonly emailInput: Locator;
  // Password input uses id="password" (from CredentialFields component)
  readonly passwordInput: Locator;
  // Submit button — role-based selector matching "Entrar" or "Login"
  readonly submitButton: Locator;
  // Error message shown by CredentialFields on failed auth
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('#email[type="email"], input[type="email"]').first();
    this.passwordInput = page.locator('#password[type="password"], input[type="password"]').first();
    this.submitButton = page.getByRole("button", { name: "Entrar", exact: true });
    this.errorMessage = page.locator(".text-destructive").first();
  }

  async goto(): Promise<void> {
    await this.page.goto("/login");
  }

  async fillEmail(email: string): Promise<void> {
    // Click first to trigger readOnly unlock (the form uses readOnly to prevent autofill)
    await this.emailInput.click();
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.click();
    await this.passwordInput.fill(password);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async login(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }

  async getErrorMessage(): Promise<string | null> {
    try {
      await this.errorMessage.waitFor({ state: "visible", timeout: 5000 });
      return await this.errorMessage.textContent();
    } catch {
      return null;
    }
  }

  async isLoginFormVisible(): Promise<boolean> {
    return await this.emailInput.isVisible();
  }
}
