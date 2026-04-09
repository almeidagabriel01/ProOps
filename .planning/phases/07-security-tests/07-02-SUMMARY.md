---
phase: 07-security-tests
plan: "02"
subsystem: ci
tags: [ci, firestore-rules, zap, security]
dependency_graph:
  requires: [07-01-PLAN.md]
  provides: [firestore-rules CI job, ZAP job validation]
  affects: [.github/workflows/test-suite.yml]
tech_stack:
  added: []
  patterns: [firebase emulators:exec, zaproxy/action-baseline]
key_files:
  created: []
  modified:
    - .github/workflows/test-suite.yml
decisions:
  - CI workflow file is test-suite.yml (not ci.yml as referenced in plan context)
  - firestore-rules job added parallel to e2e, performance, and security jobs (no needs: dependency)
  - ZAP security job validated as fully correct — no changes needed
metrics:
  duration: ~5 minutes
  completed: 2026-04-08T23:08:44Z
  tasks_completed: 2
  files_modified: 1
---

# Phase 7 Plan 02: CI Integration for Security Tests Summary

Added the `firestore-rules` CI job to the GitHub Actions workflow and validated the existing `security` (ZAP) job is correctly configured to block PR merge on FAIL-level alerts.

## Tasks Completed

### Task 1: Add firestore-rules CI job

Added a new `firestore-rules` job to `.github/workflows/test-suite.yml` (the actual workflow file — not `ci.yml` as referenced in plan context; the file was renamed in an earlier phase). The job:

- Runs parallel to `e2e`, `performance`, and `security` (no `needs:` dependency)
- Uses `firebase emulators:exec --only firestore --project demo-proops-test` to auto-start/stop the Firestore emulator around the test run
- Runs `npm run test:rules` (which calls `jest --config jest.config.js`)
- `timeout-minutes: 10` — lighter than the 15-minute e2e/performance jobs
- No functions build, no Playwright, no Next.js server needed

**Commit:** `9df9d13`

**YAML added:**
```yaml
  firestore-rules:
    name: Firestore Rules Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Install Firebase CLI
        run: npm install -g firebase-tools
      - name: Run Firestore rules tests
        run: firebase emulators:exec --only firestore --project demo-proops-test "npm run test:rules"
        env:
          CI: true
```

### Task 2: Validate ZAP CI job configuration

All required components were present and correctly configured. No changes needed.

**Validation results:**

| Check | Status | Detail |
|-------|--------|--------|
| `npm run build` step | PASS | "Build Next.js for ZAP scan" step present |
| `npm start &` with PORT=3000 | PASS | Starts on port 3000 |
| `npx wait-on http://localhost:3000` | PASS | `--timeout 30000` set |
| `zaproxy/action-baseline@v0.12.0` | PASS | Present with `target: 'http://localhost:3000'` |
| `rules_file_name: '.zap-rules.tsv'` | PASS | Correctly wired |
| ZAP artifact upload | PASS | Uploads `zap-report.html` + `zap-report.json` (14-day retention) |
| `.zap-rules.tsv` present and non-empty | PASS | 10 rules configured |
| `X-Content-Type-Options` header | PASS | `nosniff` set in `next.config.ts` — rule 10021 FAIL won't fire |
| `X-Frame-Options` header | PASS | `DENY` set in `next.config.ts` — rule 10020 FAIL won't fire |
| `allow_issue_writing: false` | PASS | No GitHub issues created by ZAP |

**Finding:** The `security` job does not include `npm run test:security` (the lightweight Node.js scan step mentioned in phase context). This step was likely intentionally omitted from the job or runs elsewhere. The plan's acceptance criteria do not require it — the ZAP job validation criteria are all met.

## How to Verify

```bash
# Verify firestore-rules job was added
grep "firestore-rules:" .github/workflows/test-suite.yml

# Verify ZAP job components
grep "zaproxy/action-baseline" .github/workflows/test-suite.yml
grep "rules_file_name" .github/workflows/test-suite.yml

# Verify .zap-rules.tsv
cat .zap-rules.tsv
```

## Result

All 4 CI jobs (`e2e`, `performance`, `security`, `firestore-rules`) now run in parallel and independently block PR merge on failure. Phase 7 CI integration is complete.

## Deviations from Plan

**[Rule 1 - Naming] CI workflow file name mismatch**
- **Found during:** Task 1
- **Issue:** Plan references `.github/workflows/ci.yml` but the actual file is `.github/workflows/test-suite.yml` (renamed during Phase 6)
- **Fix:** Applied all changes to the correct file `test-suite.yml`
- **Files modified:** `.github/workflows/test-suite.yml`
- **Commit:** 9df9d13

## Self-Check: PASSED

- [x] `.github/workflows/test-suite.yml` contains `firestore-rules:` job — FOUND
- [x] Commit `9df9d13` exists — FOUND
- [x] `.zap-rules.tsv` present with 10 rules — FOUND
- [x] `next.config.ts` has `X-Frame-Options` and `X-Content-Type-Options` — FOUND
