---
phase: 01-test-infrastructure
reviewed: 2026-04-06T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - .env.test
  - .github/workflows/test-suite.yml
  - .gitignore
  - .zap-rules.tsv
  - e2e/fixtures/auth.fixture.ts
  - e2e/fixtures/base.fixture.ts
  - e2e/global-setup.ts
  - e2e/global-teardown.ts
  - e2e/lighthouse/lighthouse.config.ts
  - e2e/lighthouse/run-lighthouse.ts
  - e2e/pages/dashboard.page.ts
  - e2e/pages/login.page.ts
  - e2e/pages/proposals.page.ts
  - e2e/pages/transactions.page.ts
  - e2e/security/checks/audit-check.ts
  - e2e/security/checks/cors-check.ts
  - e2e/security/checks/header-check.ts
  - e2e/security/run-security-scan.ts
  - e2e/seed/data/proposals.ts
  - e2e/seed/data/tenants.ts
  - e2e/seed/data/transactions.ts
  - e2e/seed/data/users.ts
  - e2e/seed/data/wallets.ts
  - e2e/seed/seed-factory.ts
  - e2e/smoke.spec.ts
  - e2e/tsconfig.json
  - package.json
  - playwright.config.ts
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-06T00:00:00Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

The Phase 01 test infrastructure is well-structured overall. The Page Object Model is clean, the seed data provides correct tenant isolation between `tenant-alpha` and `tenant-beta`, and the global setup/teardown lifecycle is sound. The CI pipeline follows secure practices (no repository secrets exposed, demo-only Firebase config values).

One critical issue exists: `.env.test` is not excluded from git, meaning it will be committed and could cause confusion with the `.env*` gitignore rule's interaction with the `!.env.example` exception. Six warnings cover reliability and correctness issues that could cause flaky tests or silent failures in CI. Five informational items address quality improvements.

---

## Critical Issues

### CR-01: `.env.test` committed to the repository despite `.env*` gitignore rule

**File:** `.gitignore:34` / `.env.test`

**Issue:** The `.gitignore` contains `.env*` (catches all `.env` prefixed files) with only `!.env.example` as an exception. `.env.test` does NOT match `!.env.example`, so git should be ignoring it — but the file appears in the review scope, indicating it was force-added or the rule is not applied as expected. If `.env.test` is being tracked by git, its contents expose the full emulator configuration. While these are demo-only values, committing any `.env*` file other than `.env.example` violates the stated convention and creates a precedent for accidentally committing real env files. Additionally, the `FIREBASE_STORAGE_EMULATOR_HOST` in `.env.test` (line 10) is absent from the CI workflow env block (`.github/workflows/test-suite.yml` lines 40-50), creating a discrepancy between local and CI environments.

**Fix:** Verify `.env.test` is not tracked (`git ls-files .env.test`). If it is tracked, remove it from git (`git rm --cached .env.test`) and add an explicit exclusion in `.gitignore`:
```
!.env.example
!.env.test
```
Also add the missing storage emulator host to the CI workflow:
```yaml
FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199'
```

---

## Warnings

### WR-01: Emulator process kill on Unix relies on negative PID (process group) — unreliable when `detached: true` is not honored

**File:** `e2e/global-teardown.ts:14`

**Issue:** The teardown kills the emulator by sending `SIGTERM` to `-pid` (the process group). This only works if the spawned process was made a process group leader, which requires `detached: true`. The `global-setup.ts` does pass `detached: true` (line 52), but `unref()` is never called on the child process. Without `unref()`, the Node.js process that runs global-setup will keep a reference to the emulator subprocess alive, potentially interfering with Playwright's own process lifecycle. Additionally, if the emulator startup throws before `pid` is written (e.g., `waitForEmulators` times out), the PID file is never created, and teardown correctly warns — but the orphaned emulator process is never cleaned up in that error path.

**Fix:** Call `unref()` on the emulator process after saving the PID, and add cleanup on startup failure:
```typescript
emulatorProcess.unref();

// In the catch/timeout path of waitForEmulators:
emulatorProcess.kill(); // before rethrowing
```

### WR-02: `global-setup.ts` sets emulator env vars on `process.env` but these do not propagate to the Next.js `webServer` process

**File:** `e2e/global-setup.ts:36-38` / `playwright.config.ts:32-41`

**Issue:** `global-setup.ts` sets `process.env.FIRESTORE_EMULATOR_HOST`, `process.env.FIREBASE_AUTH_EMULATOR_HOST`, and `process.env.FIREBASE_STORAGE_EMULATOR_HOST` — but these only affect the global-setup process itself (used by the Admin SDK for seeding). The Next.js dev server launched by Playwright's `webServer` directive (`playwright.config.ts:29`) inherits its own env from the `webServer.env` block, which does not include `FIRESTORE_EMULATOR_HOST` or `FIREBASE_AUTH_EMULATOR_HOST`. The frontend Firebase client SDK uses `NEXT_PUBLIC_*` env vars (correctly set) and is not affected, but any server-side Next.js code that reads `FIRESTORE_EMULATOR_HOST` directly (e.g., route handlers) will not point to the emulator in CI.

