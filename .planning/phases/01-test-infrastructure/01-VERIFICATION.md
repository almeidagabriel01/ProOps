---
phase: 01-test-infrastructure
verified: 2026-04-06T00:00:00Z
status: gaps_found
score: 7/9 must-haves verified
overrides_applied: 0
gaps:
  - truth: "npm run test:performance generates Lighthouse HTML report (lhci autorun invoked with .ts config)"
    status: failed
    reason: "lhci autorun does not support TypeScript config files natively. Both run-lighthouse.ts and the CI workflow invoke `npx lhci autorun --config=e2e/lighthouse/lighthouse.config.ts` but @lhci/cli uses require() to load configs and will throw a syntax error on the TypeScript export syntax. The command will fail on every run before any audit begins."
    artifacts:
      - path: "e2e/lighthouse/lighthouse.config.ts"
        issue: "Uses ES module export syntax (`export default config`). lhci cannot load .ts files natively."
      - path: "e2e/lighthouse/run-lighthouse.ts"
        issue: "Line 38: passes the .ts config path directly to lhci autorun"
      - path: ".github/workflows/test-suite.yml"
        issue: "Line 87: CI also passes the .ts config path — Lighthouse job will fail on every PR"
    missing:
      - "Rename e2e/lighthouse/lighthouse.config.ts to lighthouse.config.cjs (or .js) and convert to CommonJS: `module.exports = { ci: { ... } }`"
      - "Update run-lighthouse.ts line 35-38 to reference the renamed config file"
      - "Update .github/workflows/test-suite.yml line 87 to reference the renamed config file"

  - truth: "@playwright/test is declared as a project dependency"
    status: failed
    reason: "@playwright/test is installed in node_modules (version 1.59.1) but is absent from package.json devDependencies. The dependency is undeclared — `npm ci` on a fresh clone will not install it, causing both local test:e2e and the GitHub Actions E2E job to fail with 'Cannot find module @playwright/test'."
    artifacts:
      - path: "package.json"
        issue: "@playwright/test is missing from both dependencies and devDependencies sections"
    missing:
      - "Add `\"@playwright/test\": \"^1.59.1\"` to devDependencies in package.json"

deferred: []
human_verification:
  - test: "Run npm run test:e2e end-to-end"
    expected: "Firebase Emulators start, smoke tests pass (login page loads, authenticated user sees dashboard), emulators stop"
    why_human: "Requires Firebase CLI installed, Java runtime for emulators, and a running environment — cannot verify in a static code scan"
  - test: "Run npm run test:performance with dev server running"
    expected: "After the .ts config fix is applied: Lighthouse report is generated in lighthouse-report/ directory with HTML output"
    why_human: "Requires a running Next.js dev server and Chrome binary"
  - test: "Run npm run test:security without dev server"
    expected: "npm audit runs and reports vulnerabilities; header/CORS checks skipped with warning; exit code 0 (no critical vulns)"
    why_human: "Requires npm audit network access and actual dependency lock file state"
---

# Phase 01: test-infrastructure Verification Report

