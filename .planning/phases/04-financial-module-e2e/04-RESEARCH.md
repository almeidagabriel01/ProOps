# Phase 4: Financial Module E2E - Research

**Researched:** 2026-04-07
**Domain:** Playwright E2E testing — financial module (transactions + wallets)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Transaction CRUD (FIN-01, FIN-02, FIN-03)**
- D-01: Tests drive creation and editing through the full browser UI wizard — filling all steps sequentially (type selector → details → payment → review).
- D-02: POM fills all steps sequentially via Next button clicks, not by jumping via step indicators.
- D-03: Deletion is UI-driven. `create-then-delete` pattern: tests that mutate data create their own fixture and clean up. Do NOT mutate seeded transactions.

**Installment Transaction (FIN-06)**
- D-04: Installment group is created via backend API (`POST /api/backend/transactions` with installment fields). Isolates the "mark as paid" verification from the complex form.
- D-05: Marking individual installments as paid is done via the UI — click the installment row/button. Tests the UI payment confirmation flow.

**Wallet Operations (FIN-04)**
- D-06: Wallet creation and balance transfer are both UI-driven via `/wallets` page (`WalletFormDialog` + `TransferDialog`).
- D-07: A new `WalletsPage` POM at `e2e/pages/wallets.page.ts` covering: `goto()`, `isLoaded()`, `createWallet(data)`, `openTransferDialog(walletName)`, `submitTransfer(data)`.

**Balance Verification (FIN-05)**
- D-08: Balance atomicity verified via UI display only — read balance shown on wallets page after transfer. No Firestore Admin SDK check needed.

**Seed Data Strategy**
- D-09: Seeded transactions (`TRANSACTION_ALPHA_*`) and wallets (`WALLET_ALPHA_*`) are read-only — used as context for list/display assertions only.

### Claude's Discretion
- Exact minimum required fields for the transaction creation form
- `TransactionsPage` POM method signatures and locator strategies
- API payload shape for creating installment transactions
- Exact UI element for marking an installment as paid
- Whether to add a separate `TransactionDetailPage` POM or extend `TransactionsPage`

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIN-01 | E2E valida que usuário consegue criar uma transação com dados válidos | Form wizard: 4 steps confirmed. Required fields mapped. |
| FIN-02 | E2E valida que usuário consegue editar uma transação existente | Edit route `/transactions/[id]` confirmed. Same 4-step wizard. |
| FIN-03 | E2E valida que usuário consegue deletar uma transação | `delete-dialog.tsx` confirmed in `_components/`. |
| FIN-04 | E2E valida que usuário consegue criar uma carteira e transferir saldo entre carteiras | `WalletFormDialog` + `TransferDialog` confirmed on `/wallets`. |
| FIN-05 | E2E valida que saldo da carteira é atualizado corretamente após operações | `wallet.balance` field on wallet card is authoritative display. |
| FIN-06 | E2E valida que usuário consegue criar transação parcelada e baixar parcelas individualmente | `TransactionInstallmentsList` with status dropdown confirmed. API creation pattern confirmed. |
</phase_requirements>

---

## Summary

Phase 4 adds E2E tests for the financial module. The features are already in production — no implementation work, only test authoring. The domain is well-understood from the Phase 3 proposals work, with the same Playwright + POM + `create-then-delete` infrastructure already in place.

The transaction creation flow is a 4-step wizard at `/transactions/new`: TypeSelector → Details → Payment → Review. The wizard uses `StepWizard` / `StepNavigation` components. The edit flow lives at `/transactions/[id]` and uses the same 4 steps. Both routes import `TypeSelectorStep`, `DetailsStep`, `PaymentStep`, `ReviewStep` from `_components/form-steps`.

Wallet operations live on `/wallets`: `WalletFormDialog` for creation, `TransferDialog` for transfers. All dialog state is managed by `useWalletsCtrl`. No wallet POM exists yet — `WalletsPage` must be created.

