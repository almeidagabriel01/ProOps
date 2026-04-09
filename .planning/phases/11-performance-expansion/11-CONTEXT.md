# Phase 11: Performance Expansion - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend Playwright Core Web Vitals tests to cover `/contacts` and `/products` pages by adding two new test cases to the existing `e2e/performance/core-web-vitals.spec.ts`. No changes to `api-baselines.spec.ts`.

</domain>

<decisions>
## Implementation Decisions

### Core Web Vitals extension
- **D-01:** Add `/contacts` and `/products` tests to `core-web-vitals.spec.ts` — same file, same pattern as existing tests
- **D-02:** Both tests use `authenticatedPage` fixture (same as proposals/transactions)
- **D-03:** Page load wait selector: `h1` — consistent with existing pattern (proposals and transactions both use `h1`). Both pages expose an `h1` heading element.
- **D-04:** Thresholds carry forward from Phase 6 (D-06/D-07/D-08): LCP ≤ 6000ms, CLS ≤ 0.1, TTFB ≤ 3000ms — same relaxed values, no new threshold decisions

### PERF-06 handling (API baseline)
- **D-05:** Skip API baseline for contacts and products. Contacts and products list data is loaded directly from the Firestore client SDK (`getDocs` in `ClientService` / `ProductService`) — there is no `GET /v1/clients` or `GET /v1/products` backend endpoint. PERF-06 is satisfied by the Core Web Vitals tests for these pages. Document this constraint in a comment in `api-baselines.spec.ts` so it's clear why no assertion was added.
- **D-06:** `api-baselines.spec.ts` gets no new test cases in this phase — file unchanged except for the clarifying comment

### Claude's Discretion
- Exact comment wording in `api-baselines.spec.ts` explaining the Firestore-direct pattern
- Whether to add a `waitForURL` guard before `waitForSelector('h1')` (consistent with existing proposals/transactions tests)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing performance tests (extend, do not rewrite)
- `e2e/performance/core-web-vitals.spec.ts` — Add `/contacts` and `/products` test cases here; match existing structure exactly
- `e2e/performance/api-baselines.spec.ts` — Add clarifying comment only; no new test cases
- `playwright.perf.config.ts` — Unchanged; already configured for `e2e/performance/`

### Phase 6 context (all threshold and approach decisions are locked here)
- `.planning/phases/06-performance-tests/06-CONTEXT.md` — D-01 through D-18 govern the measurement approach, thresholds, and CI structure

### Requirements
- `.planning/REQUIREMENTS.md` — PERF-04, PERF-05, PERF-06: acceptance criteria for this phase

### Page structure (for selector decisions)
- `src/app/contacts/page.tsx` — `h1` at line ~70; uses `ContactsTableSkeleton` + `DataTable`
- `src/app/products/page.tsx` — `h1` at line ~470; uses `ProductsTableSkeleton` + `DataTable`

### Services (confirms Firestore-direct read pattern for D-05)
- `src/services/client-service.ts` — Lists fetched via `getDocs(query(collection(...)))`, not a backend endpoint
- `src/services/product-service.ts` — Same pattern; only `PUT /v1/products/:id` calls the backend

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `collectWebVitals()` and `getMetrics()` helpers in `core-web-vitals.spec.ts`: Copy-paste pattern for the two new tests — no changes to these helpers needed
- `authenticatedPage` fixture: Used for all authenticated-page tests; use for both `/contacts` and `/products`
- `THRESHOLDS` constant in `core-web-vitals.spec.ts`: Shared constant; new tests reference the same object

### Established Patterns
- `/proposals` test pattern: `collectWebVitals → goto('/proposals') → waitForURL → waitForSelector('h1') → getMetrics → assertions`
- Apply the same pattern verbatim for `/contacts` and `/products`
- Console log pattern: `console.log('Contacts page metrics:', metrics)` for CI debug visibility

### Integration Points
- No changes to `playwright.perf.config.ts`, `package.json`, or GitHub Actions — Phase 6 already wired everything up
- No new seed data needed — pages only require an authenticated session to load (data may be empty; h1 renders regardless)

</code_context>

<specifics>
## Specific References

No external design references. Key constraint: keep the two new test cases structurally identical to the existing `/proposals` and `/transactions` tests — same helper calls, same assertion pattern, same threshold constant.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-performance-expansion*
*Context gathered: 2026-04-09*
