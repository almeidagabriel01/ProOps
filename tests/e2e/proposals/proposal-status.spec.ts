import { test, expect } from "../fixtures/auth.fixture";
import { ProposalsPage } from "../pages/proposals.page";
import { PROPOSAL_ALPHA_DRAFT, PROPOSAL_ALPHA_SENT } from "../seed/data/proposals";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { USER_ADMIN_ALPHA } from "../seed/data/users";

/**
 * PROP-06: Status transition E2E tests.
 *
 * Per D-05: Status changes are driven via backend API (PUT /api/backend/v1/proposals/:id).
 * Per D-06: Separate test per transition — draft->sent, sent->approved, sent->rejected.
 * Per D-07: Seed proposals provide field values for creating fresh proposals but are NOT mutated.
 * Per Pitfall 1: Each test creates a fresh proposal to avoid cross-test state pollution.
 * Per Pitfall 4: After PUT, navigate to proposals list before asserting UI status.
 */

test.describe("PROP-06: Status transitions", () => {

  test("draft -> sent: proposal status changes to sent", async ({ authenticatedPage }) => {
    // Obtain a Firebase ID token via the Auth emulator REST API (Node.js context).
    // page.request sends browser cookies but not the Authorization Bearer token.
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();

    // Create a fresh draft proposal via API to avoid mutating seed data
    const createResponse = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `Status Test Draft-Sent ${timestamp}`,
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
    const createData = await createResponse.json();
    // Backend returns { success: true, proposalId, message }
    const proposalId = createData.proposalId;
    expect(proposalId).toBeTruthy();

    // Transition: draft -> sent via API (per D-05)
    const putResponse = await authenticatedPage.request.put(
      `/api/backend/v1/proposals/${proposalId}`,
      {
        headers: { Authorization: `Bearer ${idToken}` },
        data: { status: "sent" },
      }
    );
    expect(putResponse.status()).toBe(200);

    // Verify UI reflects the change (per Pitfall 4: navigate/reload before asserting)
    const proposalsPage = new ProposalsPage(authenticatedPage);
    await proposalsPage.goto();
    await proposalsPage.isLoaded();

    // EXPLICIT assertion: read status from UI and verify it matches expected value
    // UI displays Portuguese labels: "Enviada" for sent
    const status = await proposalsPage.getProposalStatus(`Status Test Draft-Sent`);
    expect(status).toContain("Enviada");
  });

  test("sent -> approved: proposal status changes to approved", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();

    // Create a fresh proposal with "sent" status
    const createResponse = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `Status Test Sent-Approved ${timestamp}`,
        clientId: PROPOSAL_ALPHA_SENT.contactId,
        clientName: PROPOSAL_ALPHA_SENT.contactName,
        status: "sent",
        totalValue: PROPOSAL_ALPHA_SENT.total,
        products: PROPOSAL_ALPHA_SENT.items.map((item) => ({
          id: item.productId,
          name: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
      },
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const proposalId = createData.proposalId;

    // Transition: sent -> approved via API (per D-05)
    const putResponse = await authenticatedPage.request.put(
      `/api/backend/v1/proposals/${proposalId}`,
      {
        headers: { Authorization: `Bearer ${idToken}` },
        data: { status: "approved" },
      }
    );
    expect(putResponse.status()).toBe(200);

    // Verify UI reflects the change
    const proposalsPage = new ProposalsPage(authenticatedPage);
    await proposalsPage.goto();
    await proposalsPage.isLoaded();

    // EXPLICIT assertion: read status from UI and verify it matches expected value
    // UI displays Portuguese labels: "Aprovada" for approved
    const status = await proposalsPage.getProposalStatus(`Status Test Sent-Approved`);
    expect(status).toContain("Aprovada");
  });

  test("sent -> rejected: proposal status changes to rejected", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();

    // Create a fresh proposal with "sent" status
    const createResponse = await authenticatedPage.request.post("/api/backend/v1/proposals", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: `Status Test Sent-Rejected ${timestamp}`,
        clientId: PROPOSAL_ALPHA_SENT.contactId,
        clientName: PROPOSAL_ALPHA_SENT.contactName,
        status: "sent",
        totalValue: PROPOSAL_ALPHA_SENT.total,
        products: PROPOSAL_ALPHA_SENT.items.map((item) => ({
          id: item.productId,
          name: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
      },
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const proposalId = createData.proposalId;

    // Transition: sent -> rejected via API (per D-05)
    const putResponse = await authenticatedPage.request.put(
      `/api/backend/v1/proposals/${proposalId}`,
      {
        headers: { Authorization: `Bearer ${idToken}` },
        data: { status: "rejected" },
      }
    );
    expect(putResponse.status()).toBe(200);

    // Verify UI reflects the change
    const proposalsPage = new ProposalsPage(authenticatedPage);
    await proposalsPage.goto();
    await proposalsPage.isLoaded();

    // EXPLICIT assertion: read status from UI and verify it matches expected value
    // UI displays Portuguese labels: "Rejeitada" for rejected
    const status = await proposalsPage.getProposalStatus(`Status Test Sent-Rejected`);
    expect(status).toContain("Rejeitada");
  });
});
