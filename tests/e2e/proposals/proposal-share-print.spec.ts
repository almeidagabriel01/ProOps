import { test, expect } from "../fixtures/auth.fixture";
import { PROPOSAL_ALPHA_APPROVED } from "../seed/data/proposals";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { USER_ADMIN_ALPHA } from "../seed/data/users";

test.describe("PROP-06: Cookie banner hidden in PDF/print", () => {
  test("cookie consent banner is suppressed under print media on the public share page", async ({
    authenticatedPage,
    browser,
  }) => {
    // Sign in against the Auth emulator to obtain a Bearer token for the API call
    // (page.request sends cookies, not the Authorization header) — same as PROP-05.
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const shareResponse = await authenticatedPage.request.post(
      `/api/backend/v1/proposals/${PROPOSAL_ALPHA_APPROVED.id}/share-link`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect(shareResponse.status()).toBe(201);
    const { token } = await shareResponse.json();
    expect(token).toBeTruthy();

    // Fresh, unauthenticated context with EMPTY localStorage — exactly what the
    // backend Playwright renderer sees. The base fixture's cookie pre-dismissal
    // only runs on the `page` fixture, so browser.newPage() lets the banner
    // actually render, reproducing the real PDF-generation scenario.
    const publicPage = await browser.newPage();
    await publicPage.goto(`/share/${token}`);
    await publicPage.waitForLoadState("networkidle");

    const cookieBanner = publicPage.getByRole("button", { name: "Entendi" });

    // Screen media: the banner renders (bug scenario is reproduced).
    await expect(cookieBanner).toBeVisible();

    // Print media: the real PDF pipeline navigates with ?print=1 and calls
    // emulateMedia({ media: "print" }) before page.pdf(). The globals.css rule
    // `@media print { [data-pdf-ui] { display: none } }` must hide the banner.
    await publicPage.emulateMedia({ media: "print" });
    await expect(cookieBanner).not.toBeVisible();

    await publicPage.close();
  });
});
