---
phase: "04"
plan: "03"
subsystem: "e2e-financial"
tags: [e2e, playwright, installments, financial, hybrid-api-ui]
dependency_graph:
  requires: [04-01, 04-02]
  provides: [FIN-06-coverage]
  affects: [e2e/financial/installments.spec.ts]
tech_stack:
  added: []
  patterns:
    - "Hybrid API+UI: POST via request.post() → UI interaction → DELETE cleanup"
    - "Custom DropdownMenu portal detection: body > div[style*='position: fixed']"
    - "DOM traversal (.locator('..')) to scope locators to specific list rows"
    - "exact:true to disambiguate installment labels from seeded data"
    - "waitForFunction to detect portal open state before clicking items"
key_files:
  created:
    - e2e/financial/installments.spec.ts
  modified: []
decisions:
  - "D-04: Installment group creation via API — avoids multi-step wizard complexity"
  - "D-05: Mark-as-paid via Agrupados view TransactionInstallmentsList dropdowns"
  - "Custom DropdownMenu (not Radix): portal as body > div[style*='position: fixed'] with plain div items (no role attrs)"
  - "3-hop DOM traversal (text → info div → left group → row) confirmed via page snapshot"
metrics:
  duration_minutes: 80
  completed_date: "2026-04-07"
  tasks_completed: 1
  tasks_planned: 1
  files_created: 1
  files_modified: 0
---

# Phase 04 Plan 03: FIN-06 Installment E2E Test Summary

**One-liner:** Hybrid API+UI test covering installment group creation via POST and sequential mark-as-paid via custom DropdownMenu portal in the Agrupados view.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | FIN-06 installment E2E test | `8c824f9a` | e2e/financial/installments.spec.ts |

## What Was Built

`e2e/financial/installments.spec.ts` implements the FIN-06 test scenario:

1. Obtains a Firebase ID token via Auth emulator REST API
2. Creates a 3-installment income group (300 total / 100 per installment) via `POST /api/backend/v1/transactions` with `isInstallment: true, installmentCount: 3, paymentMode: "total"`
3. Navigates to `/transactions` and switches to "Agrupados" view
4. Expands the group card by clicking the description text
5. Marks installment 1/3 as paid using the custom DropdownMenu portal
6. Marks installment 2/3 as paid in sequential order (per pitfall 3 — sequential enforcement)
7. Cleans up the first installment via `DELETE /api/backend/v1/transactions/{transactionId}`

**Test passes in ~22 seconds against Firebase Emulators.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] networkidle waitForLoadState times out**
- **Found during:** Task 1 (initial implementation)
- **Issue:** The `/transactions` page has background polling that prevents networkidle state from resolving
- **Fix:** Replaced `waitForLoadState("networkidle")` with targeted `waitForURL` + `expect(locator).toBeVisible()` assertions
- **Files modified:** e2e/financial/installments.spec.ts
- **Commit:** 8c824f9a

**2. [Rule 1 - Bug] Strict mode violation on `getByText("Parcela 1/3")`**
- **Found during:** Task 1
- **Issue:** "Parcela 1/3" matched both the test installment row and seeded data "Parcela 1/3 - Projeto Condomínio Alfa"
- **Fix:** Added `{ exact: true }` to disambiguate — "Parcela 1/3" (exact) does not match "Parcela 1/3 - Projeto Condomínio Alfa"
- **Files modified:** e2e/financial/installments.spec.ts
- **Commit:** 8c824f9a

**3. [Rule 1 - Bug] Custom DropdownMenu not Radix UI — no `role="menuitem"` attrs**
- **Found during:** Task 1
- **Issue:** `getByRole("menuitem")`, `[data-radix-popper-content-wrapper]`, and `[role="menu"]` all failed. The project uses a custom `DropdownMenu` component (`src/components/ui/dropdown-menu.tsx`) that renders portal content as `body > div[style="position: fixed; ..."]` with plain `<div>` items (no ARIA roles)
- **Fix:** Used `waitForFunction` to detect portal open state by checking `document.body.children` for a fixed-position element containing "Pago", then scoped to `body > div[style*='position: fixed']`
- **Files modified:** e2e/financial/installments.spec.ts
- **Commit:** 8c824f9a

**4. [Rule 1 - Bug] 4-hop DOM traversal went too high**
- **Found during:** Task 1
- **Issue:** An extra `.locator("..")` hop went above the installment row to the shared parent container of all 3 rows, causing `getByRole("button", { name: /pendente/i })` to return multiple matches
- **Fix:** Confirmed correct DOM path via page snapshot (e263 is the row div, 3 hops from label text). Removed the extra hop
- **Files modified:** e2e/financial/installments.spec.ts
- **Commit:** 8c824f9a

**5. [Rule 1 - Bug] `getByText("Parcela 2/3", { exact: true })` not found in flat view**
- **Found during:** Task 1
- **Issue:** Default "Por Vencimento" view renders each installment as a flat independent row without "Parcela N/M" labels. The `TransactionInstallmentsList` with these labels only exists in "Agrupados" view
- **Fix:** Added "Agrupados" view switch before expanding card and looking for installment labels
- **Files modified:** e2e/financial/installments.spec.ts
- **Commit:** 8c824f9a

## Key Technical Findings

- **Custom DropdownMenu portal pattern:** `body > div[style*='position: fixed']` — use `waitForFunction` to detect before clicking
- **Agrupados view required:** `TransactionInstallmentsList` only renders in grouped view, not flat "Por Vencimento" view
- **Sequential payment enforcement:** Marking installment 2/3 before 1/3 would fail — test must follow correct order
- **DOM traversal (3 hops):** `label text → info div → left group → row div` is the correct path into `transaction-installments-list.tsx` row containers

## Known Stubs

None — test is fully wired to real emulator API and UI.

## Threat Flags

None — test-only changes, no production surface added.

## Self-Check: PASSED

- [x] `e2e/financial/installments.spec.ts` exists and passes (~22s)
- [x] Task commit `8c824f9a` exists in git log
