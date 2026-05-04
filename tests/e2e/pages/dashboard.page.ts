import type { Page, Locator } from "@playwright/test";

/**
 * Page Object Model for the dashboard page (/dashboard).
 */
export class DashboardPage {
  readonly page: Page;
  // Dashboard-specific element — the main nav or page heading
  readonly dashboardHeading: Locator;
  // Navigation links to other sections
  readonly navLinks: Locator;

  constructor(page: Page) {
    this.page = page;
    // Dashboard is identified by its URL and presence of main content area
    this.dashboardHeading = page.locator('[data-testid="dashboard-heading"], h1, main').first();
    this.navLinks = page.locator('nav a, [role="navigation"] a');
  }

  async goto(): Promise<void> {
    await this.page.goto("/dashboard");
  }

  async isLoaded(): Promise<boolean> {
    await this.page.waitForURL(/dashboard/, { timeout: 15000 });
    return true;
  }

  async getWelcomeText(): Promise<string | null> {
    const heading = this.page.locator("h1, h2").first();
    try {
      await heading.waitFor({ state: "visible", timeout: 5000 });
      return await heading.textContent();
    } catch {
      return null;
    }
  }

  async navigateTo(section: "proposals" | "transactions" | "contacts" | "settings"): Promise<void> {
    const sectionPaths: Record<string, string> = {
      proposals: "/proposals",
      transactions: "/transactions",
      contacts: "/contacts",
      settings: "/settings",
    };
    await this.page.goto(sectionPaths[section]);
  }

  /**
   * Logs out the current user via the bottom-dock "Sair" button.
   * The bottom dock has a direct logout button (no dropdown) that calls the same
   * logout() from useAuth() as the header dropdown item.
   */
  async logout(): Promise<void> {
    const viewport = this.page.viewportSize() ?? { width: 1280, height: 720 };

    // The dock auto-hides via CSS transform (translate-y) after idle time.
    // Move the mouse to the bottom hotzone to reveal it.
    await this.page.mouse.move(viewport.width / 2, viewport.height - 2);

    // Wait for the dock's 300ms slide-up transition to complete before clicking.
    // The button is technically "visible" to Playwright even when off-screen via
    // CSS transform, so we check the actual bounding box position instead.
    await this.page.waitForFunction(
      () => {
        const btn = document.querySelector('button[aria-label="Sair"]');
        if (!btn) return false;
        const rect = btn.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight && rect.height > 0;
      },
      undefined,
      { timeout: 5000 },
    );

    // Target the button specifically, not the DockIcon motion.div wrapper
    await this.page.locator('button[aria-label="Sair"]').click();

    // Wait for redirect back to login.
    // 'commit' returns as soon as the navigation is committed (first response received),
    // avoiding flakiness from slow page loads in CI.
    await this.page.waitForURL(/\/login/, { timeout: 30000, waitUntil: "commit" });
  }
}
