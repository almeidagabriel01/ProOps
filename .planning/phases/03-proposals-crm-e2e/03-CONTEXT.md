# Phase 3: Proposals & CRM E2E - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

E2E tests covering the full proposal lifecycle — CRUD operations (PROP-01/02/03), PDF generation endpoint (PROP-04), public share link access without authentication (PROP-05), and status lifecycle transitions (PROP-06). This phase only adds tests; the proposal feature implementation, data model, and API routes are already complete and out of scope.

</domain>

<decisions>
## Implementation Decisions

### CRUD Test Level (PROP-01, PROP-02, PROP-03)
- **D-01:** Tests drive creation and editing through the **full browser UI** — filling the form in Playwright as a real user would. Requires extending `ProposalsPage` POM with form-filling methods (`createProposal()`, `editProposal()`).
- **D-02:** Minimum required fields for a valid proposal are **Claude's discretion** — the implementer must read the proposal form component to identify required fields, then fill them in the POM method.
- **D-03:** Deletion is also UI-driven (click delete/confirm dialog). Follows the `create-then-delete` pattern from Phase 1 D-02 — tests that mutate data create their own fixture and clean up after.

### PDF Test Approach (PROP-04)
- **D-04:** The test verifies the **HTTP response only** — `GET /api/backend/proposals/:id/pdf` must return a non-401/non-403 status, proving the auth layer works. A 500 is acceptable in the emulator environment because Playwright/Chromium is not available server-side for actual PDF rendering (see RESEARCH.md Pitfall 2). If the endpoint returns 200, also verify `Content-Type: application/pdf`. No PDF content inspection. Rationale: the test validates auth enforcement and endpoint reachability, not PDF byte content.

### Status Transition Mechanics (PROP-06)
- **D-05:** Status changes are driven via **backend API** — `PUT /api/backend/proposals/:id` with the updated status field. Not through the kanban/UI. Rationale: kanban UI is complex and brittle for test purposes; what needs validation is that the status persists correctly and the UI reflects it.
- **D-06:** Status transitions are **separate tests per transition**, not a single chain. Tests: draft->sent, sent->approved, sent->rejected. Clearer failure messages; each transition is independently verifiable.
- **D-07:** Seed data already provides `PROPOSAL_ALPHA_DRAFT` (draft), `PROPOSAL_ALPHA_SENT` (sent), and `PROPOSAL_ALPHA_APPROVED` (approved) — tests should use these as starting states where possible, or create fresh proposals and set status via API.

### Public Share Link (PROP-05)
- **D-08:** The test **creates the share token via API** (`POST /api/backend/proposals/:id/share-link`) within the test, authenticated, then opens the resulting `/share/:token` URL in a fresh unauthenticated browser context.
- **D-09:** Verification: assert the public page (a) loads without redirecting to `/login` and (b) renders the proposal title/content. Strict: explicitly assert no redirect occurred (URL must remain `/share/:token`).

### Claude's Discretion
- Exact required form fields for proposal creation (read the form component)
- ProposalsPage POM method signatures and locator strategies
- Whether to add a `ProposalDetailPage` POM or extend `ProposalsPage`
- Exact locator for "delete" action and confirmation dialog
- How the public share page URL is returned from `POST /proposals/:id/share-link` response

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 & 2 infrastructure (extend, don't rewrite)
- `e2e/fixtures/auth.fixture.ts` — `authenticatedPage`, `authenticatedAsBeta` fixtures; `interceptFirebaseRequests()`
- `e2e/fixtures/base.fixture.ts` — `setupEmulatorRoutes()`, base fixture with POM instances
- `e2e/seed/data/proposals.ts` — `PROPOSAL_ALPHA_DRAFT`, `PROPOSAL_ALPHA_SENT`, `PROPOSAL_ALPHA_APPROVED`, `PROPOSAL_BETA_DRAFT` with known IDs
- `e2e/seed/data/users.ts` — `USER_ADMIN_ALPHA`, `USER_ADMIN_BETA` credentials
- `e2e/pages/proposals.page.ts` — Existing minimal `ProposalsPage` POM to extend

### Backend API routes (what the tests call)
- `functions/src/api/routes/core.routes.ts` — `POST /proposals`, `PUT /proposals/:id`, `DELETE /proposals/:id`, `GET /proposals/:id/pdf`, `POST /proposals/:id/share-link`
- `functions/src/api/routes/shared-proposals.routes.ts` — `GET /share/:token` (public, no auth middleware)

### Requirements
- `.planning/REQUIREMENTS.md` — PROP-01 through PROP-06 define exact acceptance criteria

### Emulator topology (from Phase 2 context)
- Auth emulator: `http://127.0.0.1:9099`
- Firestore emulator: `http://127.0.0.1:8080`
- Project ID: `demo-proops-test`
- Functions emulator: `http://127.0.0.1:5001`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ProposalsPage` (`e2e/pages/proposals.page.ts`): Has `goto()`, `isLoaded()`, `getProposalCount()`, `clickNewProposal()`, `getProposalByTitle()` — extend with `createProposal()`, `editProposal()`, `deleteProposal()` methods
- `authenticatedPage` fixture: Already handles login + emulator routing — all proposal tests should use this
- Seed proposals: 3 alpha proposals with different statuses — reuse as starting states for status transition tests

### Established Patterns
- `create-then-delete` pattern (Phase 1): Tests that mutate data create their own object and clean up after — don't mutate shared seed proposals
- Auth fixture emulator routing: `interceptFirebaseRequests()` handles SDK URL rewriting — no additional setup needed
- Isolation test pattern (Phase 2): Backend API + Firestore layers — not repeated in Phase 3 (already covered)

### Integration Points
- `src/app/proposals/` — The proposals UI route with `/proposals/new` for creation and `/proposals/[id]` for detail/edit
- `src/app/share/[token]/` — The public shared proposal page (unauthenticated)
- `src/app/api/backend/` — Next.js proxy; all test API calls go through this proxy, not directly to Functions
- `firestore.rules` — Proposals collection is tenant-isolated; direct Firestore access without matching tenantId is denied

</code_context>

<specifics>
## Specific Ideas

- PROP-05 public access test: use `browser.newPage()` with a fresh context (no `storageState`) to simulate unauthenticated user, not just a new incognito page
- Status transition tests (PROP-06): after API call, reload the proposal detail page (or navigate back) and assert the UI reflects the new status — confirms persistence, not just the API response

</specifics>

<deferred>
## Deferred Ideas

- Role-based access: testing that `member` role can view but not delete proposals — deferred to a later security phase
- Proposal duplication / clone feature — not in scope for Phase 3
- CRM contacts linkage E2E (verifying the contact appears on the proposal detail) — deferred; Phase 3 focuses on proposal lifecycle only

</deferred>

---

*Phase: 03-proposals-crm-e2e*
*Context gathered: 2026-04-07*
