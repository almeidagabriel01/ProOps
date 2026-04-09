# Phase 6: Performance Tests — Research

**Researched:** 2026-04-07
**Phase:** 06-performance-tests
**Requirements:** PERF-01, PERF-02, PERF-03

---

## Executive Summary

Phase 6 replaces the existing Lighthouse-based performance job with a Playwright-native performance test suite. The key architectural decision (CONTEXT.md D-01) is to **drop Lighthouse entirely** and measure Core Web Vitals (LCP, CLS, TTFB) via `PerformanceObserver` and Navigation Timing API injected into the page, plus API p95 baselines via Playwright's `request` fixture. This removes the Lighthouse/LHCI dependency from the CI hot path and reuses the full emulator+auth infrastructure already established in Phase 1–3.

---

## Current State (Files to Remove/Replace)

| File/Job | Current behavior | Action needed |
|---|---|---|
| `e2e/lighthouse/lighthouse.config.js` | LHCI config, only measures `/login`, no auth | **Remove** |
| `e2e/lighthouse/run-lighthouse.ts` | Runs LHCI via shell | **Remove** |
| `lighthouse` job in `.github/workflows/test-suite.yml` | Runs LHCI autorun | **Replace** with `performance-tests` job |
| `package.json` `test:performance` script | Runs `run-lighthouse.ts` via tsx | **Update** to `npx playwright test --config=playwright.perf.config.ts` |

---

## New Architecture

### Files to Create

```
playwright.perf.config.ts              # Playwright config for perf tests only
e2e/performance/
  core-web-vitals.spec.ts              # LCP, CLS, TTFB per page
  api-baselines.spec.ts                # p95 response time for proposals + transactions APIs
```

### Files to Modify

```
package.json                           # Update test:performance script
.github/workflows/test-suite.yml       # Replace lighthouse job with performance-tests job
```

---

## Implementation: `playwright.perf.config.ts`

Mirror `playwright.config.ts` exactly but with:
- `testDir: './e2e/performance'`
- `globalSetup: './e2e/global-setup.ts'` (same — seeds data, starts emulators)
- `globalTeardown: './e2e/global-teardown.ts'`
- Same `webServer` block (port 3001, same env vars including `FUNCTIONS_LOCAL_API_URL`)
- Same emulator env vars in `process.env` at top of file
- `workers: 1` (sequential — performance measurement needs stable environment)
- `timeout: 60000` (page load + measurement can be slow on CI)
- `retries: 0` (perf tests are not flaky-retried — a threshold breach is a real failure)
- `reporter: [['html', { open: 'never' }], ['list'], ['json', { outputFile: 'performance-report/results.json' }]]`

```typescript
// playwright.perf.config.ts — key differences from playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";

export default defineConfig({
  testDir: "./e2e/performance",
  testMatch: "**/*.spec.ts",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  timeout: 60000,
  expect: { timeout: 15000 },
  workers: 1,
  retries: 0,
  reporter: [
    ["html", { open: "never", outputFolder: "performance-report" }],
    ["list"],
    ["json", { outputFile: "performance-report/results.json" }],
  ],
  use: {
    baseURL: "http://localhost:3001",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: { /* same as playwright.config.ts */ },
});
```

---

## Implementation: Core Web Vitals Test

### Pattern: PerformanceObserver via `page.addInitScript`

Inject observers **before navigation** so they capture all entries from first byte:

```typescript
async function collectWebVitals(page: Page) {
  // Inject before navigation
  await page.addInitScript(() => {
    window.__perfMetrics = { lcpValue: 0, clsValue: 0 };

    // LCP observer
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      (window as any).__perfMetrics.lcpValue = last.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    // CLS observer
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as any;
        if (!shift.hadRecentInput) {
          (window as any).__perfMetrics.clsValue += shift.value;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

async function getMetrics(page: Page) {
  await page.waitForLoadState('networkidle');
  // Small wait to let buffered PerformanceObserver callbacks fire
  await page.waitForTimeout(500);

  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const ttfb = nav ? nav.responseStart - nav.requestStart : -1;
    return {
      lcp: (window as any).__perfMetrics?.lcpValue ?? -1,
      cls: (window as any).__perfMetrics?.clsValue ?? 0,
      ttfb,
    };
  });
}
```

