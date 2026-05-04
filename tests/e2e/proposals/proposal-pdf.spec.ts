import { test, expect } from "../fixtures/auth.fixture";
import { PROPOSAL_ALPHA_APPROVED, PROPOSAL_ALPHA_DRAFT } from "../seed/data/proposals";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { USER_ADMIN_ALPHA } from "../seed/data/users";
import { ProposalsPage } from "../pages/proposals.page";

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

test.describe("PROP-04-B: Edited proposal PDF generation", () => {
  test("edited proposal title persists and PDF endpoint is accessible", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const originalTitle = `PDF Edit Test ${timestamp}`;
    const editedTitle = `PDF Edited ${timestamp}`;

    // Create a fresh proposal via API (D-07: never mutate seed proposals)
    const createResponse = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: originalTitle,
        clientId: PROPOSAL_ALPHA_DRAFT.contactId,
        clientName: PROPOSAL_ALPHA_DRAFT.contactName,
        status: "draft",
        totalValue: PROPOSAL_ALPHA_DRAFT.total,
        products: PROPOSAL_ALPHA_DRAFT.items.map((item) => ({
          id: item.productId,
          name: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
      },
    });
    expect(createResponse.status()).toBe(201);
    const { proposalId } = await createResponse.json();
    expect(proposalId).toBeTruthy();

    // Edit the proposal title via API (D-05 pattern: same as status transitions in PROP-06).
    // The wizard requires phone + validUntil which API-created proposals don't have,
    // so UI edit is tested separately in PROP-02. Here we focus on persistence → PDF.
    const putResponse = await authenticatedPage.request.put(
      `/api/backend/v1/proposals/${proposalId}`,
      {
        headers: { Authorization: `Bearer ${idToken}` },
        data: { title: editedTitle },
      },
    );
    expect(putResponse.status()).toBe(200);

    const proposalsPage = new ProposalsPage(authenticatedPage);

    // Navigate to the proposals list and verify the edited title is persisted.
    // If this assertion passes, the data that will be used by the PDF generator is correct.
    await proposalsPage.goto();
    await proposalsPage.isLoaded();
    const editedProposal = await proposalsPage.getProposalByTitle(editedTitle);
    await expect(editedProposal).toBeVisible();

    // Call the PDF endpoint with the now-edited proposal
    const pdfResponse = await authenticatedPage.request.get(
      `/api/backend/v1/proposals/${proposalId}/pdf`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );

    // INTENTIONAL per D-04: emulator returns 500 (Playwright/Chromium unavailable server-side).
    // Validate auth enforcement — must NOT return 401 or 403.
    expect(pdfResponse.status()).not.toBe(401);
    expect(pdfResponse.status()).not.toBe(403);

    if (pdfResponse.status() === 200) {
      expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
    }

    // Cleanup: delete via UI (already on /proposals from the goto above)
    await proposalsPage.deleteProposal(editedTitle);
  });
});
