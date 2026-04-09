# Phase 6: Performance Tests - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Playwright-based performance assertions enforce Core Web Vitals thresholds on critical pages (login, dashboard, proposals, transactions) and validate API response time baselines for proposals list and transactions list — CI fails on regression. Lighthouse is NOT used; all measurement is via Playwright's PerformanceObserver / Navigation Timing API and request fixture.

</domain>

<decisions>
## Implementation Decisions

### Measurement approach
- **D-01:** Drop Lighthouse entirely. All performance measurement is done via Playwright:
  - Page metrics (LCP, CLS, TTFB) via PerformanceObserver and Navigation Timing API injected into page context
  - API baselines via Playwright `request` fixture with repeated calls and p95 calculation
- **D-02:** Pages to measure: `/login` (public), `/dashboard`, `/proposals`, `/transactions` (authenticated)
- **D-03:** Authenticated pages use the existing `authenticatedPage` fixture from Phase 2/3 — no special Lighthouse auth setup needed

### Metrics collected
- **D-04:** Per page: **LCP + CLS + TTFB** — the three Core Web Vitals measurable in synthetic/lab mode
  - LCP via `PerformanceObserver` with `largest-contentful-paint` entry type
  - CLS via `layout-shift` PerformanceObserver entries (sum of scores without recent input)
  - TTFB from Navigation Timing: `responseStart - requestStart`
  - FID is interaction-only and cannot be measured synthetically — omit

### Thresholds
- **D-05:** Same thresholds for local and CI (no local/CI split)
- **D-06:** LCP ≤ **4000ms** (relaxed from PERF-01's 2.5s — Next.js on localhost with emulators has no CDN; 4s catches severe regressions without flakiness)
- **D-07:** CLS ≤ **0.1** (strict per PERF-01 — layout shift is environment-independent)
- **D-08:** TTFB: Claude's discretion (reasonable baseline for emulator; suggest ≤ 1000ms)
- **D-09:** API p95 ≤ **500ms** per PERF-03 for both endpoints

### API baseline
- **D-10:** 20 repeated authenticated calls per endpoint via Playwright `request` fixture
- **D-11:** Endpoints: `GET /api/backend/v1/proposals` and `GET /api/backend/v1/transactions`
- **D-12:** Calculate p95 inline (sort durations, take index Math.floor(20 * 0.95) - 1)
- **D-13:** Assert p95 ≤ 500ms; test fails CI if breached

### CI job structure
- **D-14:** Separate `performance-tests` GitHub Actions job, runs **parallel** to `e2e-tests` job
- **D-15:** Uses a dedicated `playwright.perf.config.ts` (separate from `playwright.config.ts`) with `testDir: './e2e/performance'`
- **D-16:** Playwright perf config inherits the same `webServer` configuration (Next.js on port 3001 + emulators) — consistent with E2E environment
- **D-17:** Failure in the perf job blocks the PR just like E2E failures
- **D-18:** Performance tests live in `e2e/performance/` directory (new, separate from existing test directories)

### Claude's Discretion
- Exact PerformanceObserver injection pattern (inline script vs `page.addInitScript`)
- TTFB threshold value (suggest ≤ 1000ms for emulator)
- Whether to emit a JSON summary artifact (timings per page/endpoint) as a CI artifact
- How to handle the `waitForLoadState('networkidle')` vs `'load'` before collecting LCP

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — PERF-01, PERF-02, PERF-03: exact acceptance criteria (LCP/FID/CLS thresholds, CI failure requirement, API baseline spec)

### Existing infrastructure to extend
- `playwright.config.ts` — webServer config, emulator env vars, port 3001 setup — perf config must match this pattern
- `e2e/fixtures/auth.fixture.ts` — `authenticatedPage` fixture for authenticated page measurement
- `e2e/global-setup.ts` — Admin SDK init, emulator env vars, seed data pattern
- `e2e/lighthouse/run-lighthouse.ts` — Existing Lighthouse runner (to be removed or left unused per D-01)
- `e2e/lighthouse/lighthouse.config.js` — Existing Lighthouse config (to be removed or left unused per D-01)

### CI pipeline to extend
- `.github/workflows/` — Existing GitHub Actions workflow(s); add `performance-tests` job parallel to `e2e-tests`

### Project constraints
- `.planning/PROJECT.md` — Constraints section: <15 min CI wall time (parallel jobs respect this), GitHub Actions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `authenticatedPage` fixture (`e2e/fixtures/auth.fixture.ts`): Handles login + emulator route setup — use for dashboard, proposals, transactions measurement without reimplementing auth
- `e2e/global-setup.ts`: Admin SDK init and seed data factory — perf tests can rely on the same seeded data (no new seed required; just needs an existing proposal and transaction to load the list pages)
- Playwright `request` fixture: Available in any Playwright test — use for API p95 calls with auth headers

### Established Patterns
- `playwright.config.ts` webServer pattern: copy for `playwright.perf.config.ts` — same emulator env vars, same port 3001, same `reuseExistingServer: !process.env.CI`
- Test file location: `e2e/{domain}/` — perf tests go in `e2e/performance/` (new directory)
- Emulator topology: Auth:9099, Firestore:8080, Functions:5001, project `demo-proops-test`
- API calls go through Next.js proxy: `http://localhost:3001/api/backend/v1/...` (not direct to emulator Functions URL)

### Integration Points
- `package.json`: Add `"test:performance"` script update — currently runs `run-lighthouse.ts`, update to run `npx playwright test --config=playwright.perf.config.ts`
- GitHub Actions: Add `performance-tests` job to existing workflow file; needs the same setup steps as `e2e-tests` (checkout, node, install, build functions, start emulators via globalSetup)

</code_context>

<specifics>
## Specific Ideas

No specific UI references. Key constraint: if removing/replacing `npm run test:performance` (currently runs Lighthouse), update the script to point to the new Playwright perf runner.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-performance-tests*
*Context gathered: 2026-04-07*
