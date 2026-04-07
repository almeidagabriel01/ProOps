---
phase: 03-proposals-crm-e2e
plan: "02"
subsystem: e2e-testing
tags: [playwright, e2e, proposals, pdf, share-link, status-transitions, firebase-emulator]
dependency_graph:
  requires: [03-01]
  provides: [PROP-04-verified, PROP-05-verified, PROP-06-verified]
  affects: [e2e/proposals/, e2e/seed/, src/lib/firebase-admin.ts, e2e/pages/proposals.page.ts]
tech_stack:
  added: []
  patterns: [signInWithEmailPassword-for-bearer-tokens, ancestor-walk-locator, row-boundary-guard]
key_files:
  created:
    - e2e/proposals/proposal-pdf.spec.ts
    - e2e/proposals/proposal-share.spec.ts
    - e2e/proposals/proposal-status.spec.ts
    - e2e/seed/data/contacts.ts
  modified:
    - e2e/pages/proposals.page.ts
    - e2e/seed/seed-factory.ts
    - e2e/global-setup.ts
    - playwright.config.ts
    - src/lib/server-api-upstream.ts
    - src/lib/firebase-admin.ts
decisions:
  - "D-04 honored: PDF test asserts non-401/non-403 rather than 200; emulator cannot run Playwright/Chromium server-side"
  - "D-05 honored: status transitions driven via PUT /api/backend/v1/proposals/:id not UI clicks"
  - "D-06 honored: one test per transition (draft->sent, sent->approved, sent->rejected)"
  - "D-07 honored: each test creates fresh proposal via API, never mutates seed proposals"
  - "Admin SDK emulator mode: initialize without cert() when FIREBASE_AUTH_EMULATOR_HOST is set, using NEXT_PUBLIC_FIREBASE_PROJECT_ID as project ID"
  - "getProposalStatus uses row-boundary guard: stop ancestor walk when ancestor contains more than one status button, preventing cross-row matches"
metrics:
  duration_minutes: 240
  completed_date: "2026-04-07"
  tasks_completed: 2
  files_changed: 9
---

# Phase 03 Plan 02: PDF, Share Link, and Status Transition E2E Tests Summary

**One-liner:** Playwright E2E tests for PROP-04 PDF auth enforcement, PROP-05 unauthenticated share link access, and PROP-06 three status transitions via backend API + UI verification, with Firebase Admin SDK emulator fix and contacts seed.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | PROP-04 PDF endpoint + PROP-05 share link tests | 4ee436ff | proposal-pdf.spec.ts, proposal-share.spec.ts, global-setup.ts, playwright.config.ts, server-api-upstream.ts |
| 2 | PROP-06 status transition tests + emulator auth fix | f8ad82cf | proposal-status.spec.ts, firebase-admin.ts, contacts.ts, seed-factory.ts, proposals.page.ts |

## Test Results

All 5 plan-02 tests pass:

- PROP-04: PDF generation endpoint returns non-401/non-403 for authenticated request — PASS
- PROP-05: Share link accessible without auth and renders proposal content — PASS
- PROP-06 draft→sent: status changes to "Enviada" in UI — PASS
- PROP-06 sent→approved: status changes to "Aprovada" in UI — PASS
- PROP-06 sent→rejected: status changes to "Rejeitada" in UI — PASS

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Firebase Admin SDK aud mismatch broke session cookie creation**
- **Found during:** Task 2 — after adding Functions emulator in Task 1 commit (4ee436ff), all browser-navigation tests failed because the `/api/auth/session` route's `adminAuth.verifyIdToken()` threw "Expected erp-softcode but got demo-proops-test"
- **Issue:** `firebase-admin.ts` initializes with `cert(serviceAccount)` where `projectId` comes from `.env.local` (`erp-softcode`), but the Auth emulator issues tokens for `demo-proops-test`. Even with `FIREBASE_AUTH_EMULATOR_HOST` set, the Admin SDK with `cert()` enforces the `aud` claim against the configured project ID.
- **Fix:** Added `isEmulatorMode()` check in `getAdminApp()`. In emulator mode, initialize with `{ projectId: NEXT_PUBLIC_FIREBASE_PROJECT_ID }` (no `cert()`), which lets the Admin SDK use the emulator project.
- **Files modified:** `src/lib/firebase-admin.ts`
- **Commit:** f8ad82cf

