import { test, expect } from "@playwright/test";

test("app loads login page", async ({ page }) => {
  await page.goto("/");
  // The app should either show the login page or redirect to it
  await expect(page).toHaveURL(/login/);
  // Expect the email input field to be present on the login form
  await expect(page.locator('input[type="email"]')).toBeVisible();
});