**Why `addInitScript` before navigation:** `PerformanceObserver` with `buffered: true` replays entries that fired before the observer registered, but only within the same document. Injecting before navigation ensures we get entries from the very beginning of the page lifecycle.

**Why `networkidle` + 500ms wait:** LCP fires when the largest element paints, which may happen after the initial load event. `networkidle` ensures all dynamic content (Firestore queries, API calls) has settled.

### Pages and Thresholds (from CONTEXT.md)

| Page | Auth required | LCP threshold | CLS threshold | TTFB threshold |
|---|---|---|---|---|
| `/login` | No | ≤ 4000ms | ≤ 0.1 | ≤ 1000ms |
| `/dashboard` | Yes (`authenticatedPage`) | ≤ 4000ms | ≤ 0.1 | ≤ 1000ms |
| `/proposals` | Yes | ≤ 4000ms | ≤ 0.1 | ≤ 1000ms |
| `/transactions` | Yes | ≤ 4000ms | ≤ 0.1 | ≤ 1000ms |

**Note on FID:** FID (First Input Delay) is an interaction-only metric — it cannot be measured synthetically without actual user input simulation. Per CONTEXT.md D-04, FID is omitted. Requirements PERF-01 mentions FID but the CONTEXT.md overrides this with measurable alternatives (TTFB as synthetic proxy).

### Auth Fixture Usage

For authenticated pages, use the existing `authenticatedPage` fixture from `e2e/fixtures/auth.fixture.ts`. Import from `../fixtures/auth.fixture` (relative path from `e2e/performance/`).

**Critical:** `addInitScript` must be called **before** the fixture navigates. Since the `authenticatedPage` fixture calls `loginPage.goto()` internally, we cannot inject before auth. 

**Solution:** In the perf spec, extend the auth fixture to inject the observer script before the actual target page navigation (not before login), or use a two-step approach: authenticate via `authenticatedPage`, then navigate to the target page with the observer pre-injected via a fresh navigation:

```typescript
test('dashboard performance', async ({ authenticatedPage }) => {
  const page = authenticatedPage;
  // Re-navigate with observers — the auth session persists in the browser context
  await collectWebVitals(page); // addInitScript applies to next navigation
  await page.goto('/dashboard');
  const metrics = await getMetrics(page);
  expect(metrics.lcp).toBeLessThanOrEqual(4000);
  expect(metrics.cls).toBeLessThanOrEqual(0.1);
  expect(metrics.ttfb).toBeLessThanOrEqual(1000);
});
```

**Alternative for login page:** Use `page` fixture directly (no auth needed).

---

## Implementation: API Baseline Test

### Approach (from CONTEXT.md D-10 to D-13)

- 20 authenticated calls per endpoint via Playwright `request` fixture
- Sort durations, calculate p95 at index `Math.floor(20 * 0.95) - 1 = 18` (0-indexed)
- Assert p95 ≤ 500ms

### Auth Token Acquisition

Playwright's `request` fixture cannot reuse browser session cookies directly for auth. Options:

1. **Firebase custom token (recommended):** In `global-setup.ts`, the Admin SDK already creates test users. Use `signInWithEmailAndPassword` via REST API (Firebase Auth emulator) to get an ID token, then set as a header. This pattern is used in existing auth E2E tests.

2. **Cookie extraction from authenticated page:** After `authenticatedPage` fixture runs, extract the `__session` cookie value and use it in `request` calls.

**Recommended approach:** Extend the fixture to expose the auth token. Or use `page.evaluate` to call `firebase.auth().currentUser.getIdToken()` on the already-authenticated page to get a fresh ID token, then use it in `request` calls.

```typescript
test('proposals API baseline', async ({ authenticatedPage, request }) => {
  const page = authenticatedPage;
  // Get current ID token from authenticated browser session
  const idToken = await page.evaluate(async () => {
    const { getAuth } = await import('firebase/auth');
    const auth = getAuth();
    return auth.currentUser?.getIdToken() ?? null;
  });
  
  const durations: number[] = [];
  for (let i = 0; i < 20; i++) {
    const start = Date.now();
    const res = await request.get('http://localhost:3001/api/backend/v1/proposals', {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    durations.push(Date.now() - start);
    expect(res.status()).toBe(200);
  }
  
  durations.sort((a, b) => a - b);
  const p95 = durations[Math.floor(20 * 0.95) - 1];
  expect(p95, `proposals p95 must be ≤ 500ms, got ${p95}ms`).toBeLessThanOrEqual(500);
});
```

