---
phase: 04-financial-module-e2e
plan: 01
subsystem: e2e-financial
tags: [e2e, playwright, transactions, crud, pom]
completed: "2026-04-07T22:35:23Z"

dependency_graph:
  requires: []
  provides: [TransactionsPage-CRUD-POM, FIN-01-test, FIN-02-test, FIN-03-test]
  affects: [e2e/pages/transactions.page.ts, e2e/financial/transaction-crud.spec.ts]

tech_stack:
  added: []
  patterns:
    - CSS adjacent-sibling selector for DatePicker trigger (input#id + button)
    - pressSequentially for CurrencyInput (ignores onChange, keyboard-only)
    - dispatchEvent for fixed-position portal buttons outside viewport
    - Extract transaction ID from view link href for reliable navigation to edit page

key_files:
  created:
    - e2e/financial/transaction-crud.spec.ts
  modified:
    - e2e/pages/transactions.page.ts

decisions:
  - CurrencyInput requires pressSequentially with cent digit string (not fill) — onChange is noop
  - DatePicker trigger found via CSS adjacent-sibling (input#id + button), not label-based
  - Calendar Hoje button uses dispatchEvent (not click/force) due to fixed portal positioning
  - editTransaction derives transaction ID from /view link href (edit button absent in list for new transactions)
  - Income transactions require clientName in Review step — defaults to "João Silva" (seeded)
  - Edit page save button label is "Salvar Alterações" (differs from new page "Salvar Lançamento")

metrics:
  duration_minutes: 45
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 04 Plan 01: Transaction CRUD E2E Tests Summary

Extended the `TransactionsPage` POM with full CRUD wizard methods and implemented 3 passing E2E tests covering transaction create (FIN-01), edit (FIN-02), and delete (FIN-03) against Firebase Emulators.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend TransactionsPage POM | 708ea8d4 | e2e/pages/transactions.page.ts |
| 2 | Write transaction CRUD E2E tests | 560dd7f7 | e2e/financial/transaction-crud.spec.ts, e2e/pages/transactions.page.ts |

## What Was Built

**`e2e/pages/transactions.page.ts`** — Extended with:
- `TransactionCreateData` interface (type, description, amount, wallet, client, dueDate, notes)
- `createTransaction()` — drives the 4-step wizard with sequential Próximo clicks
- `editTransaction()` — navigates to edit page via view link ID extraction, advances past Type step
- `deleteTransaction()` — clicks title="Excluir" direct button and confirms AlertDialog
- `getTransactionByDescription()` — filter chain scoped to cards with Excluir button
- `_clickDatePickerHoje()` — private helper using CSS adjacent-sibling selector + dispatchEvent

**`e2e/financial/transaction-crud.spec.ts`** — 3 test blocks:
- FIN-01: Creates income transaction via wizard → verifies in list → deletes (cleanup)
- FIN-02: Creates → edits description → verifies edited description in list → deletes (cleanup)
- FIN-03: Creates → deletes → verifies gone from list

All tests use `Date.now()` descriptions for uniqueness. No seeded data mutated.

## Deviations from Plan

**1. [Rule 1 - Bug] newTransactionButton was typed as getByRole("button") but renders as a link**
- Found during: Task 1 execution (first test run)
- Issue: `Button asChild` with `Link` renders as `<a>` not `<button>`. The locator timed out.
- Fix: Changed to `getByRole("link", { name: /novo lançamento/i })`
- Files modified: e2e/pages/transactions.page.ts
- Commit: 560dd7f7

**2. [Rule 1 - Bug] TypeSelectorStep strict mode violation — step indicator button also matched /receita/i**
- Found during: Task 1 execution
- Issue: Both the type card ("Receita") and step indicator ("Tipo Receita ou despesa") matched the regex.
- Fix: Added `.filter({ hasNot: locator("text=ou despesa") })` to narrow to the card button
- Files modified: e2e/pages/transactions.page.ts
- Commit: 560dd7f7

**3. [Rule 1 - Bug] DatePicker "Hoje" button outside viewport — click failed**
- Found during: Task 1 execution
- Issue: Calendar portal renders at `position: fixed` relative to trigger button position. When trigger is near bottom, calendar opens below viewport. `click({ force: true })` failed; `dispatchEvent("click")` succeeded.
- Fix: `scrollIntoViewIfNeeded()` on trigger + `dispatchEvent("click")` on Hoje button
- Files modified: e2e/pages/transactions.page.ts
- Commit: 560dd7f7

**4. [Rule 1 - Bug] CurrencyInput ignores fill() — only responds to keydown events**
- Found during: Task 1 execution (Step 2 amount had "Valor deve ser maior que 0" error)
- Issue: `CurrencyInput` has `onChange={() => {}}` (noop). `fill()` triggers onChange which does nothing.
- Fix: `click()` + `pressSequentially(centDigits)` where centDigits = `String(Math.round(parseFloat(amount) * 100))`
- Files modified: e2e/pages/transactions.page.ts
- Commit: 560dd7f7

**5. [Rule 2 - Missing functionality] Income transactions require clientName in Review step**
- Found during: Task 1 execution (form rejected with "Cliente é obrigatório para receitas")
- Issue: `transactionSchema` validates that income transactions have clientId/clientName. The plan's `TransactionCreateData` interface omitted this field.
- Fix: Added `clientName` to interface (defaults to "João Silva"), added ClientSelect interaction in Step 3
- Files modified: e2e/pages/transactions.page.ts
- Commit: 560dd7f7

**6. [Rule 1 - Bug] Edit button absent in transaction list card for new transactions**
- Found during: Task 2 execution (FIN-02 timed out waiting for title="Editar")
- Issue: The transaction card only renders the edit button when `canEdit` is true AND the button is visible. For newly created transactions at default viewport, only "Ver" and "Excluir" are visible.
- Fix: Extract transaction ID from the `/view` link href and navigate directly to `/transactions/[id]`
- Files modified: e2e/pages/transactions.page.ts
- Commit: 560dd7f7

**7. [Rule 1 - Bug] Edit wizard starts on Type step — #description is hidden**
- Found during: Task 2 execution (FIN-02 found hidden #description)
- Issue: The edit page StepWizard starts at step 1 (Type), same as the new page. Description is in step 2.
- Fix: Added `nextBtn.click()` after URL navigation to advance past Type step before filling description
- Files modified: e2e/pages/transactions.page.ts
- Commit: 560dd7f7

**8. [Rule 1 - Bug] Edit page submit button label is "Salvar Alterações" not "Salvar Lançamento"**
- Found during: Task 2 execution (FIN-02 timed out on Salvar Lançamento regex)
- Issue: The edit wizard's StepNavigation uses different `submitLabel` than the new wizard.
- Fix: Updated regex to `/salvar alterações|salvar lançamento|criar \d+ parcelas/i`
- Files modified: e2e/pages/transactions.page.ts
- Commit: 560dd7f7

## Known Stubs

None — all 3 tests exercise real API calls through the emulator stack with full CRUD round-trips.

## Threat Flags

None — test files only, no new network endpoints or auth paths introduced.

## Self-Check: PASSED

- e2e/pages/transactions.page.ts: FOUND
- e2e/financial/transaction-crud.spec.ts: FOUND
- Commit 708ea8d4: FOUND
- Commit 560dd7f7: FOUND
- All 3 tests pass: VERIFIED (3 passed output confirmed)
