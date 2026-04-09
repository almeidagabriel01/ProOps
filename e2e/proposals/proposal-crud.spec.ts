/**
 * Proposal CRUD E2E tests — PROP-01 through PROP-03.
 *
 * PROP-01: Create proposal — drives full UI wizard form and verifies proposal appears in list
 * PROP-02: Edit proposal — edits title through form and verifies change persists in list
 * PROP-03: Delete proposal — deletes via list action + confirmation dialog, verifies removal
 *
 * All tests use the create-then-delete pattern per D-03:
 * - Tests create their own proposals and clean up after
 * - Shared seed proposals (PROPOSAL_ALPHA_DRAFT, etc.) are never mutated
 * - Date.now() in titles prevents collisions between parallel test runs
 */

import { test, expect } from "../fixtures/auth.fixture";
import { ProposalsPage } from "../pages/proposals.page";

// ─── PROP-01: Create proposal ────────────────────────────────────────────────

test.describe("PROP-01: Create proposal", () => {
  test("creates a proposal with valid data and it appears in the list", async ({ authenticatedPage }) => {
    const proposalsPage = new ProposalsPage(authenticatedPage);
    await proposalsPage.goto();
    await proposalsPage.isLoaded();

    const testTitle = `Test Proposal ${Date.now()}`;

    await proposalsPage.createProposal({ title: testTitle, clientName: "Joao Silva" });

    // Navigate back to proposals list (createProposal may redirect to edit-pdf)
    await proposalsPage.goto();
    await proposalsPage.isLoaded();

    // Assert the new proposal appears in the list
    const item = await proposalsPage.getProposalByTitle(testTitle);
    await expect(item).toBeVisible();

    // Cleanup: delete the created proposal
    await proposalsPage.deleteProposal(testTitle);
  });
});

// ─── PROP-02: Edit proposal ───────────────────────────────────────────────────

test.describe("PROP-02: Edit proposal", () => {
  test("edits an existing proposal title and changes persist in the list", async ({ authenticatedPage }) => {
    const proposalsPage = new ProposalsPage(authenticatedPage);
    await proposalsPage.goto();
    await proposalsPage.isLoaded();

    // Create a fresh proposal to edit (create-then-delete pattern per D-03)
    const originalTitle = `Edit Target ${Date.now()}`;
    await proposalsPage.createProposal({ title: originalTitle, clientName: "Joao Silva" });

    // Navigate back to list and find the new proposal
    await proposalsPage.goto();
    await proposalsPage.isLoaded();

    const beforeEdit = await proposalsPage.getProposalByTitle(originalTitle);
    await expect(beforeEdit).toBeVisible();

    // Click the proposal title link to open the edit form
    await beforeEdit.click();
    await authenticatedPage.waitForURL(/\/proposals\/[^/]+$/, { timeout: 15000 });

    // Extract the proposal ID from the URL
    const url = authenticatedPage.url();
    const proposalId = url.split("/proposals/")[1]?.split("?")[0] ?? "";
    expect(proposalId).toBeTruthy();

    // Edit the title using the editProposal POM method
    const editedTitle = `Edited Proposal ${Date.now()}`;
    await proposalsPage.editProposal(proposalId, { title: editedTitle });

    // Navigate back to the proposals list and verify the edited title appears
    await proposalsPage.goto();
    await proposalsPage.isLoaded();

    const afterEdit = await proposalsPage.getProposalByTitle(editedTitle);
    await expect(afterEdit).toBeVisible();

    // Cleanup: delete the edited proposal
    await proposalsPage.deleteProposal(editedTitle);
  });
});

// ─── PROP-03: Delete proposal ─────────────────────────────────────────────────

test.describe("PROP-03: Delete proposal", () => {
  test("deletes a proposal and it disappears from the list", async ({ authenticatedPage }) => {
    const proposalsPage = new ProposalsPage(authenticatedPage);
    await proposalsPage.goto();
    await proposalsPage.isLoaded();

    // Create a fresh proposal to delete (create-then-delete pattern per D-03)
    const deleteTitle = `Delete Target ${Date.now()}`;
    await proposalsPage.createProposal({ title: deleteTitle, clientName: "Joao Silva" });

    // Navigate back to the proposals list
    await proposalsPage.goto();
    await proposalsPage.isLoaded();

    // Verify the proposal is visible before deletion
    const before = await proposalsPage.getProposalByTitle(deleteTitle);
    await expect(before).toBeVisible();

    // Delete the proposal through the UI
    await proposalsPage.deleteProposal(deleteTitle);

    // The page should stay on /proposals after deletion
    await expect(authenticatedPage).toHaveURL(/\/proposals/);

    // Verify the proposal is no longer visible in the list
    const after = await proposalsPage.getProposalByTitle(deleteTitle);
    await expect(after).not.toBeVisible();
  });
});