**Fix:** Add the emulator host vars to `playwright.config.ts`'s `webServer.env` block:
```typescript
webServer: {
  env: {
    // ... existing NEXT_PUBLIC_* vars ...
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
  },
},
```

### WR-03: `lhci autorun` called with a `.ts` config file — LHCI does not natively support TypeScript configs

**File:** `.github/workflows/test-suite.yml:87` / `e2e/lighthouse/run-lighthouse.ts:38`

**Issue:** Both the CI workflow and the local runner invoke `npx lhci autorun --config=e2e/lighthouse/lighthouse.config.ts`. The `@lhci/cli` package does not include a TypeScript loader — it uses `require()` to load config files. Passing a `.ts` file will result in a syntax error at runtime (`Unexpected token 'export'`), causing the Lighthouse CI job to fail on every run.

**Fix:** Rename the config file to `lighthouse.config.js` and convert it to CommonJS, or create a `.cjs` wrapper:
```javascript
// e2e/lighthouse/lighthouse.config.js
module.exports = {
  ci: {
    collect: { /* ... */ },
    assert: { /* ... */ },
    upload: { /* ... */ },
  },
};
```
Update all references in the workflow and `run-lighthouse.ts`.

### WR-04: `clearAll()` in `seed-factory.ts` does not reset wallet `balance` field — wallet balance is test-state that leaks between runs using `seedAll()` idempotently

**File:** `e2e/seed/seed-factory.ts:64-96`

**Issue:** `clearAll()` deletes Firestore documents and Auth users correctly. However, the seeded `balance` values on wallets (`WALLET_ALPHA_MAIN.balance = 15000`, etc.) represent a static snapshot. If any test run writes transactions that modify wallet balances via the backend, re-running `seedAll()` without a prior `clearAll()` will call `batch.set()` (not `set(..., { merge: true })`), which completely overwrites the document and resets balance — this is actually correct behavior for `set()`. The real risk is that `clearAll()` is exported but never called from `global-teardown.ts`, meaning emulator state persists across test suite re-runs within the same emulator session (e.g., local `--ui` mode). The second run will hit `auth/uid-already-exists` silently (caught), but Firestore documents from mutating tests won't be cleaned.

**Fix:** Call `clearAll()` before `seedAll()` in `global-setup.ts`, or call it from `global-teardown.ts`:
```typescript
// global-setup.ts, inside globalSetup():
const { seedAll, clearAll } = await import('./seed/seed-factory');
await clearAll(); // reset any previous run's mutations
await seedAll();
```

### WR-05: `audit-check.ts` silently treats a JSON parse failure as zero vulnerabilities

**File:** `e2e/security/checks/audit-check.ts:54-55`

**Issue:** In the inner `catch` block (line 54), when `JSON.parse(output)` fails (e.g., `npm audit` produces unexpected output or the output is truncated), the function returns `{ highCount: 0, criticalCount: 0, error: String(err) }`. The `error` field is returned but the calling code in `run-security-scan.ts` never checks it — it only inspects `highCount` and `criticalCount`. A broken `npm audit` invocation (network issues, corrupted lockfile) would silently report `status: 'pass'` with zero vulnerabilities. This is a false-negative risk in CI.

**Fix:** Propagate the `error` field to the `AuditCheckResult` status when present, or throw:
```typescript
// In runNpmAudit(), on parse failure:
return { highCount: 0, criticalCount: 0, error: `npm audit output unreadable: ${String(err)}` };

// In runAuditCheck(), check for errors:
if (frontend.error || functions.error) {
  return { name: 'npm-audit', status: 'warn', details: `Audit could not complete: ${frontend.error ?? functions.error}`, highCount: 0, criticalCount: 0 };
}
```

### WR-06: Playwright `use.env` block sets emulator vars but this field only applies to the browser context, not Node.js test processes

**File:** `playwright.config.ts:17-20`

**Issue:** The `use.env` block in Playwright config (lines 17-20) sets `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST`. This field injects env vars into the browser's `process.env` via Playwright's test runner context, but the Firebase Admin SDK used in `seed-factory.ts` runs in the global-setup Node.js process — not in the browser. The vars that matter for Admin SDK have already been set correctly in `global-setup.ts` (lines 36-38). However, the `use.env` block creates a misleading implication that these vars configure the frontend. The Firebase JS client SDK does not read `FIRESTORE_EMULATOR_HOST` — it uses `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` and connects via `connectFirestoreEmulator()`. These two `use.env` entries have no effect and will cause confusion.

**Fix:** Remove the dead `use.env` block from `playwright.config.ts`:
```typescript
use: {
  baseURL: 'http://localhost:3000',
  trace: 'on-first-retry',
  // Remove the env block — these vars don't configure the browser-side Firebase client
},
```
The emulator host vars belong only in `global-setup.ts` (for Admin SDK seeding) and in `webServer.env` (for any server-side Next.js code).

