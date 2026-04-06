# Phase 1: Test Infrastructure - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Developer can run any test suite locally with a single command against isolated Firebase Emulators, and CI executes all suites automatically on every PR. Covers Playwright setup, Firebase Emulator integration, seed data factory, and GitHub Actions pipeline. Writing actual E2E test cases is out of scope — this phase builds the foundation that later phases use.

</domain>

<decisions>
## Implementation Decisions

### Emulator Lifecycle
- **D-01:** Firebase Emulators auto-start via Playwright `globalSetup` — no manual steps required. Dev runs `npm run test:e2e` and emulators start, tests run, emulators stop. Satisfies INFRA-01 "single command, no manual setup".

### Seed Data Strategy
- **D-02:** Seed factory runs once per test run in Playwright `globalSetup`. Creates 2 tenants, users with different roles, proposals, transactions, and wallets deterministically. Tests that mutate data create their own fixtures within the test (create-then-delete pattern) to avoid polluting shared seed state.

### OWASP ZAP
- **D-03:** `npm run test:security` locally runs a lightweight JS-based security check (e.g., npm audit + basic header/CORS validation), NOT full OWASP ZAP. Full ZAP scan (`zaproxy/zap-stable` Docker image) runs only in GitHub Actions CI. INFRA-03 is satisfied with the lightweight local variant; the full ZAP report is a CI artifact.

### CI Pipeline
- **D-04:** GitHub Actions runs all 3 suites (E2E, Lighthouse, ZAP) as parallel jobs on every PR. Target wall time: ~10-12 min total (within the <15 min constraint). Each job uploads its report as a downloadable artifact. Pipeline fails the PR if any suite fails.

### Claude's Discretion
- Playwright directory structure (`e2e/` at root vs `tests/e2e/`)
- Page Object Model depth — full per-page POM vs lighter fixture-per-route
- Lighthouse local run tooling (`@lhci/cli` vs `lighthouse` CLI directly)
- Seed data file format and factory API design
- Exact npm script names (must match INFRA-01/02/03: `test:e2e`, `test:performance`, `test:security`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — INFRA-01 through INFRA-07 define exact acceptance criteria for this phase; all 7 requirements must be met

### Project constraints
- `.planning/PROJECT.md` — Constraints section: Playwright (not Cypress), Firebase Emulators for isolation, GitHub Actions, <15 min CI runtime, multi-tenant isolation coverage required

### Firebase configuration
- `firebase.json` — Emulator ports (Auth:9099, Firestore:8080, Functions:5001, Storage:9199) that Playwright globalSetup must target

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `firebase.json` — Emulator configuration already defined; Playwright globalSetup should read/reference these ports rather than hardcoding
- `functions/package.json` `serve` script — Shows the existing pattern for starting emulators locally (build + emulators:start)

### Established Patterns
- No existing test infrastructure — fully greenfield. All patterns are established here.
- `package.json` script naming convention follows `category:action` format (e.g., `security:scan`, `deploy:dev`) — new test scripts should follow `test:e2e`, `test:performance`, `test:security`
- TypeScript is used throughout (`tsconfig.json` at root, `functions/` with strict mode) — Playwright config must be TypeScript

### Integration Points
- `src/app/api/backend/` — Next.js proxy route that forwards to Cloud Functions; E2E tests will hit this proxy (not Functions directly)
- Firebase Auth emulator at port 9099 — seed factory must create users via Admin SDK against emulator
- Firestore emulator at port 8080 — seed factory populates via Admin SDK; `FIRESTORE_EMULATOR_HOST` env var controls routing
- `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` — existing env var that switches frontend Firebase SDK to emulator mode; must be set to `true` in test environment

</code_context>

<specifics>
## Specific Ideas

No specific UI/UX references — this is infrastructure. Key constraint: `npm run test:e2e` must work with zero manual steps (single-command requirement from INFRA-01).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-test-infrastructure*
*Context gathered: 2026-04-06*