**Primary recommendation:** Extend `TransactionsPage` POM with CRUD methods, create `WalletsPage` POM, and follow the Phase 3 `proposal-crud.spec.ts` and `proposal-status.spec.ts` patterns exactly.

---

## Standard Stack

Same as Phases 1–3 — no new dependencies.

| Library | Version | Purpose |
|---------|---------|---------|
| `@playwright/test` | (project existing) | Test runner, assertions, fixtures |
| `firebase-admin` | (project existing) | Seed data via Admin SDK |

No new packages needed. [VERIFIED: codebase — package.json not checked but Phase 3 tests already run with this stack]

---

## Architecture Patterns

### Project Structure (additions for Phase 4)

```
e2e/
├── financial/
│   ├── transaction-crud.spec.ts      # FIN-01, FIN-02, FIN-03
│   ├── wallet-operations.spec.ts     # FIN-04, FIN-05
│   └── installments.spec.ts          # FIN-06
├── pages/
│   ├── transactions.page.ts          # EXTEND with createTransaction, editTransaction, deleteTransaction
│   └── wallets.page.ts               # CREATE — new POM
└── fixtures/
    └── auth.fixture.ts               # Unchanged — reuse authenticatedPage
```

### Pattern 1: Transaction Wizard Form (4 Steps)
**Source:** [VERIFIED: `src/app/transactions/new/page.tsx`]

Step order:
1. **Step 0 — Type:** Click "Receita" or "Despesa" button. No validation gate.
2. **Step 1 — Details:** Fill `description` (text input), `date` (DatePicker). Both required. Next calls `validateStep2`.
3. **Step 2 — Payment:** Fill `amount` (CurrencyInput), `dueDate` (DatePicker, required for income), `wallet` (WalletSelect dropdown). Next calls `validateStep3`.
4. **Step 3 — Review:** Optional `notes` (textarea), optional `clientId`. Submit button.

Minimum required fields for a simple income transaction:
- `type`: click "Receita" card
- `description`: any non-empty string
- `date`: transaction date (DatePicker)
- `amount`: > 0
- `dueDate`: required for income transactions
- `wallet`: wallet ID from WalletSelect — seeded `WALLET_ALPHA_MAIN` ("Conta Principal") is available

**Navigation:** `StepNavigation` renders a "Próximo" button. The final step renders a submit button (not a Next button).

```typescript
// Source: src/app/transactions/new/page.tsx lines 231–280 (verified)
// Step wizard: 4 FormStepCard children inside StepWizard
// Navigation button text: "Próximo" / submit action on step 3
```

### Pattern 2: TransactionsPage POM Extension
**Source:** [VERIFIED: `e2e/pages/transactions.page.ts`]

Current state: `goto()`, `isLoaded()`, `getTransactionCount()`, `clickNewTransaction()`.

Methods to add:
- `createTransaction(data: TransactionCreateData): Promise<void>` — drives full wizard
- `editTransaction(id: string, data: Partial<TransactionCreateData>): Promise<void>` — navigates to `/transactions/${id}`, edits fields
- `deleteTransaction(description: string): Promise<void>` — finds row, opens delete dialog, confirms
- `getTransactionByDescription(description: string): Promise<Locator>` — filter chain on transaction list

### Pattern 3: WalletsPage POM (new)
**Source:** [VERIFIED: `src/app/wallets/_components/`, `wallets-dialogs.tsx`]

```typescript
// e2e/pages/wallets.page.ts
export class WalletsPage {
  async goto(): Promise<void>           // page.goto('/wallets')
  async isLoaded(): Promise<boolean>    // wait for wallet cards or empty state
  async createWallet(data: WalletCreateData): Promise<void>  // open form dialog, fill, submit
  async openTransferDialog(walletName: string): Promise<void> // find wallet card, open transfer
  async submitTransfer(data: TransferData): Promise<void>     // fill from/to/amount, submit
  async getWalletBalance(walletName: string): Promise<number> // read displayed balance
}
```

