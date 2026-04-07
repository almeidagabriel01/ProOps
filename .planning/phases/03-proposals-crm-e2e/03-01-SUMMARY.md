---
phase: 03-proposals-crm-e2e
plan: "01"
subsystem: e2e-tests
tags: [playwright, e2e, proposals, crud, pom]
dependency_graph:
  requires: []
  provides:
    - ProposalsPage POM with form-filling and action methods
    - PROP-01 PROP-02 PROP-03 E2E test coverage
  affects:
    - e2e/seed/seed-factory.ts
tech_stack:
  added: []
  patterns:
    - create-then-delete pattern for test isolation
    - POM form-filling using real locators from component source
    - SearchableSelect interaction via placeholder-based input locators
key_files:
  created:
    - e2e/proposals/proposal-crud.spec.ts
    - e2e/seed/data/sistemas.ts
  modified:
    - e2e/pages/proposals.page.ts
    - e2e/seed/seed-factory.ts
decisions:
  - Extended POM drives full 5-step wizard including automacao_residencial Sistema/Ambiente selection
  - Seeded sistema-iluminacao-001 + ambiente-sala-001 for tenant-alpha so step 2 has selectable options
  - deleteProposal uses row-based locator filtering and falls back to dropdown menu on compact viewports
  - editProposal uses allowClickAhead=true (set for existing proposals) to jump directly to Resumo step
metrics:
  duration_minutes: 45
  completed_date: "2026-04-07"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 3 Plan 1: ProposalsPage POM Extension and Proposal CRUD E2E Tests Summary

**One-liner:** Extended ProposalsPage POM with full 5-step wizard form-filling (including automacao_residencial sistema/ambiente selection) and wrote three PROP-01/02/03 CRUD tests using create-then-delete isolation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend ProposalsPage POM with form-filling and action methods | d9c4038b | e2e/pages/proposals.page.ts, e2e/seed/data/sistemas.ts, e2e/seed/seed-factory.ts |
| 2 | Write proposal CRUD E2E tests (PROP-01, PROP-02, PROP-03) | 530e94c8 | e2e/proposals/proposal-crud.spec.ts |

## What Was Built

### ProposalsPage POM (extended)

Added four methods to `e2e/pages/proposals.page.ts`:

- **`createProposal(data)`** — Drives the full 5-step `SimpleProposalForm` wizard for `automacao_residencial` niche: fills title/client/phone/validUntil in step 1, selects sistema + ambiente via `SearchableSelect` inputs in step 2, clicks through steps 3–4, and submits at step 5 ("Criar Proposta"). Waits for redirect to `/edit-pdf` or `/proposals`.

- **`editProposal(id, data)`** — Navigates to `/proposals/[id]`, updates title in step 1, then jumps directly to step 5 ("Resumo") by clicking the step indicator button (enabled because `allowClickAhead=true` for existing proposals), and saves.

- **`deleteProposal(title)`** — Finds the table row by title, attempts direct "Excluir" button first (visible on >1700px viewports), falls back to the compact actions dropdown on smaller viewports, then confirms the AlertDialog.

- **`getProposalStatus(title)`** — Reads the status badge text from the proposal's table row (used by PROP-06 in Plan 02).

### Seed Data (sistema + ambiente)

Added `e2e/seed/data/sistemas.ts` with:
- `AMBIENTE_SALA` — "Sala de Estar" ambiente for tenant-alpha with 1 product (product-001)
- `SISTEMA_ILUMINACAO` — "Sistema de Iluminação" sistema for tenant-alpha referencing the sala ambiente

Updated `e2e/seed/seed-factory.ts` to call `seedSistemas()` and include `sistemas`/`ambientes` in `clearAll()`.

### Proposal CRUD Spec

`e2e/proposals/proposal-crud.spec.ts` with three `test.describe` blocks:

- **PROP-01** — Creates a uniquely-titled proposal through the UI, verifies it appears in the list, then cleans up
- **PROP-02** — Creates a proposal, opens it for editing, modifies the title, saves, verifies the new title in the list, then cleans up
- **PROP-03** — Creates a proposal, verifies it's visible, deletes it through the UI (button + AlertDialog confirm), and verifies it's no longer visible

All tests use `Date.now()` in titles and clean up after themselves.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added sistema/ambiente seed data for tenant-alpha**
- **Found during:** Task 1 implementation
- **Issue:** `automacao_residencial` form step 2 (`validateStep2`) requires at least one product in the proposal before allowing progression to step 3. Step 2 renders `SistemaSelector` which loads sistemas/ambientes from Firestore. No sistemas/ambientes were in the seed factory — the dropdowns would be empty and step 2 impossible to complete.
- **Fix:** Created `e2e/seed/data/sistemas.ts` with `SISTEMA_ILUMINACAO` + `AMBIENTE_SALA` (1 product each) for tenant-alpha. Updated seed-factory to seed and clear them.
- **Files modified:** `e2e/seed/data/sistemas.ts` (new), `e2e/seed/seed-factory.ts`
- **Commit:** d9c4038b

**2. [Rule 3 - Blocking] Used step indicator click for editProposal instead of sequential Next buttons**
- **Found during:** Task 1 implementation
- **Issue:** For edit flows, clicking "Próximo" through all 5 steps would require step 2 to have systems already selected (which depends on the seed proposal's data format). The seed proposals use `SeedProposal` format with `items[]` not `products[]`.
- **Fix:** For editing, `allowClickAhead=true` is set when `proposalId` is present — clicked the "Resumo" step indicator directly to skip to step 5 without requiring step 2 re-validation.
- **Files modified:** `e2e/pages/proposals.page.ts`
- **Commit:** d9c4038b

## Known Stubs

None — all methods use real locators derived from component source. The `deleteProposal` viewport fallback path (compact dropdown) is a defensive branch, not a stub.

## Threat Flags

None — this plan adds E2E tests only. No new network endpoints, auth paths, or Firestore collections are introduced. The seed collections (`sistemas`, `ambientes`) are emulator-only and never reach production.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| e2e/pages/proposals.page.ts | FOUND |
| e2e/proposals/proposal-crud.spec.ts | FOUND |
| e2e/seed/data/sistemas.ts | FOUND |
| Commit d9c4038b (Task 1) | FOUND |
| Commit 530e94c8 (Task 2) | FOUND |
