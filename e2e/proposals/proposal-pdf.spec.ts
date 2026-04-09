import { test, expect } from "../fixtures/auth.fixture";
import { PROPOSAL_ALPHA_APPROVED } from "../seed/data/proposals";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { USER_ADMIN_ALPHA } from "../seed/data/users";

test.describe("PROP-04: PDF generation endpoint", () => {
  test("returns non-auth-error response for authenticated request", async ({ authenticatedPage }) => {
    // Obtain a Firebase ID token via the Auth emulator REST API (Node.js context).
    // page.request sends browser cookies but not the Authorization Bearer token,
    // so we sign in directly against the emulator to get a token to pass as a header.
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const response = await authenticatedPage.request.get(
      `/api/backend/v1/proposals/${PROPOSAL_ALPHA_APPROVED.id}/pdf`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    );

    // INTENTIONAL per D-04: In the emulator environment, Playwright/Chromium is not
    // available server-side, so PDF generation returns 500. This is expected and acceptable.
    // What we validate is that auth enforcement works: the endpoint MUST NOT return
    // 401 (unauthenticated) or 403 (unauthorized). A 200 means PDF generated successfully;
    // a 500 means auth passed but PDF rendering failed due to emulator limitations.
    expect(response.status()).not.toBe(401);
    expect(response.status()).not.toBe(403);

    // When PDF generation succeeds (200), verify the content-type is correct.
    // This is unconditional within the 200 branch — if status is 200, content-type MUST match.
    if (response.status() === 200) {
      const contentType = response.headers()["content-type"];
      expect(contentType).toContain("application/pdf");
    }
  });
});