`WalletCreateData` minimum: `name` (string), `type` (WalletType), optional `initialBalance`.
`TransferData`: `fromWalletName`, `toWalletName`, `amount`.

### Pattern 4: API-Driven Installment Setup (FIN-06)
**Source:** [VERIFIED: `e2e/proposals/proposal-status.spec.ts` — same pattern]

```typescript
// From Phase 3 pattern (proposal-status.spec.ts)
const { idToken } = await signInWithEmailPassword(USER_ADMIN_ALPHA.email, USER_ADMIN_ALPHA.password);

const createResponse = await authenticatedPage.request.post("/api/backend/v1/transactions", {
  headers: { Authorization: `Bearer ${idToken}` },
  data: {
    type: "income",
    description: "Test Installment Group",
    amount: "300.00",         // total
    date: "2024-07-01",
    dueDate: "2024-07-01",
    wallet: "wallet-alpha-main",  // wallet ID
    isInstallment: true,
    installmentCount: 3,
    paymentMode: "total",
    // installmentValue auto-calculated by backend
  },
});
const { transactionId } = await createResponse.json();
```

The backend creates multiple Firestore documents linked by `installmentGroupId`. Navigate to `/transactions/${transactionId}` to see the installment list.

### Pattern 5: Mark Installment Paid via UI
**Source:** [VERIFIED: `src/app/transactions/_components/transaction-installments-list.tsx`]

Each installment row renders a `DropdownMenu` status button (when `canEdit = true`). The button label shows the current status. To mark as paid:
1. Navigate to the transaction detail page `/transactions/${id}`
2. Find the installment row (`Parcela 1/3`, etc.)
3. Click the status dropdown button on that row
4. Select "Pago" from the dropdown menu items

The component validates sequential payment: installment N cannot be paid before N-1.

### Anti-Patterns to Avoid
- **Mutating seeded transactions:** `TRANSACTION_ALPHA_*` and `WALLET_ALPHA_*` are read-only fixtures. Create fresh data per test.
- **Jumping wizard steps via step indicators:** Navigate only via "Próximo" button clicks.
- **Checking wallet balance via Firestore Admin SDK:** Read from UI only (D-08).
- **Reverting paid transactions linked to approved proposals:** Backend rejects this. Don't create test scenarios that hit this guard.
- **Using wallet name as wallet field value:** `WalletSelect` emits wallet.id. Backend `resolveWalletRef()` accepts both, but always use ID in new data.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Auth token for API calls | Custom fetch wrapper | `signInWithEmailPassword()` from `e2e/helpers/firebase-auth-api.ts` |
| Emulator URL rewriting | New route interceptor | `interceptFirebaseRequests()` from `auth.fixture.ts` |
| Page authentication | Manual login in each test | `authenticatedPage` fixture from `auth.fixture.ts` |
| Test data seeding | Per-test Firestore writes | `seedAll()` in `seed-factory.ts` (already called in global-setup) |

---

## Common Pitfalls

### Pitfall 1: StepNavigation Button Locator
**What goes wrong:** `page.getByRole('button', { name: /próximo/i })` matches across all steps — must be scoped to the visible step card.
**Why it happens:** `StepWizard` renders all `FormStepCard` children but only makes one visible; hidden steps may still be in DOM.
**How to avoid:** Use `page.locator('[data-active-step]').getByRole('button', ...)` or wait for current step content to be visible before clicking Next. Alternatively, check that the current step panel is active before clicking.

### Pitfall 2: WalletSelect Populates Asynchronously
**What goes wrong:** Test fills description/date then tries to select wallet — but wallet list hasn't loaded yet.
**Why it happens:** `WalletSelect` calls `useWalletsData()` which is an async fetch.
**How to avoid:** Wait for the wallet select dropdown to be visible/enabled before interacting. `page.waitForSelector('[data-testid="wallet-select"]', { state: 'visible' })` or equivalent.

