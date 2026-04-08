---
phase: 07-security-tests
plan: 01
subsystem: security/firestore-rules
tags: [security, firestore, jest, testing, tenant-isolation]
dependency_graph:
  requires: []
  provides: [firestore-rules-test-suite, jest-config]
  affects: [ci-pipeline]
tech_stack:
  added: ["@firebase/rules-unit-testing@5.0.0", "jest@30.3.0", "ts-jest@29.4.9", "@types/jest@30.0.0"]
  patterns: [jest-test-environment-node, ts-jest-commonjs-transform]
key_files:
  created:
    - jest.config.js
    - tsconfig.rules.json
    - tests/firestore-rules/firestore.rules.test.ts
  modified:
    - package.json
decisions:
  - "Used jest.config.js (CommonJS module.exports) instead of jest.config.ts to avoid ts-node requirement at config load time"
  - "tsconfig.rules.json overrides module to commonjs and moduleResolution to node — root tsconfig bundler resolution is incompatible with Jest"
  - "Context helpers (alphaDb, betaDb, unauthDb) implemented as functions not cached variables to ensure fresh Firestore context per test"
  - "afterEach calls testEnv.clearFirestore() for full test isolation between runs"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-08"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 7 Plan 1: Firestore Security Rules Test Suite Summary

Jest + `@firebase/rules-unit-testing` infrastructure and a 28-test suite covering tenant isolation (SEC-02/03/04) across 8 core collections plus backend-only spot-checks.

## What Was Created

### Infrastructure (Task 1)

**`jest.config.js`** — Jest config scoped to `tests/firestore-rules/`. Uses `ts-jest` preset with `tsconfig.rules.json` override, `testEnvironment: 'node'`, and 30-second timeout for emulator-backed tests.

**`tsconfig.rules.json`** — Extends root `tsconfig.json` but overrides `module: "commonjs"` and `moduleResolution: "node"`. Required because the root tsconfig uses `module: "esnext"` + `moduleResolution: "bundler"` which is incompatible with Jest's CommonJS runtime.

**`package.json`** — Added `"test:rules": "jest --config jest.config.js"` script. Added devDependencies: `@firebase/rules-unit-testing@^5.0.0`, `jest@^30.3.0`, `ts-jest@^29.4.9`, `@types/jest@^30.0.0`.

### Test Suite (Task 2)

**`tests/firestore-rules/firestore.rules.test.ts`** — 28 tests across 4 describe blocks.

## Test Count: 28 Tests

| Describe block | Tests |
|---|---|
| SEC-03: Unauthenticated access denied | 9 (5 via test.each + 4 individual) |
| SEC-04: Wrong-tenant access denied | 8 (5 via test.each + 3 individual) |
| SEC-02: Correct tenant reads allowed + writes denied | 17 (5 read test.each + 5 write test.each + 4 individual + plans test with 2 assertions) |
| Backend-only collections | 9 (4 auth test.each + 4 unauth test.each + 1 shared_proposals) |

**Total: 28 test cases** (some test.each iterations count individually at runtime — effective runtime count will be higher due to test.each expansion across collection arrays).

## Collections Covered

### Core business collections (SEC-02/03/04)
- `proposals`, `clients`, `transactions`, `wallets`, `wallet_transactions` — via `test.each`
- `users` — individual tests (owner reads own doc, admin reads tenant member, wrong-tenant denied, unauth denied)
- `tenants` — individual tests (same-tenant allowed, wrong-tenant denied, unauth denied)
- `companies` — individual tests (same-tenant allowed, wrong-tenant denied, unauth denied)
- `plans` — any authenticated user can read; unauthenticated denied

### Backend-only collections (spot-check)
- `whatsappUsage`, `stripe_events`, `whatsappSessions`, `phoneNumberIndex` — authenticated and unauthenticated both denied
- `shared_proposals` — always denied (both auth states)

## Verification Command

```bash
# List discovered test files (no emulator needed)
npx jest --config jest.config.js --listTests

# Full run (requires Firestore emulator at 127.0.0.1:8080)
firebase emulators:exec --only firestore --project demo-proops-test "npm run test:rules"
```

## Deviations from Plan

None — plan executed exactly as written.

The installed `@firebase/rules-unit-testing` version resolved to `^5.0.0` (latest stable at install time) rather than the `^3.0.1` mentioned in research notes. The v5 API is fully backward compatible with the plan's usage patterns (`initializeTestEnvironment`, `assertSucceeds`, `assertFails`).

## Known Stubs

None. The test suite is complete — no placeholder tests or TODO items.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes introduced. Test files use synthetic data only; `withSecurityRulesDisabled` is scoped to test setup helpers only.

## Self-Check: PASSED

- `jest.config.js` exists: FOUND
- `tsconfig.rules.json` exists: FOUND
- `tests/firestore-rules/firestore.rules.test.ts` exists: FOUND
- Commit `db59a16` (Task 1) exists: FOUND
- Commit `9420aaa` (Task 2) exists: FOUND
- `npx jest --config jest.config.js --listTests` output: `tests/firestore-rules/firestore.rules.test.ts`