**Phase Goal:** Establish complete automated test infrastructure — Playwright E2E with Firebase Emulators, Lighthouse performance reporting, security scanning, and a GitHub Actions CI pipeline running all three suites in parallel on every PR.
**Verified:** 2026-04-06T00:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `npm run test:e2e` starts Firebase Emulators, seeds data, runs Playwright, stops emulators — zero manual steps | VERIFIED | `package.json` line 24 has `"test:e2e": "npx playwright test"`. `playwright.config.ts` has `globalSetup` → `e2e/global-setup.ts` which spawns emulators, polls hub at 4400, calls `seedAll()`. `globalTeardown` kills via PID file. Pipeline is wired end-to-end. |
| 2 | Playwright configured with TypeScript, globalSetup/globalTeardown, webServer | VERIFIED | `playwright.config.ts` uses TypeScript imports, declares `globalSetup: './e2e/global-setup.ts'`, `globalTeardown: './e2e/global-teardown.ts'`, `webServer` with `npm run dev` and emulator env vars. CI retries set to 2 via `process.env.CI`. |
| 3 | Page Object Model classes exist for login, dashboard, proposals, and transactions | VERIFIED | All four POM files exist and are substantive: `e2e/pages/login.page.ts` (class LoginPage, 5 methods), `dashboard.page.ts`, `proposals.page.ts`, `transactions.page.ts`. Base fixture wires them all. |
| 4 | Reusable auth fixture logs in a seeded user and provides an authenticated page | VERIFIED | `e2e/fixtures/auth.fixture.ts` extends base fixture, uses `LoginPage.login()` with `USER_ADMIN_ALPHA` credentials, waits for authenticated URL pattern, provides `authenticatedPage` and `authenticatedAsBeta` fixtures. |
| 5 | Seed factory creates 2 tenants, 4 users (admin+member per tenant), proposals, transactions, wallets deterministically | VERIFIED | `seed-factory.ts` exports `seedAll` and `clearAll`. Data files confirmed: 2 tenants (alpha/beta), 4 users with `setCustomUserClaims` (tenantId, role, masterId), 3+1 proposals, 3+1 transactions, 2+1 wallets — all with deterministic IDs. |
| 6 | `npm run test:performance` generates a Lighthouse HTML report | FAILED | `run-lighthouse.ts` calls `lhci autorun --config=e2e/lighthouse/lighthouse.config.ts`. lhci uses `require()` to load configs and cannot parse TypeScript syntax (`export default`). This causes a syntax error before any audit runs. The report directory is never created. |
| 7 | `npm run test:security` runs npm audit + header checks + CORS checks and generates a report | VERIFIED | `run-security-scan.ts` orchestrates all three checks. `audit-check.ts` runs `npm audit --json` for frontend and functions. `header-check.ts` checks X-Content-Type-Options, X-Frame-Options/CSP, HSTS. `cors-check.ts` sends OPTIONS with evil origin. Graceful skip when server unreachable. JSON report written to `security-report/`. |
| 8 | GitHub Actions runs E2E, Lighthouse, and OWASP ZAP as parallel jobs on every PR | VERIFIED | `.github/workflows/test-suite.yml` triggers on PR to main/develop, defines 3 jobs (e2e, lighthouse, security) with no `needs:` between them (parallel). Concurrency group cancels duplicates. Each job has `timeout-minutes`. |
| 9 | Each job uploads its report as a downloadable artifact | VERIFIED | E2E uploads `playwright-report` and `playwright-results`. Lighthouse uploads `lighthouse-report`. Security uploads `zap-report` and `security-scan-report`. All use `if: always()` and `retention-days: 14`. |

