# Phase 3: Proposals & CRM E2E - Research

**Researched:** 2026-04-07
**Domain:** Playwright E2E — Proposal lifecycle, PDF generation, public share
**Confidence:** HIGH

## Summary

Phase 3 adds E2E tests for the full proposal lifecycle. The feature code is complete and out of scope; only tests are added. The Playwright + Firebase Emulator infrastructure from Phases 1 and 2 is fully operational and provides all needed fixtures, POMs, seed data, and auth helpers. Research confirms the exact API routes, UI routes, seed data structure, and POM extension points needed by the planner.

**Primary recommendation:** Extend `ProposalsPage` POM with form-filling and action methods; write six focused spec files aligned one-to-one with PROP-01 through PROP-06; use `authenticatedPage` for all authenticated tests and `browser.newPage()` (no storageState) for PROP-05.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: CRUD tests drive creation/editing through the full browser UI using form-filling POM methods.
- D-02: Minimum required fields are Claude's discretion — implementer must read form component.
- D-03: Deletion is UI-driven (click delete + confirm dialog). `create-then-delete` pattern — tests clean up after themselves.
- D-04: PDF test (PROP-04) verifies HTTP 200 + `Content-Type: application/pdf` only. No content inspection. Test calls `GET /api/backend/proposals/:id/pdf` directly via `page.request`.
- D-05: Status changes driven via backend API `PUT /api/backend/proposals/:id` with updated status field.
- D-06: Status transitions are separate tests per transition: draft→sent, sent→approved, sent→rejected.
- D-07: Seed proposals (`PROPOSAL_ALPHA_DRAFT`, `PROPOSAL_ALPHA_SENT`, `PROPOSAL_ALPHA_APPROVED`) used as starting states where possible.
- D-08: PROP-05 creates share token via API (`POST /api/backend/proposals/:id/share-link`), then opens `/share/:token` in a fresh unauthenticated browser context.
- D-09: PROP-05 asserts (a) no redirect to `/login` and (b) proposal title/content visible; URL must remain `/share/:token`.

### Claude's Discretion
- Exact required form fields for proposal creation (read `SimpleProposalForm` component)
- `ProposalsPage` POM method signatures and locator strategies
- Whether to add a `ProposalDetailPage` POM or extend `ProposalsPage`
- Exact locator for delete action and confirmation dialog
- How the public share page URL is returned from `POST /proposals/:id/share-link` response

### Deferred Ideas (OUT OF SCOPE)
- Role-based access: member role can view but not delete
- Proposal duplication / clone feature
- CRM contacts linkage E2E
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROP-01 | E2E validates user can create a new proposal with valid data | UI route `/proposals/new` renders `SimpleProposalForm`; form submit calls `POST /v1/proposals` via proxy |
| PROP-02 | E2E validates user can edit an existing proposal | UI route `/proposals/[id]` renders `SimpleProposalForm` with `proposalId`; edit calls `PUT /v1/proposals/:id` |
| PROP-03 | E2E validates user can delete a proposal | Delete action exists on proposals list; uses `create-then-delete` pattern |
| PROP-04 | E2E validates proposal PDF is generated correctly via backend endpoint | Endpoint: `GET /api/backend/proposals/:id/pdf`; returns binary PDF; verify HTTP 200 + content-type only |
| PROP-05 | E2E validates public proposal share link is accessible without authentication | `POST /api/backend/proposals/:id/share-link` creates token; public route `/share/:token` has no auth middleware |
| PROP-06 | E2E validates proposal status transitions (draft→sent→approved/rejected) | Status changes via `PUT /api/backend/proposals/:id`; UI must reflect updated status after reload |
</phase_requirements>

## Standard Stack

### Core (already installed — no new dependencies)
| Library | Version | Purpose |
|---------|---------|---------|
| @playwright/test | existing | Test runner, fixtures, assertions |
| Firebase Emulators | existing | Auth:9099, Firestore:8080, Functions:5001 |

No new packages required. [VERIFIED: codebase glob of e2e/ directory]

## Architecture Patterns

### Existing Infrastructure to Extend

```
e2e/
├── fixtures/
│   ├── auth.fixture.ts       # authenticatedPage, authenticatedAsBeta
│   └── base.fixture.ts       # setupEmulatorRoutes(), POM instances
├── pages/
│   ├── proposals.page.ts     # ProposalsPage — extend this
│   └── login.page.ts         # LoginPage — already used by auth fixture
├── seed/data/
│   └── proposals.ts          # 4 seed proposals with known IDs
└── auth/                     # Phase 2 specs — pattern reference
```

### ProposalsPage POM — Current State
[VERIFIED: read `e2e/pages/proposals.page.ts`]

Existing methods: `goto()`, `isLoaded()`, `getProposalCount()`, `clickNewProposal()`, `getProposalByTitle(title)`.

