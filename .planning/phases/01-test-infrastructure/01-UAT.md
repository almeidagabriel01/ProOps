---
status: testing
phase: 01-test-infrastructure
source:
  - 01-01-SUMMARY.md
  - 01-02-SUMMARY.md
  - 01-03-SUMMARY.md
started: 2026-04-06T00:00:00Z
updated: 2026-04-06T00:00:00Z
---

## Current Test

number: 1
name: Cold Start — npm run test:e2e
expected: |
  Kill any running Firebase Emulators (or confirm none are running).
  Run `npm run test:e2e` from the project root.
  Emulators start automatically, seed data loads, the 2 smoke tests run
  (login page loads + authenticated user sees dashboard), emulators stop.
  Exit code 0. No manual steps required.
awaiting: user response

## Tests

### 1. Cold Start — npm run test:e2e
expected: Kill any running Firebase Emulators. Run `npm run test:e2e`. Emulators start, seed data loads, 2 smoke tests pass, emulators stop. Exit code 0.
result: issue
reported: "Emulators timed out after 60s on Windows"
severity: blocker
fix: "global-setup.ts: MAX_WAIT_MS→120000, poll individual ports (:8080/:9099) instead of hub :4400, replaced shell:true with cmd /c on Windows"

### 2. TypeScript compiles clean
expected: Run `npx tsc --noEmit -p e2e/tsconfig.json`. No errors, exit code 0.
result: [pending]

### 3. npm run test:security (offline mode)
expected: Run `npm run test:security` without starting the dev server. npm audit runs for frontend + functions (shows vulnerability counts). Header and CORS checks are skipped with a warning message. Script exits with code 0 (no criticals).
result: [pending]

### 4. Lighthouse config is CommonJS
expected: Run `node -e "require('./e2e/lighthouse/lighthouse.config.js')"`. No error — config loads cleanly as CommonJS. (Confirms the WR-03 fix: was .ts, now .js)
result: [pending]

### 5. CI workflow has 3 parallel jobs
expected: Open `.github/workflows/test-suite.yml`. Confirm 3 jobs exist: `e2e`, `lighthouse`, `security`. Confirm none of them has a `needs:` field pointing to another (all run in parallel). Each job has an `upload-artifact` step.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0

## Gaps

[none yet]