**2. [Rule 2 - Missing seed] Contacts (clients) collection not seeded**
- **Found during:** Task 2 — CRUD wizard failed at client dropdown because no `clients` documents existed in Firestore
- **Issue:** The proposals seed references `contact-alpha-001`/`João Silva` etc. but no `clients` collection was seeded, so the ClientSelect dropdown showed only the "create new" option
- **Fix:** Created `e2e/seed/data/contacts.ts` seeding 4 clients for tenant-alpha (João Silva, Maria Santos, Carlos Oliveira, Joao Silva without accent for form typing). Added `seedContacts()` and `clients` to `clearAll()` in seed-factory.ts
- **Files modified:** `e2e/seed/data/contacts.ts` (new), `e2e/seed/seed-factory.ts`
- **Commit:** f8ad82cf

**3. [Rule 1 - Bug] ProposalsPage POM had multiple incorrect locators**
- **Found during:** Task 2 debugging
- **Issues and fixes:**
  - `newProposalButton` used `getByRole("button")` but UI renders "Nova Proposta" as a `<Link>` (anchor) → fixed to `getByRole("link")`
  - `validUntil` date field is a custom DatePicker with hidden input → fixed to click the "Selecionar data" button then click "Hoje"
  - Sistema option used `getByText()` but options render as `<button>` elements → fixed to `getByRole("button", { name: /sistema de iluminação/i })`
  - Ambiente selector: after sistema selection, ambiente textbox placeholder is "Buscar ambiente..." not "Selecione um ambiente..." → fixed to click "Abrir opções" button then select by role
  - `deleteProposal` used `tr, [role='row']` locator but list uses generic `div` rows → fixed to ancestor-walk via `evaluate()` to find "Mais ações" button nearest to the title
  - Dropdown "Excluir" item has no `menuitem` role → fixed to `locator("div, button, li").filter({ hasText: /^excluir$/i })`
  - `getProposalByTitle` used CSS `text=` exact selector → fixed to `getByRole("link", { name: title })`
  - `getProposalStatus` ancestor walk climbed to the list container (matching all proposals) → fixed with row-boundary guard (stop when ancestor has multiple status buttons)
  - `isLoaded()` waited only for URL → fixed to also wait for seeded proposal link "Automação Residencial" to confirm list rendered
- **Files modified:** `e2e/pages/proposals.page.ts`
- **Commit:** f8ad82cf

### Deferred Issues (CRUD Wizard - Attempt Limit Reached)

PROP-01, PROP-02, PROP-03 CRUD tests (from plan 03-01) remain failing. The UI wizard's "Criar Proposta" button click does not trigger a redirect from `/proposals/new`. The frontend form makes a POST to `/api/backend/v1/proposals` but receives an error response (likely silent failure) and stays on the form. 

Investigation reached 3+ auto-fix attempts without resolving:
- Session cookie creation now works (firebase-admin fix)
- Wizard form navigation works (link/DatePicker/SearchableSelect locators fixed)
- Resumo step renders with sistema items (sistemas seed present)
- Submit button is enabled and clicked — but no redirect occurs

Root cause hypothesis: the frontend API call fails because the `api-client.ts` Axios interceptor adds a Bearer token from the Firebase Auth client SDK, and that token may not be recognized by the Functions emulator under the proxy chain. This requires investigation of the Next.js proxy authorization forwarding. Deferred to a dedicated debugging session.

## Known Stubs

None — all test assertions are explicit and data-driven.

## Threat Flags

None — this plan adds test infrastructure only. No new network endpoints, auth paths, or Firestore collections are introduced in production code. The `firebase-admin.ts` change only affects emulator mode (guarded by `FIREBASE_AUTH_EMULATOR_HOST`).

## Self-Check: PASSED

| Item | Status |
|------|--------|
| e2e/proposals/proposal-pdf.spec.ts | FOUND |
| e2e/proposals/proposal-share.spec.ts | FOUND |
| e2e/proposals/proposal-status.spec.ts | FOUND |
| e2e/seed/data/contacts.ts | FOUND |
| Commit 4ee436ff | FOUND |
| Commit f8ad82cf | FOUND |
| 5 plan-02 tests passing | VERIFIED |
