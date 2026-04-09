# Phase 4: Financial Module E2E - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

E2E tests for the financial module: transaction CRUD (FIN-01/02/03), wallet creation and balance transfers (FIN-04), wallet balance atomicity verification (FIN-05), and installment creation + individual payment marking (FIN-06). This phase only adds tests — the financial features, data model, and API routes are already in production.

</domain>

<decisions>
## Implementation Decisions

### Transaction CRUD (FIN-01, FIN-02, FIN-03)
- **D-01:** Tests drive creation and editing through the **full browser UI wizard** — filling all steps sequentially in order (type selector → details → payment → review). Consistent with Phase 3 CRUD approach.
- **D-02:** The POM fills all steps sequentially via Next button clicks, not by jumping to steps via step indicators. Tests the wizard navigation itself.
- **D-03:** Deletion is UI-driven (click delete action + confirm dialog). `create-then-delete` pattern: tests that mutate data create their own fixture and clean up after themselves. Do NOT mutate seeded transactions.

### Installment Transaction (FIN-06)
- **D-04:** Installment group is **created via backend API** (`POST /api/backend/transactions` with installment fields). The installment payment-step in the UI form is complex — API creation isolates the "mark as paid" verification.
- **D-05:** Marking individual installments as paid is done **via the UI** — click the installment row/button in the transactions list or detail view. Tests the UI payment confirmation flow, which is the highest-value thing to cover in FIN-06.

### Wallet Operations (FIN-04)
- **D-06:** Wallet creation and balance transfer are both **UI-driven** — there is a full `/wallets` page with `WalletFormDialog` for creation and `TransferDialog` for transfers. Both flows are tested through the browser.
- **D-07:** A new `WalletsPage` POM should be created at `e2e/pages/wallets.page.ts` (analogous to `ProposalsPage`) covering: `goto()`, `isLoaded()`, `createWallet(data)`, `openTransferDialog(walletName)`, `submitTransfer(data)`.

### Balance Verification (FIN-05)
- **D-08:** Balance atomicity is verified via **UI display only** — read the balance shown on the wallets page after the transfer. Tests what the user actually sees. No Firestore Admin SDK check needed.

### Seed Data Strategy
- **D-09:** Seeded transactions (`TRANSACTION_ALPHA_*`) and wallets (`WALLET_ALPHA_*`) are **read-only** — used as context for list/display assertions only. Tests that mutate data (create/edit/delete/transfer) create their own objects and clean up after themselves.