---

## Info

### IN-01: `smoke.spec.ts` imports `test` and `expect` from `auth.fixture` but the first test does not use any auth fixture

**File:** `e2e/smoke.spec.ts:1`

**Issue:** The spec imports `{ test, expect }` from `./fixtures/auth.fixture`, but the first test (`"app loads login page"`) only uses the base `page` fixture — no auth fixture is needed. Importing from `auth.fixture` chains through `base.fixture` → `auth.fixture` unnecessarily, instantiating all four POM fixtures for a test that doesn't use them. This is not a bug but does add minor overhead per worker.

**Fix:** Import from `base.fixture` for unauthenticated tests, and from `auth.fixture` only for tests requiring pre-authentication:
```typescript
import { test as baseTest, expect } from './fixtures/base.fixture';
import { test } from './fixtures/auth.fixture';

baseTest('app loads login page', async ({ page }) => { /* ... */ });
test('authenticated user sees dashboard', async ({ authenticatedPage }) => { /* ... */ });
```

### IN-02: `.zap-rules.tsv` downgrades `X-Content-Type-Options` and `X-Frame-Options` to `WARN` in ZAP but `header-check.ts` marks them as `error`-level — inconsistent severity between tools

**File:** `.zap-rules.tsv:5-6` / `e2e/security/checks/header-check.ts:27-37`

**Issue:** The ZAP rules file sets rule `10021` (X-Content-Type-Options) to `WARN` and rule `10020` (X-Frame-Options) to `FAIL`. Meanwhile `header-check.ts` marks both as `level: 'error'` (which maps to `status: 'fail'` in the security scan). The inconsistency means the manual `test:security` script and the ZAP CI job can reach different pass/fail conclusions for the same headers. This is not a bug in isolation but will make it hard to reason about which tool is the authority.

**Fix:** Align severity levels. If `X-Content-Type-Options` and `X-Frame-Options` are required, set both to `FAIL` in `.zap-rules.tsv` (remove lines 5-6 or change `WARN` to `FAIL`). Document in a comment which is authoritative.

### IN-03: `DashboardPage.isLoaded()` always returns `true` — the return value is meaningless

**File:** `e2e/pages/dashboard.page.ts:24-27`

**Issue:** `isLoaded()` always returns `true`. If `waitForURL` throws (timeout, wrong URL), the exception propagates and `true` is never reached. If it succeeds, it returns `true`. The caller gets no useful signal — it should either return `void` (it's purely a wait helper) or return a boolean based on an actual condition check.

**Fix:** Change the return type to `Promise<void>` to match actual semantics, mirroring `ProposalsPage.isLoaded()` which has the same pattern:
```typescript
async isLoaded(): Promise<void> {
  await this.page.waitForURL(/dashboard/, { timeout: 15000 });
}
```
Apply the same fix to `ProposalsPage.isLoaded()` and `TransactionsPage.isLoaded()`.

### IN-04: `package.json` includes `firebase-admin` as a production dependency of the frontend

**File:** `package.json:53`

**Issue:** `firebase-admin` is listed in `dependencies` (not `devDependencies`) of the root `package.json`. The frontend is a Next.js app deployed to Vercel and should never import `firebase-admin` in client-side code (Admin SDK runs only in Cloud Functions). Its presence in production dependencies increases the bundle surface unnecessarily and could cause accidental import in server components. The Admin SDK is used in the E2E seed factory — this is a test-only dependency.

**Fix:** Move `firebase-admin` to `devDependencies`, since it is only used in `e2e/seed/` code:
```json
"devDependencies": {
  "firebase-admin": "^12.7.0",
  ...
}
```
Verify no Next.js route handler or server component imports `firebase-admin` directly (backend uses it only in Cloud Functions).

### IN-05: Lighthouse CI job builds Next.js without Firebase emulator env vars, so the build may fail or warn if the app validates Firebase config at build time

**File:** `.github/workflows/test-suite.yml:83-87`

**Issue:** The `lighthouse` job runs `npm run build` (line 84) without setting any `NEXT_PUBLIC_FIREBASE_*` env vars. If `next build` statically validates or references these public env vars (e.g., via `process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID` in a module that runs at build time), the build will emit warnings or fail. The E2E job correctly sets all vars in its step env. The Lighthouse job omits them entirely.

**Fix:** Add the same `NEXT_PUBLIC_*` env block to the `Build Next.js` step in the `lighthouse` job, or extract them as workflow-level env variables shared across jobs:
```yaml
- name: Build Next.js
  run: npm run build
  env:
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: demo-proops-test
    NEXT_PUBLIC_FIREBASE_API_KEY: demo-key
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: demo-proops-test.firebaseapp.com
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: demo-proops-test.appspot.com
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000'
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:demo'
    NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'true'
```

---

_Reviewed: 2026-04-06T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
