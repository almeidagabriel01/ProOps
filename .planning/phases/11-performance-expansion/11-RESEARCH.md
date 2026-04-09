# Phase 11: Performance Expansion - Research

**Researched:** 2026-04-09
**Domain:** Playwright Core Web Vitals performance tests — extending existing suite
**Confidence:** HIGH

## Summary

Phase 11 is a narrow, surgical extension of the Phase 6 performance test suite. The entire implementation scope is two new test cases inside `e2e/performance/core-web-vitals.spec.ts`, plus a single clarifying comment in `e2e/performance/api-baselines.spec.ts`. No new files, no config changes, no CI changes are needed.

The key constraint discovered during Phase 6 discussion (locked as D-05) is that `/contacts` and `/products` pages load their data directly from the Firestore client SDK — there is no backend REST endpoint for listing them. PERF-06 (API baseline) is therefore satisfied by the Core Web Vitals tests rather than by adding entries to `api-baselines.spec.ts`.

Both target pages expose an `h1` element and follow the same authenticated routing pattern as the existing `/proposals` and `/transactions` tests. The implementation is a copy-paste-adapt of those two test cases.

**Primary recommendation:** Add two test cases to `core-web-vitals.spec.ts` verbatim-matching the `/proposals` pattern; add one comment block to `api-baselines.spec.ts` explaining the Firestore-direct constraint; done.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Add `/contacts` and `/products` tests to `core-web-vitals.spec.ts` — same file, same pattern as existing tests
- **D-02:** Both tests use `authenticatedPage` fixture (same as proposals/transactions)
- **D-03:** Page load wait selector: `h1` — consistent with existing pattern. Both pages expose an `h1` heading element.
- **D-04:** Thresholds carry forward from Phase 6 (D-06/D-07/D-08): LCP ≤ 6000ms, CLS ≤ 0.1, TTFB ≤ 3000ms — same relaxed values, no new threshold decisions
- **D-05:** Skip API baseline for contacts and products. Data is loaded directly from the Firestore client SDK — there is no `GET /v1/clients` or `GET /v1/products` backend endpoint. PERF-06 is satisfied by the Core Web Vitals tests for these pages.
- **D-06:** `api-baselines.spec.ts` gets no new test cases in this phase — file unchanged except for a clarifying comment

### Claude's Discretion

- Exact comment wording in `api-baselines.spec.ts` explaining the Firestore-direct pattern
- Whether to add a `waitForURL` guard before `waitForSelector('h1')` (consistent with existing proposals/transactions tests)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-04 | Lighthouse CI mede Core Web Vitals na página /contacts (LCP ≤ 2.5s, CLS ≤ 0.1) | Implemented via Playwright PerformanceObserver in `core-web-vitals.spec.ts`; thresholds relaxed to LCP ≤ 6000ms for emulator/CI (Phase 6 precedent, locked D-04) |
| PERF-05 | Lighthouse CI mede Core Web Vitals na página /products (LCP ≤ 2.5s, CLS ≤ 0.1) | Same as PERF-04 — identical implementation pattern |
| PERF-06 | Baseline de response time para endpoints de contacts e products está documentado e validado (≤ 500ms p95) | No REST endpoints exist — satisfied by Core Web Vitals coverage per D-05; documented via comment in `api-baselines.spec.ts` |
</phase_requirements>

---

## Standard Stack

This phase adds no new dependencies. All tooling was established in Phase 6.

### Existing Infrastructure (all unchanged)

| Asset | Path | Role |
|-------|------|------|
| Playwright perf config | `playwright.perf.config.ts` | Points to `e2e/performance/`, runs via `npm run test:performance` |
| Core Web Vitals spec | `e2e/performance/core-web-vitals.spec.ts` | **FILE TO EXTEND** — add 2 new test cases here |
| API baselines spec | `e2e/performance/api-baselines.spec.ts` | **FILE TO COMMENT** — add clarifying comment, no new tests |
| Auth fixture | `e2e/fixtures/auth.fixture.ts` | Provides `authenticatedPage` — login + emulator route setup |
| npm script | `package.json` `"test:performance"` | Runs `npx playwright test --config=playwright.perf.config.ts` |
| CI job | `.github/workflows/test-suite.yml` job `performance` | Runs `npm run test:performance`, uploads `performance-report/` artifact |

