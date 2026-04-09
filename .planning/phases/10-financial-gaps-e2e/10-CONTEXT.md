# Phase 10: Financial Gaps E2E — Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

E2E tests closing three financial coverage gaps:
- **FIN-07**: CRUD for `expense`-type transactions (FIN-01/02/03 only covered `income`)
- **FIN-08**: Selective installment payment — pay individual installments without paying all; verify remaining stay unpaid
- **FIN-09**: Proposal approval → `syncApprovedProposalTransactions` → verify synced transactions appear in the financial module

This phase only adds tests — no production code changes.

</domain>

<decisions>
## Implementation Decisions

### FIN-07: Expense Transaction CRUD

- **D-01:** Expense CRUD tests go **in the existing `e2e/financial/transaction-crud.spec.ts`** — add FIN-07 describe blocks alongside FIN-01/02/03. No new file needed.
- **D-02:** The expense wizard uses the **same 4-step UI flow** as income — only the type selector changes (select "Despesa" on step 1). The existing `createTransaction({type: 'expense', ...})` POM method works as-is; no new POM methods needed.
- **D-03:** Carry forward Phase 4 D-01/D-02/D-03: wizard-driven, sequential step navigation, `create-then-delete` pattern. Seeded `TRANSACTION_ALPHA_EXPENSE` is read-only.

### FIN-08: Selective Installment Payment

- **D-04:** FIN-08 is a **standalone test** in `e2e/financial/installments.spec.ts` — not an extension of FIN-06. Clear, independent assertion of the selective payment requirement.
- **D-05:** Installment group is **created via backend API** (same as D-04 from Phase 4). No UI wizard.
- **D-06:** Test flow: create 3-installment group via API → mark installments 1/3 and 2/3 as paid via UI → **explicitly assert installment 3/3 still shows "Pendente"**. The assertion on the unpaid installment is the core of FIN-08.
- **D-07:** Sequential payment order from Phase 4 Pitfall 3 still applies: mark 1/3 before 2/3.

### FIN-09: Proposal Approval → Transaction Sync

- **D-08:** Proposal structure: **simple single-payment** — no down payment, no installments. Approval creates exactly 1 income transaction. Easiest to assert and avoids overlapping with FIN-06/FIN-08.
- **D-09:** Transaction verification is **UI-only**: after approval, navigate to `/transactions` and find a transaction whose description matches the proposal title. The `syncApprovedProposalTransactions` function sets `description = normalizeProposalTransactionTitle(proposalData.title)` (see `proposals.controller.ts:647`).
- **D-10:** Proposal approval is triggered via **backend API** (`PUT /api/backend/v1/proposals/:id` with `{status: "approved"}`). Pattern carries forward from Phase 3 `proposal-status.spec.ts` D-05 — status transitions are always API-driven.
- **D-11:** Test isolation: create a fresh proposal (via API), approve it, verify transaction in UI, cleanup via API (`DELETE /api/backend/v1/proposals/:id`). The synced transactions should be deleted by the proposal deletion or cleaned up via their own API call if they persist.
- **D-12:** Transaction amount to assert: the proposal `totalValue` matches the synced transaction `amount`. Verify both description and the transaction is visible in the list.

### Claude's Discretion
- Whether the `/transactions` list needs a page reload after approval before the synced transaction appears (or if optimistic updates handle it)
- Exact cleanup needed for FIN-09 — whether deleting the proposal cascades to delete synced transactions or if a separate transaction DELETE is needed
- Whether `TransactionsPage.getTransactionByDescription()` needs a case-insensitive or normalized match for proposal titles

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing E2E infrastructure to extend
- `e2e/financial/transaction-crud.spec.ts` — FIN-01/02/03 income CRUD; FIN-07 expense blocks go here
- `e2e/financial/installments.spec.ts` — FIN-06 installment test; FIN-08 standalone test goes here
- `e2e/pages/transactions.page.ts` — `TransactionsPage` POM (`createTransaction`, `editTransaction`, `deleteTransaction`, `getTransactionByDescription`)
- `e2e/proposals/proposal-status.spec.ts` — Pattern for API-driven status transitions + UI verification (reuse for FIN-09)
- `e2e/pages/proposals.page.ts` — `ProposalsPage` POM with `getProposalStatus()`

### Phase 4 context (locked decisions)
- `.planning/phases/04-financial-module-e2e/04-CONTEXT.md` — D-01 through D-09 all carry forward

### Phase 3 context (proposal patterns)
- `.planning/phases/03-proposals-crm-e2e/03-CONTEXT.md` — D-05: API-driven status transitions

### Backend sync function (critical for FIN-09)
- `functions/src/api/controllers/proposals.controller.ts:782` — `syncApprovedProposalTransactions` function
- `functions/src/api/controllers/proposals.controller.ts:647` — `description: title` (synced transaction description = proposal title)
- `functions/src/api/routes/finance.routes.ts` — No GET /transactions endpoint exists; verification must be UI or Admin SDK

### Seed data
- `e2e/seed/data/proposals.ts` — `PROPOSAL_ALPHA_SENT` fields to clone for the FIN-09 test proposal (clientId, contactName, items)
- `e2e/seed/data/transactions.ts` — `TRANSACTION_ALPHA_EXPENSE` (read-only, never mutate)

### Emulator topology (Phase 2 established)
- Auth emulator: `http://127.0.0.1:9099`
- Firestore emulator: `http://127.0.0.1:8080`
- Functions emulator: `http://127.0.0.1:5001`
- Project ID: `demo-proops-test`

### Requirements
- `.planning/REQUIREMENTS.md` — FIN-07, FIN-08, FIN-09 acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TransactionsPage` POM: `createTransaction({type, description, amount, walletName})` — works for both income and expense
- `authenticatedPage` fixture: handles login + emulator routing — all tests use this
- `signInWithEmailPassword()` helper: needed for API calls requiring Bearer token
- `ProposalsPage` POM: `createProposal()`, `getProposalStatus()` — available if UI proposal creation needed
- Phase 3 `proposal-status.spec.ts`: exact pattern for create proposal via API → status transition via API → verify in UI

### Established Patterns
- `create-then-delete` isolation (Phase 4): tests own their data
- API-driven status transitions (Phase 3): always use `PUT /api/backend/v1/proposals/:id` for status changes
- API-driven complex setup (Phase 4 D-04): installment groups created via POST API
- Row locator pattern: Playwright filter chains (not ancestor-walk evaluate)
- Portal dropdown pattern: `body > div[style*='position: fixed']` scoped click for installment status changes (Phase 4 FIN-06)

### Key Behavioral Note (FIN-09)
`syncApprovedProposalTransactions` is called inside the `updateProposal` controller when `shouldSyncApprovedTransactions` is true. This happens synchronously before the API returns 200. So after the PUT returns, the transaction should already exist in Firestore — no polling needed.

</code_context>

<deferred>
## Deferred Ideas

None surfaced during this discussion.
</deferred>