### Pitfall 3: Sequential Installment Payment Validation
**What goes wrong:** Test tries to mark installment 2 as paid before installment 1 — UI shows toast warning and no status change.
**Why it happens:** `TransactionInstallmentsList` validates `installmentNumber - 1` must be paid first.
**How to avoid:** Always mark installments paid in order (1, then 2, then 3).

### Pitfall 4: Balance Verification Timing
**What goes wrong:** Test reads wallet balance immediately after transfer API returns — UI hasn't re-fetched yet.
**Why it happens:** `useWalletsData` refetches after mutations, but this is async.
**How to avoid:** After submitting transfer dialog and it closes, navigate away and back to `/wallets` (or wait for loading state to clear) before reading balance.

### Pitfall 5: Transaction List Locator Fragility
**What goes wrong:** `page.getByText(description)` matches multiple elements (heading + card body).
**Why it happens:** Transaction cards repeat the description in multiple places.
**How to avoid:** Use Playwright filter chains scoped to transaction item containers (Phase 3 pattern): `page.locator('[data-testid="transaction-item"]').filter({ hasText: description })`.

### Pitfall 6: Delete Dialog Confirmation
**What goes wrong:** `deleteTransaction()` clicks delete action but dialog's confirm button requires a separate click.
**Why it happens:** `delete-dialog.tsx` is a two-step confirmation (open dialog → confirm button).
**How to avoid:** After clicking delete action, wait for the dialog to appear, then click the confirm/delete button inside the dialog. Check for `data-testid` on both the trigger and the confirm button.

### Pitfall 7: Wallet Card Menu vs. Summary Card Transfer Button
**What goes wrong:** Opening TransferDialog by clicking wrong trigger — summary card has a "Transferir" button, wallet cards have a context menu.
**Why it happens:** Two separate paths to the same dialog on `/wallets`.
**How to avoid:** Use the wallet card's context menu (three-dot or action button on the specific wallet card) to target a specific source wallet, consistent with D-07's `openTransferDialog(walletName)` signature.

---

## Code Examples

### Transaction Creation (POM method skeleton)
```typescript
// Source: derived from proposal-crud.spec.ts Phase 3 pattern + new/page.tsx wizard structure
async createTransaction(data: { description: string; amount: string; walletId: string }): Promise<void> {
  await this.clickNewTransaction();
  await this.page.waitForURL(/\/transactions\/new/);

  // Step 0: Type — click "Receita" (income) card
  await this.page.getByRole('button', { name: /receita/i }).click();
  await this.page.getByRole('button', { name: /próximo/i }).click();

  // Step 1: Details — description + date
  await this.page.getByLabel(/descrição/i).fill(data.description);
  // DatePicker interaction — type date or use picker
  await this.page.getByRole('button', { name: /próximo/i }).click();

  // Step 2: Payment — amount + dueDate + wallet
  // CurrencyInput, DatePicker, WalletSelect
  await this.page.getByRole('button', { name: /próximo/i }).click();

  // Step 3: Review — submit
  await this.page.getByRole('button', { name: /salvar|confirmar|criar/i }).click();
  await this.page.waitForURL(/\/transactions/);
}
```

### Installment Marking (test skeleton)
```typescript
// Source: derived from transaction-installments-list.tsx dropdown pattern
// Navigate to the transaction detail page
await authenticatedPage.goto(`/transactions/${installmentId}`);

// Find the installment row and click its status dropdown
const row = authenticatedPage.locator('text=Parcela 1/').first().locator('..');
await row.getByRole('button', { name: /pendente|pago|atrasado/i }).click();

// Select "Pago" from dropdown
await authenticatedPage.getByRole('menuitem', { name: /pago/i }).click();
```