[VERIFIED: file read — all paths confirmed to exist with stated contents]

---

## Architecture Patterns

### Pattern: Existing Test Case Structure (MUST match exactly)

The `/proposals` and `/transactions` tests in `core-web-vitals.spec.ts` define the canonical pattern. New tests for `/contacts` and `/products` must replicate this structure identically.

```typescript
// Source: e2e/performance/core-web-vitals.spec.ts (lines 80-106, verified)

test('/proposals page performance', async ({ authenticatedPage }) => {
  await collectWebVitals(authenticatedPage);
  await authenticatedPage.goto('/proposals');
  await authenticatedPage.waitForURL(/\/proposals$/, { timeout: 15000 });
  await authenticatedPage.waitForSelector('h1', { state: 'visible', timeout: 15000 });
  const metrics = await getMetrics(authenticatedPage);

  console.log('Proposals page metrics:', metrics);

  expect(metrics.lcp, `LCP ${metrics.lcp}ms exceeds ${THRESHOLDS.LCP_MS}ms`).toBeLessThanOrEqual(THRESHOLDS.LCP_MS);
  expect(metrics.cls, `CLS ${metrics.cls} exceeds ${THRESHOLDS.CLS}`).toBeLessThanOrEqual(THRESHOLDS.CLS);
  expect(metrics.ttfb, `TTFB ${metrics.ttfb}ms exceeds ${THRESHOLDS.TTFB_MS}ms`).toBeLessThanOrEqual(THRESHOLDS.TTFB_MS);
});
```

Apply this pattern verbatim for `/contacts` and `/products`, adapting:
- The test name string: `'/contacts page performance'` and `'/products page performance'`
- The `goto()` argument: `'/contacts'` and `'/products'`
- The `waitForURL` regex: `/\/contacts$/` and `/\/products$/`
- The `console.log` label: `'Contacts page metrics:'` and `'Products page metrics:'`

### Pattern: Helpers and Thresholds

`collectWebVitals()`, `getMetrics()`, and `THRESHOLDS` are already defined at the top of `core-web-vitals.spec.ts`. New test cases call them unchanged — no modifications to these helpers.

```typescript
// THRESHOLDS constant (verified from file, line 39-43):
const THRESHOLDS = {
  LCP_MS: 6000,
  CLS: 0.1,
  TTFB_MS: 3000,
} as const;
```

[VERIFIED: file read — `e2e/performance/core-web-vitals.spec.ts`]

### Pattern: h1 Selector — Page-by-Page Verification

Both target pages confirmed to have `h1` elements:

| Page | h1 Location | Visibility Condition |
|------|-------------|---------------------|
| `/contacts` | `src/app/contacts/page.tsx` line 70 — `h1` renders inside a `div` that is `display:none` during skeleton, shown once `!showSkeleton` | Needs authenticated session; renders when data finishes loading |
| `/products` | `src/app/products/page.tsx` line 470 — same pattern: `display:none` during skeleton, shown after load | Same |

**Important nuance:** Both pages hide their main content (including `h1`) behind a skeleton while loading. The `waitForSelector('h1', { state: 'visible' })` correctly waits for the skeleton to resolve. This is the same behavior as `/proposals` and `/transactions` — the existing pattern handles it.

[VERIFIED: file read — `src/app/contacts/page.tsx` line 70, `src/app/products/page.tsx` line 470]

### Pattern: API Baselines Comment

`api-baselines.spec.ts` currently has a single test (notifications endpoint). The Phase 11 change is a comment block explaining why no contacts/products endpoints exist:

```typescript
// NOTE: /contacts and /products pages load data directly via the Firestore
// client SDK (getDocs + collection queries in ClientService and ProductService).
// There is no GET /v1/clients or GET /v1/products backend endpoint.
// PERF-06 (API baseline for contacts and products) is therefore satisfied by
// the Core Web Vitals tests in core-web-vitals.spec.ts, not by this file.
```

[VERIFIED: file read — `e2e/performance/api-baselines.spec.ts`, `src/services/client-service.ts` (CONTEXT.md confirms Firestore-direct reads), `src/services/product-service.ts` (same)]

