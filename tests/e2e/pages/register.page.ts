import type { Page, Locator } from "@playwright/test";

export class RegisterPage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly companyNameInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.locator("#reg-name");
    this.emailInput = page.locator("#email");
    this.passwordInput = page.locator("#password");
    this.companyNameInput = page.locator("#companyName");
  }

  async goto(): Promise<void> {
    await this.page.goto("/register");
  }

  async isLoaded(): Promise<boolean> {
    await this.page.waitForURL(/\/register/, { timeout: 15000 });
    await this.nameInput.waitFor({ state: "visible", timeout: 15000 });
    return true;
  }

  async fillStep1(data: { name: string; email: string; password: string }): Promise<void> {
    // Click before fill — the form uses readOnly to prevent autofill; click unlocks it
    await this.nameInput.click();
    await this.nameInput.fill(data.name);
    await this.emailInput.click();
    await this.emailInput.fill(data.email);
    await this.passwordInput.click();
    await this.passwordInput.fill(data.password);
    // Click "Continuar" to advance to step 2
    await this.page.getByRole("button", { name: /continuar/i }).click();
    // Wait for step 2 to appear (companyName input visible)
    await this.companyNameInput.waitFor({ state: "visible", timeout: 10000 });
  }

  async fillStep2(data: { companyName: string }): Promise<void> {
    await this.companyNameInput.fill(data.companyName);
    // Niche select left at default — no interaction
    // Step 2 StepNavigation uses default nextLabel="Próximo" (not "Continuar")
    await this.page.getByRole("button", { name: /próximo/i }).click();
    // Wait for step 3 — the "Finalizar" button
    await this.page.getByRole("button", { name: /finalizar/i }).waitFor({ state: "visible", timeout: 10000 });
  }

  async submitStep3(): Promise<void> {
    // Step 3 has only optional branding fields — click Finalizar directly
    await this.page.getByRole("button", { name: /finalizar/i }).click();
  }

  async waitForVerificationScreen(): Promise<void> {
    // The EmailVerificationPending screen appears briefly before auto-proceeding
    // With NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION=true, this resolves automatically
    await this.page
      .waitForFunction(
        () =>
          document.body.innerText.includes("verificação") ||
          document.body.innerText.includes("email"),
        { timeout: 15000 },
      )
      .catch(() => {
        // Screen may have appeared and disappeared too quickly — that's fine
      });
  }

  async waitForHomeRedirect(): Promise<void> {
    // After registration: EmailVerificationPending → auto-proceed → reload → redirect to '/'
    // The reload cycle can take up to 15s — use a 30s timeout.
    // Use a URL predicate so this works regardless of host (localhost vs. CI URL).
    await this.page.waitForURL(
      (url) => url.pathname === "/" && !url.pathname.startsWith("/login") && !url.pathname.startsWith("/register"),
      { timeout: 30000 },
    );
  }
}
