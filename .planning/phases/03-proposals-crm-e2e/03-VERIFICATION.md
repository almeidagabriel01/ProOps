---
phase: 03-proposals-crm-e2e
verified: 2026-04-07T16:00:00Z
status: gaps_found
score: 3/4 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Test suite validates that a user can create, edit, and delete a proposal with valid data"
    status: failed
    reason: "PROP-01, PROP-02, PROP-03 CRUD tests exist in proposal-crud.spec.ts and compile cleanly, but Plan 02 SUMMARY explicitly documents they remain failing at runtime: the browser UI form submits but does not redirect after creation. Root cause identified as the frontend Axios client token not being recognized through the Next.js proxy when driving the full UI wizard — deferred to a debugging session."
    artifacts:
      - path: "e2e/proposals/proposal-crud.spec.ts"
        issue: "Tests exist and compile but are not passing — form submit does not trigger redirect from /proposals/new"
      - path: "e2e/pages/proposals.page.ts"
        issue: "createProposal() POM method exists with real locators but the underlying API call through the browser form fails silently"
    missing:
      - "Debug why the frontend form POST to /api/backend/v1/proposals fails or does not redirect when driven via browser UI (Axios interceptor + Next.js proxy + Functions emulator token chain)"
      - "Confirm proposal-crud.spec.ts passes (all three PROP-01, PROP-02, PROP-03 tests green) before marking SC1 verified"
---

# Phase 3: Proposals & CRM E2E — Verification Report

**Phase Goal:** E2E tests cover the full proposal lifecycle — the highest-value business flow in ProOps — from creation through status transitions, PDF generation, and public sharing.
**Verified:** 2026-04-07T16:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Test suite validates that a user can create, edit, and delete a proposal with valid data | FAILED | proposal-crud.spec.ts exists and compiles; but 03-02-SUMMARY explicitly states "PROP-01, PROP-02, PROP-03 CRUD tests remain failing" — form submit does not trigger redirect, deferred to debugging session |
| 2 | Test suite validates that a proposal generates a PDF correctly via the backend endpoint | VERIFIED | proposal-pdf.spec.ts: PROP-04 test asserts non-401/non-403 with INTENTIONAL comment for emulator limitation; SUMMARY-02 confirms PASS |
| 3 | Test suite validates that a public proposal link is accessible without authentication | VERIFIED | proposal-share.spec.ts: PROP-05 test creates share token, opens in unauthenticated context via browser.newPage(), asserts no /login redirect and proposal title visible; SUMMARY-02 confirms PASS |
| 4 | Test suite validates the full status lifecycle: draft -> sent -> approved/rejected | VERIFIED | proposal-status.spec.ts: 3 separate tests (draft->sent, sent->approved, sent->rejected) via PUT API + UI verification with Portuguese labels "Enviada"/"Aprovada"/"Rejeitada"; SUMMARY-02 confirms all 3 PASS |