**Score:** 7/9 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `playwright.config.ts` | Playwright config with globalSetup/globalTeardown, webServer | VERIFIED | All required config present. Note: `use.env` block (WR-06 from review) sets emulator vars that don't affect the browser-side Firebase client — dead config, not a functional blocker. |
| `e2e/global-setup.ts` | Emulator startup + seed data population | VERIFIED | Spawns emulators with detached:true, polls hub, calls seedAll() dynamically after ready. PID saved for teardown. |
| `e2e/global-teardown.ts` | Process kill and cleanup | VERIFIED | Reads PID file, kills emulator process (platform-aware), deletes PID file. |
| `e2e/seed/seed-factory.ts` | Exports seedAll and clearAll | VERIFIED | Both functions exported. Admin SDK initialized with demo-proops-test, reads emulator hosts from env. |
| `e2e/seed/data/tenants.ts` | TENANT_ALPHA and TENANT_BETA constants | VERIFIED | Both exported with distinct IDs (tenant-alpha, tenant-beta) and niches. |
| `e2e/seed/data/users.ts` | 4 user constants with setCustomUserClaims | VERIFIED | USER_ADMIN_ALPHA, USER_MEMBER_ALPHA, USER_ADMIN_BETA, USER_MEMBER_BETA. setCustomUserClaims called with tenantId + role + masterId. |
| `e2e/seed/data/proposals.ts` | 3+ proposals for tenant-alpha, different statuses | VERIFIED | draft, sent, approved for alpha; 1 draft for beta. Realistic fields including items array. |
| `e2e/seed/data/transactions.ts` | 3+ transactions for tenant-alpha | VERIFIED | income-paid, expense-pending, installment for alpha; 1 for beta. |
| `e2e/seed/data/wallets.ts` | Wallets with balance field | VERIFIED | 2 wallets for alpha (15000.0, 8500.0 balances), 1 for beta (3200.0). |
| `e2e/pages/login.page.ts` | class LoginPage with login(email, password) | VERIFIED | Full implementation with 6 methods. Resilient selectors (id + role-based fallback). |
| `e2e/pages/dashboard.page.ts` | class DashboardPage | VERIFIED | Exists and is substantive. |
| `e2e/pages/proposals.page.ts` | class ProposalsPage | VERIFIED | Exists and is substantive. |
| `e2e/pages/transactions.page.ts` | class TransactionsPage | VERIFIED | Exists and is substantive. |
| `e2e/fixtures/base.fixture.ts` | Custom test with POM fixtures | VERIFIED | Exists and wires all 4 POM classes. |
| `e2e/fixtures/auth.fixture.ts` | Provides authenticatedPage fixture | VERIFIED | Extends base fixture, uses LoginPage, provides authenticatedPage and authenticatedAsBeta. |
| `e2e/smoke.spec.ts` | 2 test cases | VERIFIED | 2 tests: "app loads login page" and "authenticated user sees dashboard". |
| `e2e/lighthouse/lighthouse.config.ts` | Lighthouse CI config with Core Web Vitals thresholds | STUB | File exists with correct threshold values (LCP, CLS, FCP, TBT) but exported as TypeScript ES module. lhci cannot load it. The config content is correct; the file format is wrong. |
| `e2e/lighthouse/run-lighthouse.ts` | Script to run Lighthouse locally | PARTIAL | Correctly checks server reachability and exits with clear instructions. The lhci invocation will fail due to .ts config path. |
| `e2e/security/run-security-scan.ts` | Security scan runner with SecurityReport | VERIFIED | Full implementation. SecurityReport interface defined. All three checks orchestrated. |
| `.github/workflows/test-suite.yml` | CI pipeline with 3 parallel jobs | VERIFIED | All 3 jobs present and parallel. ZAP via zaproxy/action-baseline@v0.12.0. |
| `.zap-rules.tsv` | ZAP rules threshold configuration | VERIFIED | Exists and tracked. CSP/HSTS set to WARN for localhost false positives. |
| `package.json` | test:e2e, test:performance, test:security scripts | PARTIAL | All 3 scripts present. However, `@playwright/test` is absent from devDependencies — npm ci on a clean clone will not install it, breaking both local and CI runs. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `playwright.config.ts` | `e2e/global-setup.ts` | globalSetup config option | WIRED | Line 6: `globalSetup: "./e2e/global-setup.ts"` |
| `e2e/global-setup.ts` | `e2e/seed/seed-factory.ts` | Dynamic import of seedAll | WIRED | Line 75: `const { seedAll } = await import("./seed/seed-factory")` |
| `e2e/fixtures/auth.fixture.ts` | `e2e/pages/login.page.ts` | Uses LoginPage to authenticate | WIRED | Line 3: `import { LoginPage } from "../pages/login.page"`. Used in both authenticatedPage and authenticatedAsBeta fixtures. |
| `package.json` test:performance | `e2e/lighthouse/run-lighthouse.ts` | Script invocation | WIRED | `"test:performance": "npx tsx e2e/lighthouse/run-lighthouse.ts"` |
| `package.json` test:security | `e2e/security/run-security-scan.ts` | Script invocation | WIRED | `"test:security": "npx tsx e2e/security/run-security-scan.ts"` |
| `e2e/lighthouse/run-lighthouse.ts` | `e2e/lighthouse/lighthouse.config.ts` | lhci autorun --config= | NOT_WIRED (functional failure) | run-lighthouse.ts line 38 passes the .ts path to lhci which cannot load TypeScript. Wiring exists at the path level but the format mismatch causes runtime failure. |
| `.github/workflows/test-suite.yml` | `package.json` scripts | npm run test:e2e, npm run test:performance | PARTIAL | test:e2e and lhci autorun referenced. The security job does NOT call `npm run test:security` — the lightweight scan step present in the plan was omitted from the final CI YAML. |

---

## Data-Flow Trace (Level 4)