Must add:
- `createProposal(data)` — navigates to `/proposals/new`, fills form, submits
- `editProposal(id, data)` — navigates to `/proposals/:id`, fills form, submits
- `deleteProposal(title)` — finds row by title, triggers delete, confirms dialog
- Optionally: `getProposalStatus(title)` — reads status badge for PROP-06 UI assertion

### Proposal UI Routes
[VERIFIED: read `src/app/proposals/` directory]

| URL | Purpose |
|-----|---------|
| `/proposals` | List page — main POM target |
| `/proposals/new` | Create form — renders `SimpleProposalForm` without proposalId |
| `/proposals/[id]` | Edit form — renders `SimpleProposalForm` with proposalId |
| `/proposals/[id]/view` | PDF preview (not needed for Phase 3 tests) |
| `/share/[token]` | Public share page — no auth middleware |

### API Endpoints (proxy through Next.js `/api/backend/`)
[VERIFIED: read `src/app/proposals/CLAUDE.md`]

| Method | Path | Auth | Used By |
|--------|------|------|---------|
| POST | `/api/backend/proposals` | Yes | PROP-01 (creation confirmation) |
| PUT | `/api/backend/proposals/:id` | Yes | PROP-02, PROP-06 status changes |
| DELETE | `/api/backend/proposals/:id` | Yes | PROP-03 |
| GET | `/api/backend/proposals/:id/pdf` | Yes | PROP-04 |
| POST | `/api/backend/proposals/:id/share-link` | Yes | PROP-05 |
| GET | `/api/backend/share/:token` | No | PROP-05 public page data |

### Seed Data Available
[VERIFIED: read `e2e/seed/data/proposals.ts`]

| Constant | ID | Status | Tenant |
|----------|----|--------|--------|
| `PROPOSAL_ALPHA_DRAFT` | `proposal-alpha-draft` | draft | tenant-alpha |
| `PROPOSAL_ALPHA_SENT` | `proposal-alpha-sent` | sent | tenant-alpha |
| `PROPOSAL_ALPHA_APPROVED` | `proposal-alpha-approved` | approved | tenant-alpha |
| `PROPOSAL_BETA_DRAFT` | `proposal-beta-draft` | draft | tenant-beta |

All seed proposals have `contactId`, `contactName`, and at least one `items[]` entry. PROP-06 tests use `PROPOSAL_ALPHA_DRAFT` (draft→sent) and `PROPOSAL_ALPHA_SENT` (sent→approved, sent→rejected).

### Proposal Status Values
[VERIFIED: read `e2e/seed/data/proposals.ts` and `src/app/proposals/CLAUDE.md`]

Valid status strings: `"draft"`, `"in_progress"`, `"sent"`, `"approved"`, `"rejected"`. Status is a string field — `PUT /api/backend/proposals/:id` with `{ status: "sent" }` is all that is needed for PROP-06.

### Share Link Response Shape
[VERIFIED: read `src/app/proposals/CLAUDE.md` — SharedProposal section]

`POST /api/backend/proposals/:id/share-link` returns `{ shareUrl, token, expiresAt }`. The `shareUrl` is the full public URL. Tests should extract `token` from the response and construct `/share/${token}` for the unauthenticated page navigation.

### Public Share Page
[VERIFIED: read `src/app/proposals/CLAUDE.md` and `src/app/share/[token]/page.tsx` glob]

Route: `src/app/share/[token]/page.tsx` — public, no middleware. The page fetches via `GET /v1/share/:token` (public endpoint). For PROP-05, open this URL in a `browser.newPage()` context with no `storageState` to simulate an unauthenticated user.

### PDF Endpoint
[VERIFIED: read `src/app/proposals/CLAUDE.md`]

`GET /api/backend/proposals/:id/pdf` — authenticated, returns binary PDF (`Content-Type: application/pdf`). In the emulator, Playwright/Chromium is not available so PDF generation will likely return an error. D-04 decision scopes the test to HTTP response only. Use `page.request.get()` with auth cookie from the authenticated session.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Firebase auth interception | Custom fetch proxy | `interceptFirebaseRequests()` in `auth.fixture.ts` |
| Authenticated browser session | Manual login in each test | `authenticatedPage` fixture |
| Emulator URL rewriting | Per-test route setup | `setupEmulatorRoutes()` in `base.fixture.ts` |
| Seed data setup | Per-test Firestore writes | Existing seed proposals + `global-setup.ts` |

## Common Pitfalls

### Pitfall 1: Mutating Shared Seed Proposals in Status Tests
**What goes wrong:** PROP-06 test changes status of `PROPOSAL_ALPHA_SENT` to `approved`. Next run, the seed proposal is already `approved` and the test fails.
**How to avoid:** For transitions that mutate seed state, create a fresh proposal via API at test start (or restore seed state in teardown). Alternatively, always create a new proposal for each transition test.