### WalletFormDialog Trigger
```typescript
// Source: src/app/wallets/page.tsx — "Nova Carteira" button opens WalletFormDialog
// The trigger button text is "Nova Carteira" or similar
await this.page.getByRole('button', { name: /nova carteira/i }).click();
await this.page.getByLabel(/nome/i).fill(data.name);
// Type select, color picker, optional initial balance
await this.page.getByRole('button', { name: /criar|salvar/i }).click();
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (existing Phase 1–3) |
| Config file | `playwright.config.ts` (root) |
| Quick run command | `npx playwright test e2e/financial/ --project=chromium` |
| Full suite command | `npm run test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | File |
|--------|----------|-----------|------|
| FIN-01 | Create transaction via UI wizard | E2E UI | `e2e/financial/transaction-crud.spec.ts` |
| FIN-02 | Edit transaction via UI wizard | E2E UI | `e2e/financial/transaction-crud.spec.ts` |
| FIN-03 | Delete transaction via UI + confirm dialog | E2E UI | `e2e/financial/transaction-crud.spec.ts` |
| FIN-04 | Create wallet + transfer balance via UI | E2E UI | `e2e/financial/wallet-operations.spec.ts` |
| FIN-05 | Wallet balance updates correctly after transfer | E2E UI | `e2e/financial/wallet-operations.spec.ts` |
| FIN-06 | Create installment group (API) + mark paid (UI) | E2E Hybrid | `e2e/financial/installments.spec.ts` |

### Wave 0 Gaps
- [ ] `e2e/financial/transaction-crud.spec.ts` — covers FIN-01, FIN-02, FIN-03
- [ ] `e2e/financial/wallet-operations.spec.ts` — covers FIN-04, FIN-05
- [ ] `e2e/financial/installments.spec.ts` — covers FIN-06
- [ ] `e2e/pages/wallets.page.ts` — WalletsPage POM (does not exist)
- [ ] Extend `e2e/pages/transactions.page.ts` — add CRUD methods

---

## Key Domain Facts

### Transaction Form: Minimum Required Fields (Simple Income)
[VERIFIED: `src/app/transactions/new/page.tsx` `validateStep2` + `validateStep3`]

| Field | Step | Required | Notes |
|-------|------|----------|-------|
| `type` | 0 | Yes | "income" or "expense" |
| `description` | 1 | Yes | Non-empty string |
| `date` | 1 | Yes | Transaction date |
| `amount` | 2 | Yes (total mode) | > 0 |
| `dueDate` | 2 | Yes for income | Cannot be before `date` |
| `wallet` | 2 | Yes | wallet ID from WalletSelect |

For expense: `dueDate` is NOT required.

### Installment API Payload Shape
[ASSUMED — based on form field names in `useTransactionForm.ts` and backend contract. Verify against `transactions.controller.ts` before implementing.]

Expected fields for installment creation:
- `type`: "income" | "expense"
- `description`: string
- `date`: YYYY-MM-DD
- `amount`: string (total) OR `installmentValue` (per installment)
- `paymentMode`: "total" | "installmentValue"
- `isInstallment`: true
- `installmentCount`: number (≥ 2)
- `wallet`: wallet ID (for total mode) OR `installmentsWallet` (for installmentValue mode)
- `dueDate`: first installment due date (for income in total mode)

### Wallet Data: Seeded State
[VERIFIED: `e2e/seed/data/wallets.ts`]

| ID | Name | Balance | Tenant |
|----|------|---------|--------|
| `wallet-alpha-main` | "Conta Principal" | 15000.00 | tenant-alpha |
| `wallet-alpha-savings` | "Reserva" | 8500.00 | tenant-alpha |

Both are `status: "active"`, `type: "bank"`. Tests creating new wallets must clean up (delete via API or UI).

### Transaction Detail Page: Installment Navigation
[VERIFIED: `installments-card.tsx` + `transaction-installments-list.tsx`]