### Anti-Patterns to Avoid

- **Do not add `waitForLoadState('networkidle')`:** Not used in existing tests; emulator environment makes this unreliable. Use `waitForSelector('h1')` as the load signal.
- **Do not define new `THRESHOLDS` values:** The shared constant already covers all three metrics at the correct relaxed values for emulator/CI.
- **Do not create a new test file:** Both changes go into the existing two files — no new `e2e/performance/*.spec.ts` files.
- **Do not modify `playwright.perf.config.ts`:** Config already points to `e2e/performance/**/*.spec.ts`, so new tests in the existing file are automatically discovered.
- **Do not add test cases to `api-baselines.spec.ts`:** D-06 is locked — comment only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| LCP measurement | Custom timing logic | `collectWebVitals()` helper already in `core-web-vitals.spec.ts` |
| CLS measurement | Custom layout-shift accumulator | Same `collectWebVitals()` helper |
| TTFB measurement | Custom Navigation Timing wrapper | `getMetrics()` helper already in file |
| Auth setup for tests | New login/cookie logic | `authenticatedPage` fixture from `e2e/fixtures/auth.fixture.ts` |
| Threshold constants | Duplicate constants per test | `THRESHOLDS` constant defined once at module level |

---

## Common Pitfalls

### Pitfall 1: h1 Hidden During Skeleton

**What goes wrong:** `waitForSelector('h1')` resolves immediately because the `h1` element exists in the DOM but is inside a `display:none` container (skeleton state). Metrics are collected before actual content renders.

**Why it happens:** Both `/contacts` and `/products` use a CSS `display:none` pattern on the main content div while `showSkeleton` is true. The `h1` is part of that hidden div.

**How to avoid:** Use `{ state: 'visible' }` in `waitForSelector` — this is what the existing tests already do and what the pattern prescribes. `waitForSelector('h1', { state: 'visible', timeout: 15000 })` correctly waits for the skeleton to complete.

**Warning signs:** Test passes in under 500ms — that's a sign the selector resolved before the page actually loaded.

### Pitfall 2: Missing `waitForURL` Before `waitForSelector`

**What goes wrong:** The `authenticatedPage` fixture leaves the browser on whichever route the login redirect landed on (dashboard or contacts). Without `waitForURL`, Playwright might collect metrics from the wrong page.

**How to avoid:** Always include `waitForURL(/\/contacts$/)` before `waitForSelector('h1')` — exactly as in the `/proposals` and `/transactions` tests.

### Pitfall 3: Assuming Product Data Exists

**What goes wrong:** `/products` page shows `ContactsEmptyState`-equivalent empty state (no `h1` in content area visible) if there are zero products for the tenant, potentially causing `waitForSelector('h1')` timeout.

**How to avoid:** The CONTEXT.md confirms (code_context section) that seed data is not required — "pages only require an authenticated session to load (data may be empty; h1 renders regardless)." Verified: the `h1` is rendered unconditionally inside the products page content area regardless of whether products exist. The skeleton resolves and the `h1` becomes visible even with an empty product list.

[VERIFIED: file read — `src/app/products/page.tsx` lines 460-487 confirm `h1` is inside the main content div which renders after skeleton, not conditional on data existence]

---

## Code Examples

### New Test Case: /contacts page

```typescript
// Add after the /transactions test case (after line 106 in core-web-vitals.spec.ts)
// Source: extends pattern from /proposals and /transactions tests (lines 80-106)

test('/contacts page performance', async ({ authenticatedPage }) => {
  await collectWebVitals(authenticatedPage);
  await authenticatedPage.goto('/contacts');
  await authenticatedPage.waitForURL(/\/contacts$/, { timeout: 15000 });
  await authenticatedPage.waitForSelector('h1', { state: 'visible', timeout: 15000 });
  const metrics = await getMetrics(authenticatedPage);

  console.log('Contacts page metrics:', metrics);

  expect(metrics.lcp, `LCP ${metrics.lcp}ms exceeds ${THRESHOLDS.LCP_MS}ms`).toBeLessThanOrEqual(THRESHOLDS.LCP_MS);
  expect(metrics.cls, `CLS ${metrics.cls} exceeds ${THRESHOLDS.CLS}`).toBeLessThanOrEqual(THRESHOLDS.CLS);
  expect(metrics.ttfb, `TTFB ${metrics.ttfb}ms exceeds ${THRESHOLDS.TTFB_MS}ms`).toBeLessThanOrEqual(THRESHOLDS.TTFB_MS);
});
```