### Pitfall 2: PDF Endpoint Returning 500 in Emulator
**What goes wrong:** Playwright/Chromium not available in Firebase Emulator — PDF generation will fail server-side.
**How to avoid:** D-04 scopes the assertion to response reachability only. If 500 is returned, the test should assert that the endpoint is reached and the auth layer worked (401 would indicate auth failure, 500 is acceptable for emulator PDF generation failure). Clarify expected behavior in test expectations.

### Pitfall 3: Unauthenticated Context Getting Auth State
**What goes wrong:** Using `page` from `authenticatedPage` fixture for PROP-05 leaks `storageState` (cookies).
**How to avoid:** Use `browser.newPage()` inside the test — creates a fresh context without inherited auth cookies. The `authenticatedPage` is still needed to call `POST /share-link` API.

### Pitfall 4: Status UI Not Reflecting API Change Without Reload
**What goes wrong:** API call updates Firestore but the page is already loaded and won't re-render.
**How to avoid:** Per D-05/specifics: after `PUT` call, explicitly navigate to the proposal detail page (or use `page.reload()`) before asserting the status badge in the UI.

### Pitfall 5: Form Fields Vary by Tenant Niche
**What goes wrong:** `SimpleProposalForm` renders different steps depending on tenant niche (`automacao_residencial` vs `cortinas` vs default). Seed tenants are `tenant-alpha` and `tenant-beta`.
**How to avoid:** Confirm `tenant-alpha` niche in `e2e/seed/data/tenants.ts` before writing POM `createProposal()` locators.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (existing, Phase 1) |
| Config file | `playwright.config.ts` (root) |
| Quick run command | `npx playwright test e2e/proposals/` |
| Full suite command | `npm run test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROP-01 | User creates proposal with valid data | E2E UI | `npx playwright test e2e/proposals/proposal-crud.spec.ts` | No — Wave 0 |
| PROP-02 | User edits existing proposal | E2E UI | `npx playwright test e2e/proposals/proposal-crud.spec.ts` | No — Wave 0 |
| PROP-03 | User deletes a proposal | E2E UI | `npx playwright test e2e/proposals/proposal-crud.spec.ts` | No — Wave 0 |
| PROP-04 | PDF endpoint returns 200 + application/pdf | E2E API | `npx playwright test e2e/proposals/proposal-pdf.spec.ts` | No — Wave 0 |
| PROP-05 | Public share link accessible without auth | E2E UI | `npx playwright test e2e/proposals/proposal-share.spec.ts` | No — Wave 0 |
| PROP-06 | Status transitions persist and reflect in UI | E2E API+UI | `npx playwright test e2e/proposals/proposal-status.spec.ts` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test e2e/proposals/`
- **Per wave merge:** `npm run test:e2e`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `e2e/proposals/proposal-crud.spec.ts` — covers PROP-01, PROP-02, PROP-03
- [ ] `e2e/proposals/proposal-pdf.spec.ts` — covers PROP-04
- [ ] `e2e/proposals/proposal-share.spec.ts` — covers PROP-05
- [ ] `e2e/proposals/proposal-status.spec.ts` — covers PROP-06
- [ ] `ProposalsPage` POM extensions: `createProposal()`, `editProposal()`, `deleteProposal()`

## Environment Availability

Step 2.6: SKIPPED — no new external dependencies. Phase 3 uses the same Firebase Emulator stack validated in Phase 2.

## Security Domain

Security enforcement is active. Phase 3 is test-only and does not introduce new endpoints or auth paths. No new ASVS controls required. Existing auth enforcement is verified implicitly: PROP-04 tests that an authenticated request returns 200 (auth enforcement works), PROP-05 tests that an unauthenticated request to `/share/:token` is not redirected to `/login` (no over-restriction).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PDF endpoint returns non-401 even in emulator (500 acceptable) | Common Pitfalls | Test may need to accept 500 or mock PDF generation |
| A2 | `POST /api/backend/proposals/:id/share-link` response contains `token` field | Architecture Patterns | POM `shareLink` method needs different field extraction |
| A3 | tenant-alpha has a niche set that determines form steps | Common Pitfalls | POM form-fill locators may differ if niche is unexpected |

## Sources

### Primary (HIGH confidence)
- `e2e/fixtures/auth.fixture.ts` — auth fixture contract verified
- `e2e/fixtures/base.fixture.ts` — base fixture and POM wiring verified
- `e2e/pages/proposals.page.ts` — existing POM methods verified
- `e2e/seed/data/proposals.ts` — seed data structure and IDs verified
- `src/app/proposals/CLAUDE.md` — API endpoints, status values, share link response shape, data model
- `src/app/proposals/new/page.tsx` — new proposal route renders `SimpleProposalForm`
- `.planning/phases/03-proposals-crm-e2e/03-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)
- `src/app/share/[token]/page.tsx` confirmed to exist (glob) — public route is real

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all from direct codebase reads
- Architecture: HIGH — routes, POMs, and seed data verified from source
- Pitfalls: HIGH/MEDIUM — emulator PDF behavior is ASSUMED (A1)

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable codebase)