### Claude's Discretion
- Exact minimum required fields for the transaction creation form (read the form component)
- `TransactionsPage` POM method signatures and locator strategies
- API payload shape for creating installment transactions (read `transactions.controller.ts` + `transaction.service.ts`)
- Exact UI element for marking an installment as paid (read `installments-card.tsx` or `transaction-installments-list.tsx`)
- Whether to add a separate `TransactionDetailPage` POM or extend `TransactionsPage`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1–3 infrastructure (extend, don't rewrite)
- `e2e/fixtures/auth.fixture.ts` — `authenticatedPage` fixture; `interceptFirebaseRequests()`
- `e2e/fixtures/base.fixture.ts` — `setupEmulatorRoutes()`, base fixture with POM instances
- `e2e/seed/data/transactions.ts` — `TRANSACTION_ALPHA_INCOME`, `TRANSACTION_ALPHA_EXPENSE`, `TRANSACTION_ALPHA_INSTALLMENT` (read-only seed)
- `e2e/seed/data/wallets.ts` — `WALLET_ALPHA_MAIN`, `WALLET_ALPHA_SAVINGS` (read-only seed)
- `e2e/pages/transactions.page.ts` — Existing minimal `TransactionsPage` POM to extend
- `e2e/seed/seed-factory.ts` — Add `seedTransactions()`, `seedWallets()` if not already present

### Financial module domain docs (CRITICAL — read before implementing)
- `src/app/transactions/CLAUDE.md` — Wallet ID vs NAME migration, installment group structure, race condition guards, proposal-guard behavior
- `functions/CLAUDE.md` § "Módulo Financeiro" — `resolveWalletRef()`, `getWalletImpacts()` balance logic, `syncExtraCostsStatus()`, atomicity pattern
- `functions/src/api/controllers/wallets.CLAUDE.md` — Wallet controller specifics
- `functions/src/api/controllers/transactions.CLAUDE.md` — Transaction controller specifics

### Backend API routes (what tests call)
- `functions/src/api/routes/finance.routes.ts` — `POST /transactions`, `PUT /transactions/:id`, `DELETE /transactions/:id`, `POST /wallets`, `POST /wallets/transfer` (or wallets controller `transferValues`)
- `functions/src/api/controllers/wallets.controller.ts` — `transferValues` endpoint shape (line ~276: creates `transfer_out` + `transfer_in` pair)

### Frontend UI structure (what the POM drives)
- `src/app/transactions/_components/form-steps/` — Multi-step wizard steps (type → details → payment → review)
- `src/app/transactions/_components/installments-card.tsx` — UI for marking installments paid
- `src/app/transactions/_components/transaction-installments-list.tsx` — Alternative installment list UI
- `src/app/wallets/_components/wallets-dialogs.tsx` — `WalletFormDialog` + `TransferDialog` component refs
- `src/app/wallets/_hooks/use-wallets-ctrl.ts` — Transfer dialog trigger pattern

### Requirements
- `.planning/REQUIREMENTS.md` — FIN-01 through FIN-06 acceptance criteria

### Emulator topology (Phase 2/3 established)
- Auth emulator: `http://127.0.0.1:9099`
- Firestore emulator: `http://127.0.0.1:8080`
- Functions emulator: `http://127.0.0.1:5001`
- Project ID: `demo-proops-test`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TransactionsPage` (`e2e/pages/transactions.page.ts`): Has `goto()`, `isLoaded()`, `getTransactionCount()`, `clickNewTransaction()` — extend with `createTransaction()`, `editTransaction()`, `deleteTransaction()`, `getTransactionByDescription()`
- `authenticatedPage` fixture: Handles login + emulator routing — all financial tests use this
- Seed transactions/wallets: 3 alpha transactions + 2 alpha wallets seeded — use as read-only list context, not mutation targets
- Phase 3 patterns: `create-then-delete`, API-driven status changes, row-boundary guard locators

### Established Patterns
- `create-then-delete` isolation (Phase 1/3): Tests own their data, clean up after
- Auth fixture emulator routing: `interceptFirebaseRequests()` handles SDK URL rewriting — no additional setup
- API-for-complex-setup: Phase 3 used API for status transitions and share tokens; same here for installment group creation
- Row locator pattern: Use Playwright filter chains (Phase 3 fix) rather than ancestor-walk `evaluate()` for table row targeting

### Integration Points
- `e2e/seed/seed-factory.ts`: Add `seedTransactions()` / `seedWallets()` if not already called (check current factory)
- `e2e/fixtures/base.fixture.ts`: Add `TransactionsPage` and `WalletsPage` POM instances if not already present
- New `WalletsPage` POM at `e2e/pages/wallets.page.ts` needed (no wallet POM exists yet)

### Financial Module Complexity Notes
- Wallet `balance` is denormalized — atomically updated via `FieldValue.increment()` in Firestore transactions
- Transaction `wallet` field may be wallet NAME or ID (legacy migration) — backend resolves both via `resolveWalletRef()`
- Installment group: multiple Firestore documents linked by `installmentGroupId` — API creates all documents in one call
- Paid transactions linked to approved proposals CANNOT be reverted — don't create tests that would hit this guard

</code_context>

<specifics>
## Specific Ideas

No specific references from discussion — open to standard approaches following the established Phase 3 patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-financial-module-e2e*
*Context gathered: 2026-04-07*