**Risk:** Firebase dynamic import may not work in page.evaluate in emulator mode. **Fallback:** Use the `base.fixture.ts` pattern or extend global-setup to write the ID token to a temp file.

**Simpler alternative:** Use Playwright's `request.newContext()` with the session cookie extracted from the browser:

```typescript
const cookies = await page.context().cookies();
const sessionCookie = cookies.find(c => c.name === '__session');
```

Then pass the cookie to `request` calls. This avoids Firebase SDK import issues.

---

## CI Integration: Replace `lighthouse` job

In `.github/workflows/test-suite.yml`, remove the `lighthouse` job and add:

```yaml
performance:
  name: Performance Tests
  runs-on: ubuntu-latest
  timeout-minutes: 15
  steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Install functions dependencies
      run: cd functions && npm ci

    - name: Build functions
      run: cd functions && npm run build

    - name: Install Playwright browsers
      run: npx playwright install chromium --with-deps

    - name: Install Firebase CLI
      run: npm install -g firebase-tools

    - name: Run performance tests
      run: npm run test:performance
      env:
        CI: true
        NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'true'
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: demo-proops-test
        NEXT_PUBLIC_FIREBASE_API_KEY: demo-key
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: demo-proops-test.firebaseapp.com
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: demo-proops-test.appspot.com
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000'
        NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:demo'
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080'
        FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099'
        FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199'

    - name: Upload performance report
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: performance-report
        path: performance-report/
        retention-days: 14
```

**Note:** No `needs:` dependency — runs in parallel with `e2e` and `security` jobs. A threshold breach fails the `performance` job, which blocks PR merge.

---

## Validation Architecture

> This section enables Nyquist validation. The performance test suite is self-verifying — tests that fail ARE the validation.

### Automated verifications available after implementation

| Requirement | Verification | Command |
|---|---|---|
| PERF-01 (LCP/CLS/TTFB thresholds) | Playwright expect assertions in `core-web-vitals.spec.ts` | `npm run test:performance` |
| PERF-02 (CI fails on regression) | `performance` job in `test-suite.yml` with no `continue-on-error` | CI run on PR |
| PERF-03 (API p95 ≤ 500ms) | Playwright expect assertion in `api-baselines.spec.ts` | `npm run test:performance` |

### Wave 0 stubs needed

- `e2e/performance/core-web-vitals.spec.ts` — skeleton with `test.todo()` for all 4 pages
- `e2e/performance/api-baselines.spec.ts` — skeleton with `test.todo()` for proposals + transactions
- `playwright.perf.config.ts` — config file (prerequisite for any test to run)

---

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| LCP measurement captures login page overlay instead of actual page content (authenticated pages redirect) | Medium | Navigate to target page after auth; inject observers before that navigation, not before login |
| Firebase ID token retrieval via `page.evaluate` fails in emulator mode | Medium | Fall back to `__session` cookie extraction from browser context |
| `networkidle` times out on pages with Firestore real-time listeners | Low | `playwright.config.ts` already uses this pattern successfully; use 60s timeout |
| p95 of 20 calls is statistically unstable (first call always slower due to cold start) | Medium | Warm up with 1 discarded call before the 20 measured calls; document in test |
| `e2e/lighthouse/` removal breaks other CI jobs | Low | Only the `lighthouse` job references these files; verify no other imports |
| Global setup seed data doesn't include proposals/transactions for p95 test | Low | Existing seed already creates proposals + transactions (confirmed in Phase 3/5 context) |

---

## Package Script Update

```json
"test:performance": "npx playwright test --config=playwright.perf.config.ts"
```

Remove (or leave as-is since we delete the file it references):
```json
// OLD: "test:performance": "npx tsx e2e/lighthouse/run-lighthouse.ts"
```

---

## Files Summary

**Create:**
- `playwright.perf.config.ts`
- `e2e/performance/core-web-vitals.spec.ts`
- `e2e/performance/api-baselines.spec.ts`

**Modify:**
- `package.json` — update `test:performance` script
- `.github/workflows/test-suite.yml` — replace `lighthouse` job with `performance` job

**Remove:**
- `e2e/lighthouse/lighthouse.config.js`
- `e2e/lighthouse/run-lighthouse.ts`
- `e2e/lighthouse/` directory (if empty after removing files)

---

## RESEARCH COMPLETE