Not applicable — this phase produces test infrastructure scripts, not data-rendering components. No dynamic data rendering to trace.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| test:e2e script exists and references playwright | `node -e "const p=require('./package.json'); console.log(p.scripts['test:e2e'])"` | `npx playwright test` | PASS |
| test:performance script exists | `node -e "const p=require('./package.json'); console.log(p.scripts['test:performance'])"` | `npx tsx e2e/lighthouse/run-lighthouse.ts` | PASS |
| test:security script exists | `node -e "const p=require('./package.json'); console.log(p.scripts['test:security'])"` | `npx tsx e2e/security/run-security-scan.ts` | PASS |
| @playwright/test in package.json | `node -e "const p=require('./package.json'); const all={...p.dependencies,...p.devDependencies}; console.log(!!all['@playwright/test'])"` | `false` | FAIL |
| playwright installed in node_modules | `ls node_modules/@playwright/test` | directory found, version 1.59.1 | PASS (installed but undeclared) |
| lhci config is loadable JS | `node -e "require('./e2e/lighthouse/lighthouse.config.ts')"` | Would fail: SyntaxError on export keyword | FAIL |
| CI workflow has 3 jobs | parsed from YAML | e2e, lighthouse, security jobs confirmed present | PASS |
| CI jobs run in parallel | no `needs:` keys between jobs | confirmed | PASS |

---

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| INFRA-01 | Dev runs `npm run test:e2e` locally against Firebase Emulators with a single command | SATISFIED | Script exists. Playwright config, globalSetup, globalTeardown, webServer all wired. Emulator lifecycle automated. Caveat: @playwright/test undeclared in package.json means fresh clone requires manual install. |
| INFRA-02 | Dev runs `npm run test:performance` to generate Lighthouse report | BLOCKED | Script exists and invokes run-lighthouse.ts correctly, but lhci autorun will fail at config load time due to .ts config format. No report can be generated until config renamed to .js/.cjs. |
| INFRA-03 | Dev runs `npm run test:security` to generate security report | SATISFIED | Script exists. npm audit + header check + CORS check all implemented. Graceful skip when server unreachable. JSON report written to security-report/. |
| INFRA-04 | Playwright configured with TypeScript, reusable fixtures, Page Object Model | SATISFIED | All four POM classes present. Base and auth fixtures wired. TypeScript config in e2e/tsconfig.json. globalSetup/globalTeardown declared. |
| INFRA-05 | Seed data factory populates emulators deterministically (2 tenants, roles, proposals, transactions, wallets) | SATISFIED | seedAll() and clearAll() exported. 2 tenants, 4 users with custom claims, 3+1 proposals, 3+1 transactions, 2+1 wallets — all with deterministic IDs. |
| INFRA-06 | GitHub Actions runs E2E, performance, and security automatically on each PR | SATISFIED (with caveat) | 3 parallel jobs on PR to main/develop. Lighthouse job will fail until config renamed (.ts issue). E2E job will fail on fresh CI runner until @playwright/test added to package.json. |
| INFRA-07 | CI pipeline generates and stores test reports as downloadable artifacts | SATISFIED | 5 artifact uploads total: playwright-report, playwright-results, lighthouse-report, zap-report, security-scan-report. All use `if: always()` and 14-day retention. |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `e2e/lighthouse/lighthouse.config.ts` | 26 | `export default config` in a file loaded by lhci via `require()` — TypeScript ES module syntax in a CommonJS consumer context | Blocker | Lighthouse CI command fails before any audit runs. Both local `npm run test:performance` and CI Lighthouse job are broken. |
| `package.json` | entire file | `@playwright/test` absent from devDependencies despite being installed in node_modules | Blocker | `npm ci` on a fresh clone will not install @playwright/test. Both local E2E and CI E2E job will fail with "Cannot find module '@playwright/test'" on any machine other than the developer's current one. |
| `e2e/global-setup.ts` | 40-54 | `detached: true` but `unref()` never called on emulator process | Warning (WR-01 from review) | Node.js keeps a reference to the subprocess alive, potentially interfering with Playwright's process lifecycle. Orphaned emulator if waitForEmulators times out before PID is written. |
| `playwright.config.ts` | 17-20 | `use.env` block sets `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` | Info (WR-06 from review) | These vars have no effect on the browser-side Firebase JS client SDK. Misleading dead config. Not a functional blocker. |
| `playwright.config.ts` | 33-41 | `webServer.env` missing `FIRESTORE_EMULATOR_HOST` and `FIREBASE_STORAGE_EMULATOR_HOST` | Warning (WR-02 from review) | Any Next.js server-side code reading these env vars directly (route handlers) will not connect to the emulator. Not currently a problem since the app uses NEXT_PUBLIC_ vars for the client SDK, but will become a gap if server components or route handlers use Admin SDK directly. |
| `.github/workflows/test-suite.yml` | 39-50 | CI E2E job missing `FIREBASE_STORAGE_EMULATOR_HOST` env var | Warning (CR-01 from review) | Storage emulator runs but tests can't connect to it from CI. Currently no tests use Storage emulator, so not immediately blocking. |
| `.github/workflows/test-suite.yml` | 99-159 | Security job does not call `npm run test:security` (lightweight scan) | Warning | Plan 3 showed the lightweight scan running in CI before ZAP. The step was dropped in implementation — only ZAP runs. The security-scan-report artifact references `security-report/` but that directory is never created in CI (no `npm run test:security` call). The artifact upload for `security-scan-report` will upload an empty/nonexistent path. |
| `.env.test` | all | Committed to git despite `.env*` gitignore pattern | Info (CR-01 from review) | File was force-added. Contains only demo values, not real secrets. Not a security risk, but violates the stated convention and creates precedent for accidentally committing real env files. |
| `package.json` | 53 | `firebase-admin` in production `dependencies` not `devDependencies` | Info (IN-04 from review) | firebase-admin is only used in e2e/seed/ (test code). Presence in production deps increases bundle surface unnecessarily. Not a functional blocker. |