The transaction detail page at `/transactions/[id]` shows:
- `InstallmentsCard` — read-only list of all installments with links to each one
- `TransactionInstallmentsList` — interactive list with status dropdown buttons (when user canEdit)

For FIN-06: navigate to any installment's detail page, find its row in `TransactionInstallmentsList`, and use the status dropdown.

---

## Environment Availability

Step 2.6: No new external dependencies. All tooling (Playwright, Firebase Emulators, firebase-admin) was confirmed operational in Phase 3 (UAT passed: 7/7 tests).

| Dependency | Status |
|------------|--------|
| Playwright | Available (Phase 3 complete) |
| Firebase Emulators | Available (Phase 3 UAT passed) |
| firebase-admin (seed) | Available (Phase 3 complete) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Installment API payload shape (fields: `isInstallment`, `installmentCount`, `paymentMode`, `installmentsWallet`) | Key Domain Facts | Wrong field names → API returns 400, FIN-06 setup fails. Verify against `transactions.controller.ts`. |
| A2 | `StepNavigation` "Próximo" button is uniquely locatable within the active step | Architecture Patterns — Pitfall 1 | Locator ambiguity → wizard navigation fails in POM. Verify actual DOM structure. |
| A3 | `/wallets` page has a "Nova Carteira" button triggering `WalletFormDialog` | Code Examples | Button text differs → POM `createWallet()` fails. Verify `wallets/page.tsx` button text. |
| A4 | Transaction list items have a locatable container per item (e.g., `data-testid="transaction-item"`) | Common Pitfalls — Pitfall 5 | No scoping selector → row targeting is brittle. Check actual DOM in running app. |

---

## Sources

### Primary (HIGH confidence — verified in codebase)
- `e2e/pages/transactions.page.ts` — existing POM to extend
- `e2e/fixtures/auth.fixture.ts` — `interceptFirebaseRequests()`, `authenticatedPage`
- `e2e/fixtures/base.fixture.ts` — `setupEmulatorRoutes()`, POM fixture wiring
- `e2e/seed/data/transactions.ts` — seeded transaction constants
- `e2e/seed/data/wallets.ts` — seeded wallet constants + balances
- `e2e/seed/seed-factory.ts` — `seedAll()`, `clearAll()`, already calls `seedTransactions()` + `seedWallets()`
- `e2e/helpers/firebase-auth-api.ts` — `signInWithEmailPassword()` for API-auth pattern
- `e2e/proposals/proposal-crud.spec.ts` — canonical `create-then-delete` test pattern
- `e2e/proposals/proposal-status.spec.ts` — canonical API-driven setup pattern
- `src/app/transactions/new/page.tsx` — 4-step wizard, validation logic, step IDs
- `src/app/transactions/_components/form-steps.tsx` — `TypeSelectorStep`, `DetailsStep` exports
- `src/app/transactions/_components/form-steps/payment-step.tsx` — PaymentStep fields
- `src/app/transactions/_components/transaction-installments-list.tsx` — installment status dropdown
- `src/app/wallets/_components/wallet-form-dialog.tsx` — form fields for wallet creation
- `src/app/wallets/_components/transfer-dialog.tsx` — transfer form fields
- `src/app/wallets/_components/wallets-dialogs.tsx` — dialog hub, confirms WalletFormDialog + TransferDialog
- `src/app/transactions/CLAUDE.md` — wallet ID/NAME migration, installment structure
- `src/app/wallets/CLAUDE.md` — balance architecture, wallet service endpoints

### Tertiary (ASSUMED — not verified against controller source)
- Installment API payload field names (A1) — needs verification against `transactions.controller.ts`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — same infra as Phase 3, no new deps
- Architecture patterns: HIGH — verified from actual source files
- Pitfalls: HIGH — derived from actual component logic
- Installment API payload: LOW — assumed from form field names, not verified against controller

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable financial module — no active development in scope)