### New Test Case: /products page

```typescript
// Add after the /contacts test case

test('/products page performance', async ({ authenticatedPage }) => {
  await collectWebVitals(authenticatedPage);
  await authenticatedPage.goto('/products');
  await authenticatedPage.waitForURL(/\/products$/, { timeout: 15000 });
  await authenticatedPage.waitForSelector('h1', { state: 'visible', timeout: 15000 });
  const metrics = await getMetrics(authenticatedPage);

  console.log('Products page metrics:', metrics);

  expect(metrics.lcp, `LCP ${metrics.lcp}ms exceeds ${THRESHOLDS.LCP_MS}ms`).toBeLessThanOrEqual(THRESHOLDS.LCP_MS);
  expect(metrics.cls, `CLS ${metrics.cls} exceeds ${THRESHOLDS.CLS}`).toBeLessThanOrEqual(THRESHOLDS.CLS);
  expect(metrics.ttfb, `TTFB ${metrics.ttfb}ms exceeds ${THRESHOLDS.TTFB_MS}ms`).toBeLessThanOrEqual(THRESHOLDS.TTFB_MS);
});
```

### Comment Block for api-baselines.spec.ts

```typescript
// NOTE: /contacts and /products pages load data directly via the Firestore
// client SDK (getDocs + collection queries in ClientService and ProductService).
// There is no GET /v1/clients or GET /v1/products backend endpoint.
// PERF-06 (API baseline for contacts and products) is therefore satisfied by
// the Core Web Vitals tests in core-web-vitals.spec.ts, not by this file.
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright Test |
| Config file | `playwright.perf.config.ts` (exists, unchanged) |
| Quick run command | `npx playwright test --config=playwright.perf.config.ts` |
| Full suite command | `npm run test:performance` |
| Estimated runtime | ~3-5 minutes (emulator + Next.js startup on cold start; ~30s on reuse) |

[VERIFIED: `playwright.perf.config.ts` read — `testDir: './e2e/performance'`, `webServer` on port 3001, `reuseExistingServer: !process.env.CI`]
[VERIFIED: `package.json` — `"test:performance": "npx playwright test --config=playwright.perf.config.ts"`]

### Existing Tests (Phase 6 — already passing)

| Test | File | Status |
|------|------|--------|
| `/login page performance` | `core-web-vitals.spec.ts` | Exists (lines 51-63) |
| `/dashboard page performance` | `core-web-vitals.spec.ts` | Exists (lines 65-78) |
| `/proposals page performance` | `core-web-vitals.spec.ts` | Exists (lines 80-92) |
| `/transactions page performance` | `core-web-vitals.spec.ts` | Exists (lines 94-106) |
| `GET /api/backend/v1/notifications p95` | `api-baselines.spec.ts` | Exists (lines 15-39) |

[VERIFIED: files read — line numbers confirmed]

### Phase 11 Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-04 | LCP/CLS/TTFB measured on /contacts | e2e performance | `npx playwright test --config=playwright.perf.config.ts` | ❌ Wave 0 — add to existing file |
| PERF-05 | LCP/CLS/TTFB measured on /products | e2e performance | `npx playwright test --config=playwright.perf.config.ts` | ❌ Wave 0 — add to existing file |
| PERF-06 | No REST endpoints — documented via comment | comment + existing CWV coverage | `npx playwright test --config=playwright.perf.config.ts` | ❌ Wave 0 — comment to existing file |

### Sampling Rate

- **Per task commit:** `npx playwright test --config=playwright.perf.config.ts`
- **Per wave merge:** `npm run test:performance`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] Extend `e2e/performance/core-web-vitals.spec.ts` — add `/contacts` and `/products` test cases
- [ ] Extend `e2e/performance/api-baselines.spec.ts` — add clarifying comment block

Note: No new files to create. No framework install needed. Both target files exist. The "Wave 0" here is simply the two file edits — after which the suite is runnable and new tests will be collected.

---

## Environment Availability

Step 2.6: No new external dependencies. All required tooling (Playwright, Firebase Emulators, Node.js 20) was confirmed available during Phase 6 and is unchanged.

The performance test environment depends on:
- Firebase Emulators running (Auth:9099, Firestore:8080, Functions:5001)
- Next.js dev server on port 3001 (auto-started by `playwright.perf.config.ts` webServer config)
- `reuseExistingServer: !process.env.CI` — reuses running server locally, always starts fresh in CI

No new dependency audit required.

---

## Security Domain

Step 2.6 (Security): This phase adds read-only test assertions to an existing test file. No new endpoints, no new authentication flows, no data mutations. No ASVS categories apply to this change.

---

## Open Questions

1. **waitForURL guard for /contacts and /products**
   - What we know: The `authenticatedPage` fixture redirects to `/(dashboard|proposals|transactions|contacts)` on login. If login lands on `/contacts`, the `/contacts` test works without an explicit `waitForURL`. If it lands elsewhere, `goto('/contacts')` navigates there anyway.
   - What's unclear: Whether the `waitForURL` guard is strictly necessary given `goto()` performs the navigation.
   - Recommendation (Claude's Discretion): Include `waitForURL` for consistency with the `/proposals` and `/transactions` tests. Cost is zero; defensive value is non-zero.

2. **Comment placement in api-baselines.spec.ts**
   - What we know: The file has one test describe block with one test inside.
   - Recommendation: Place the comment at the bottom of the file, after the closing `});`, as a standalone block — or at the top of the file before the imports, prefixed with a section header. Bottom-of-file placement is cleaner and won't confuse readers about what the existing test does.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Products page `h1` is visible (not display:none) after skeleton resolves even with zero products | Common Pitfalls / Code Examples | If wrong, `waitForSelector('h1', { state: 'visible' })` would timeout in test environments with no seed products — would need to wait for a different selector or ensure seed data includes ≥1 product |

Note on A1: This was assessed from reading `src/app/products/page.tsx` lines 460-487. The `h1` is inside the main content `div` that becomes visible once `!(tenantLoading || (hasAnyProducts !== false && isTableLoading && !isFiltering))` resolves. When the tenant has zero products, `hasAnyProducts` becomes `false`, which makes the skeleton condition falsy — so the main content div IS shown (no skeleton). The `h1` will be visible. [VERIFIED: file read — page.tsx lines 461-466 confirm the condition]

**If this table is empty after the A1 resolution:** All claims in this research were verified or cited — no user confirmation needed.

---

## Sources

### Primary (HIGH confidence)

- `e2e/performance/core-web-vitals.spec.ts` — full file read; exact implementation pattern, THRESHOLDS constant, helper functions
- `e2e/performance/api-baselines.spec.ts` — full file read; existing test structure, confirms no contacts/products tests
- `playwright.perf.config.ts` — full file read; config structure, testDir, webServer, port 3001
- `src/app/contacts/page.tsx` — lines 1-80 read; h1 at line 70 confirmed
- `src/app/products/page.tsx` — lines 460-490 read; h1 at line 470 confirmed
- `e2e/fixtures/auth.fixture.ts` — full file read; `authenticatedPage` fixture interface confirmed
- `.planning/phases/11-performance-expansion/11-CONTEXT.md` — locked decisions D-01 through D-06
- `.planning/phases/06-performance-tests/06-CONTEXT.md` — Phase 6 locked decisions; thresholds D-06/D-07/D-08
- `package.json` — `test:performance` script verified
- `.github/workflows/test-suite.yml` — `performance` CI job verified (runs `npm run test:performance`, uploads artifact)

### Tertiary (LOW confidence — none in this research)

All claims verified from direct file reads.

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — no new dependencies; all existing infrastructure confirmed by file reads
- Architecture Patterns: HIGH — pattern extracted directly from existing test file; h1 selectors confirmed in source pages
- Pitfalls: HIGH — derived from direct code inspection of skeleton conditions in both target pages
- Validation Architecture: HIGH — all paths/commands verified from actual files

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable domain — Playwright APIs, existing test patterns)