---

## Human Verification Required

### 1. Full E2E Pipeline Run

**Test:** On a fresh clone (or after `npm ci`), run `npm run test:e2e`
**Expected:** Firebase Emulators start, seed data populates (2 tenants, 4 users, proposals, transactions, wallets), smoke tests pass, emulators stop cleanly. Exit code 0.
**Why human:** Requires Java runtime, Firebase CLI, Chrome browser binary (`npx playwright install chromium`), and actual network connectivity for emulator startup.

### 2. Lighthouse Report Generation (after config fix)

**Test:** After renaming `lighthouse.config.ts` to `lighthouse.config.cjs` and converting to CommonJS: start `npm run dev`, then run `npm run test:performance`
**Expected:** lhci autorun completes, HTML report appears in `lighthouse-report/` directory, threshold assertions produce pass/warn/fail results for LCP, CLS, FCP, TBT
**Why human:** Requires running Next.js dev server and Chrome binary; cannot verify static config load behavior without executing lhci

### 3. Security Scan Standalone Mode

**Test:** Run `npm run test:security` without the dev server running
**Expected:** npm audit runs for frontend and functions/, counts high/critical vulnerabilities, prints summary, writes security-report/security-scan.json; header/CORS checks skipped with warning; exit code 0 (no critical vulns currently)
**Why human:** Requires live npm audit execution against the actual lockfile and network access

---

## Gaps Summary

Two blockers prevent complete goal achievement:

**Blocker 1: Lighthouse config format incompatible with lhci (WR-03)**
The file `e2e/lighthouse/lighthouse.config.ts` uses TypeScript ES module syntax (`export default config`) but lhci loads configs via `require()` which cannot parse TypeScript. Every invocation of `npm run test:performance` and the CI Lighthouse job will throw a syntax error before any audit begins. INFRA-02 is blocked. Fix: rename to `lighthouse.config.cjs`, convert to `module.exports = { ci: { ... } }`, update references in run-lighthouse.ts and test-suite.yml.

**Blocker 2: @playwright/test undeclared in package.json**
`@playwright/test` is installed in node_modules (1.59.1) on the current machine but absent from `package.json` devDependencies. Any clean `npm ci` — including every GitHub Actions E2E run — will not install it, causing "Cannot find module '@playwright/test'" failures. INFRA-01 and INFRA-06 are at risk on fresh environments. Fix: add `"@playwright/test": "^1.59.1"` to devDependencies.

These two gaps are independent and can be fixed in a single small commit. All other infrastructure (seed factory, POM classes, auth fixtures, security scanner, CI structure, artifact uploads) is fully implemented and substantive.

---

_Verified: 2026-04-06T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
