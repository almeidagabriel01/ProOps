import { expect, type Page, type Locator } from "@playwright/test";

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
   *
   * The click is retried until the URL reaches /login. The CI runs `next dev`,
   * which compiles each route on first visit: the first spec of a shard gets
   * the server-rendered dock before React hydrates it, so the button is visible
   * and in place but has no onClick yet, and a single click is silently lost
   * (AUTH-03 failed that way, first attempt only). logout() is idempotent, so a
   * second click after a slow but working first one is harmless.
   */
  async logout(): Promise<void> {
    const sair = this.page.locator('button[aria-label="Sair"]');

    await expect(async () => {
      if (/\/login/.test(this.page.url())) return;
      await this.revealDock();
      await sair.click({ timeout: 5000 });
      // 'commit' returns as soon as the navigation is committed (first response received),
      // avoiding flakiness from slow page loads in CI.
      await this.page.waitForURL(/\/login/, { timeout: 10000, waitUntil: "commit" });
    }).toPass({ timeout: 60000, intervals: [500] });
  }

  /**
   * The dock auto-hides via CSS transform (translate-y) after idle time. Moving
   * the mouse to the bottom hotzone reveals it; its 300ms slide-up must finish
   * before clicking. The button is technically "visible" to Playwright even when
   * off-screen via CSS transform, so we check the actual bounding box instead.
   */
  private async revealDock(): Promise<void> {
    const viewport = this.page.viewportSize() ?? { width: 1280, height: 720 };
    await this.page.mouse.move(viewport.width / 2, viewport.height - 2);
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
  }
}
