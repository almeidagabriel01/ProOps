import { test, expect } from "../fixtures/auth.fixture";
import { PROPOSAL_ALPHA_APPROVED } from "../seed/data/proposals";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { USER_ADMIN_ALPHA } from "../seed/data/users";

test.describe("PROP-05: Public share link", () => {
  test("share link is accessible without authentication and renders proposal content", async ({
    authenticatedPage,
    browser,
  }) => {
    // Obtain a Firebase ID token via the Auth emulator REST API (Node.js context).
    // page.request sends browser cookies but not the Authorization Bearer token,
    // so we sign in directly against the emulator to get a token for the API call.
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    // Step 1: Create share token via authenticated API (per D-08)
    const shareResponse = await authenticatedPage.request.post(
      `/api/backend/v1/proposals/${PROPOSAL_ALPHA_APPROVED.id}/share-link`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    );
    expect(shareResponse.status()).toBe(201);

    const shareData = await shareResponse.json();
    // Response shape: { success, shareUrl, token, expiresAt, message }
    expect(shareData.token).toBeTruthy();
    const token = shareData.token;

    // Step 2: Open share URL in fresh unauthenticated browser context (per D-08)
    // Use browser.newPage() — no storageState, no auth cookies
    const publicPage = await browser.newPage();

    await publicPage.goto(`/share/${token}`);
    await publicPage.waitForLoadState("networkidle");

    // Step 3: Assert no redirect to /login (per D-09)
    const currentUrl = publicPage.url();
    expect(currentUrl).toContain(`/share/${token}`);
    expect(currentUrl).not.toContain("/login");

    // Step 4: Assert proposal content is visible (per D-09)
    // The approved proposal title should be rendered on the public page
    const pageContent = await publicPage.textContent("body");
    expect(pageContent).toContain(PROPOSAL_ALPHA_APPROVED.title);

    await publicPage.close();
  });
});