**Score: 3/4 truths verified**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `e2e/pages/proposals.page.ts` | ProposalsPage POM with createProposal, editProposal, deleteProposal, getProposalStatus | VERIFIED | All 4 methods present; locators derived from actual component source; TypeScript compiles clean |
| `e2e/proposals/proposal-crud.spec.ts` | PROP-01/02/03 E2E tests | WIRED BUT FAILING | File exists with 3 test.describe blocks for PROP-01/02/03; imports ProposalsPage + auth.fixture; uses Date.now() and create-then-delete pattern; compiles cleanly but tests do not pass at runtime per SUMMARY-02 |
| `e2e/proposals/proposal-pdf.spec.ts` | PROP-04 E2E test | VERIFIED | File exists; tests PDF endpoint with non-401/non-403 assertions; uses signInWithEmailPassword for bearer token; INTENTIONAL comment documents emulator limitation |
| `e2e/proposals/proposal-share.spec.ts` | PROP-05 E2E test | VERIFIED | File exists; creates share link via API, opens in browser.newPage() unauthenticated context, asserts no /login redirect and content visible |
| `e2e/proposals/proposal-status.spec.ts` | PROP-06 E2E tests | VERIFIED | File exists; 3 transitions via PUT API + ProposalsPage.getProposalStatus(); Portuguese status labels asserted with toContain() |
| `e2e/seed/data/sistemas.ts` | Sistema + ambiente seed for wizard step 2 | VERIFIED | SISTEMA_ILUMINACAO + AMBIENTE_SALA seeded for tenant-alpha; seedFactory includes seedSistemas() |
| `e2e/seed/data/contacts.ts` | Contacts/clients seed for ClientSelect | VERIFIED | 4 contacts seeded including "Joao Silva" (no accent) for form typing; seedFactory includes seedContacts() + clearAll() covers clients collection |
| `src/lib/firebase-admin.ts` | isEmulatorMode() bypass for Admin SDK | VERIFIED | getAdminApp() initializes without cert() when FIREBASE_AUTH_EMULATOR_HOST is set, using demo project ID |
| `e2e/helpers/firebase-auth-api.ts` | signInWithEmailPassword helper | VERIFIED | Node.js helper for direct Auth emulator REST API sign-in; used by pdf/share/status specs for Bearer token |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `proposal-crud.spec.ts` | `proposals.page.ts` | import ProposalsPage + createProposal/editProposal/deleteProposal | WIRED | Import confirmed line 15; all 3 methods called in tests |
| `proposal-crud.spec.ts` | `fixtures/auth.fixture.ts` | import test from auth.fixture | WIRED | Line 14: `from "../fixtures/auth.fixture"` |
| `proposal-pdf.spec.ts` | `/api/backend/v1/proposals/:id/pdf` | page.request.get with Bearer token | WIRED | Line 17: `authenticatedPage.request.get(/api/backend/v1/proposals/${PROPOSAL_ALPHA_APPROVED.id}/pdf)` |
| `proposal-share.spec.ts` | `/share/:token` | browser.newPage() unauthenticated context | WIRED | Lines 33-36: `browser.newPage()` then `publicPage.goto(/share/${token})` |
| `proposal-status.spec.ts` | `/api/backend/v1/proposals/:id` | page.request.put with status field | WIRED | Lines 54-61: PUT with Bearer token and `{ status: "sent" }` |
| `global-setup.ts` | `seed-factory.ts` | seedAll() and clearAll() | WIRED | seedSistemas() and seedContacts() called in seedAll(); sistemas/ambientes/clients in clearAll() |
| `playwright.config.ts` | Functions emulator | FUNCTIONS_LOCAL_API_URL env var | WIRED | `http://127.0.0.1:5001/demo-proops-test/southamerica-east1/api` |
| `firebase-admin.ts` | Auth emulator | isEmulatorMode() + no cert() | WIRED | isEmulatorMode() checks FIREBASE_AUTH_EMULATOR_HOST; emulator path initializes with projectId only |

---

### Data-Flow Trace (Level 4)

These specs are API/browser interaction tests, not data-rendering components. Level 4 traces the API response chain rather than React state.

| Spec | Data Variable | Source | Produces Real Data | Status |
|------|--------------|--------|--------------------|--------|
| proposal-pdf.spec.ts | `response.status()` | `/api/backend/v1/proposals/:id/pdf` via Functions emulator | Auth check is real; PDF binary may be 500 in emulator | VERIFIED (D-04 intentional) |
| proposal-share.spec.ts | `shareData.token`, `pageContent` | `POST /api/backend/v1/proposals/:id/share-link` → `/share/:token` | Token from real API; page renders real proposal title from Firestore | VERIFIED |
| proposal-status.spec.ts | `status` from `getProposalStatus()` | PUT API updates Firestore; UI reads from Firestore on page load | Real Firestore write via PUT; UI reads fresh data on navigate | VERIFIED |
| proposal-crud.spec.ts | Proposal created via browser UI → appears in list | UI form POST to `/api/backend/v1/proposals` via browser Axios client | UNKNOWN — form POST fails silently per SUMMARY-02 | DISCONNECTED |

---

### Behavioral Spot-Checks

Step 7b — Behavioral spot-checks require running emulators and the Next.js test server simultaneously. These cannot be run statically. The verification relies on:

- SUMMARY-02 explicit pass/fail report for plan-02 tests (PROP-04, PROP-05, PROP-06 all PASS)
- SUMMARY-02 explicit failure disclosure for PROP-01/02/03 CRUD tests (still failing)
- TypeScript compilation passes clean for all spec files

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles all e2e files | `npx tsc --noEmit --project e2e/tsconfig.json` | No errors | PASS |
| PROP-04 PDF auth check | Requires emulators running | Reported PASS in SUMMARY-02 | PASS (reported) |
| PROP-05 Share link unauthenticated | Requires emulators running | Reported PASS in SUMMARY-02 | PASS (reported) |
| PROP-06 Status transitions (3 tests) | Requires emulators running | Reported PASS in SUMMARY-02 | PASS (reported) |
| PROP-01/02/03 CRUD tests | Requires emulators running | Reported FAILING in SUMMARY-02 — form submit no redirect | FAIL (reported) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PROP-01 | 03-01-PLAN.md | E2E validates user can create a new proposal | BLOCKED | Test exists in proposal-crud.spec.ts with correct assertions; not passing per SUMMARY-02 |
| PROP-02 | 03-01-PLAN.md | E2E validates user can edit an existing proposal | BLOCKED | Test exists in proposal-crud.spec.ts; not passing per SUMMARY-02 |
| PROP-03 | 03-01-PLAN.md | E2E validates user can delete a proposal | BLOCKED | Test exists in proposal-crud.spec.ts; not passing per SUMMARY-02 |
| PROP-04 | 03-02-PLAN.md | E2E validates proposal PDF generation via backend endpoint | SATISFIED | proposal-pdf.spec.ts asserts non-401/non-403; PASS per SUMMARY-02 |
| PROP-05 | 03-02-PLAN.md | E2E validates public proposal link accessible without auth | SATISFIED | proposal-share.spec.ts: unauthenticated browser.newPage() + content assertion; PASS per SUMMARY-02 |
| PROP-06 | 03-02-PLAN.md | E2E validates status lifecycle (draft→sent→approved/rejected) | SATISFIED | proposal-status.spec.ts: 3 separate tests with PUT API + UI verification; PASS per SUMMARY-02 |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `e2e/pages/proposals.page.ts` | 139 | `waitForTimeout(500)` | Info | Brief pause after sistema selection — acceptable for async UI state, not a stub |
| `e2e/pages/proposals.page.ts` | 145-146 | `waitForTimeout(300)` x2 | Info | Pause before wizard step advancement — acceptable for step transition animation |
| `e2e/pages/proposals.page.ts` | 201 | `waitForTimeout(1000)` | Warning | Post-save wait to "allow toast/redirect to settle" — fragile; should be replaced with explicit waitForURL or toast assertion if tests become flaky |
| `e2e/proposals/proposal-status.spec.ts` | 70 | Partial title match `Status Test Draft-Sent` (without timestamp) | Warning | getProposalStatus() searches by partial title without timestamp — could match a stale proposal from a previous test run if clearAll() is not called between runs. Acceptable since global-setup clears all data at start. |

No blockers found. The `waitForTimeout` usages are standard defensive pauses in Playwright for async UI — not implementation stubs. The "placeholder" matches in the grep scan are comments referring to HTML placeholder attributes (legitimate use).

---

### Human Verification Required

None of the items that passed automated verification need human testing. The CRUD failure (SC1/PROP-01/02/03) is a test infrastructure issue, not a visual or UX item — it is fully diagnosable programmatically.

---

### Gaps Summary

**1 gap blocking goal achievement.**

Roadmap success criterion 1 — "Test suite validates that a user can create, edit, and delete a proposal with valid data" — is not met.

The test code for PROP-01, PROP-02, PROP-03 exists, compiles, and uses correct patterns (create-then-delete, Date.now() titles, real POM locators). The infrastructure around the tests is also correct: seed data for contacts and sistemas exists, the firebase-admin emulator mode fix is in place, and the auth fixture authenticates correctly.

The documented failure is specific: when `createProposal()` drives the full 5-step wizard through the browser UI and clicks "Criar Proposta", the frontend makes an API POST through the browser's Axios client + Next.js proxy route + Functions emulator chain. This call does not complete successfully (or the response is not handled such that `router.push()` is triggered), leaving the test on `/proposals/new` — causing the `waitForURL` timeout.

PROP-04, PROP-05, and PROP-06 bypass this problem by using `authenticatedPage.request.post/put/get` with explicit Bearer tokens, bypassing the browser Axios client entirely. Their passing state confirms auth and seed data are working.

**Root cause to investigate:** Whether the browser Axios client's Bearer token is forwarded correctly through the `/api/backend/*` proxy to the Functions emulator when the Next.js dev server runs on port 3001 with the test configuration.

---

_Verified: 2026-04-07T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
