# Phase 7: Security Tests - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 delivers two independent deliverables:

1. **OWASP ZAP baseline scan** (SEC-01): The CI job scaffolding already exists from Phase 1 (`zaproxy/action-baseline@v0.12.0`, `.zap-rules.tsv`). Phase 7 validates it works end-to-end and produces an artifact-backed report.
2. **Firestore rules unit tests** (SEC-02/03/04): New work using `@firebase/rules-unit-testing` + Jest to prove tenant isolation is enforced at the Firestore security rules layer — independent of backend middleware.

These two deliverables are independent: ZAP scans the HTTP surface; rules tests audit the Firestore authorization layer. They run in separate CI jobs.

</domain>

<decisions>
## Implementation Decisions

### ZAP Scan (SEC-01)

- **D-01:** ZAP scans **unauthenticated routes only**. The `security` CI job builds Next.js standalone, starts `npm start` on port 3000, and runs ZAP against it — no Firebase emulators in this job. ZAP finds header/injection issues on the public surface (login, public proposal page).
- **D-02:** `.zap-rules.tsv` already exists at the repo root with a baseline policy from Phase 1. Current policy: `X-Content-Type-Options` and `X-Frame-Options` missing → FAIL (blocks CI); CSP, HSTS, caching → WARN (report only). Keep this policy; add suppressions only if new false positives appear.
- **D-03:** ZAP CI job uses `zaproxy/action-baseline@v0.12.0` with `allow_issue_writing: false` (no GitHub issues created). Reports are uploaded as `zap-report.html` / `zap-report.json` artifacts.
- **D-04:** The `security` CI job is already wired in `.github/workflows/ci.yml`. Phase 7 validates it works; no structural changes to the job needed unless ZAP fails on real findings.
- **D-05:** `npm run test:security` continues to run the lightweight Node.js scan (`run-security-scan.ts`: npm audit + header check + CORS check). ZAP is CI-only (not a local npm script — requires Docker/GitHub Actions environment).

### Firestore Rules Tests (SEC-02/03/04)

- **D-06:** Use **`@firebase/rules-unit-testing` + Jest** as the test runner. Standard Firebase approach, well-documented, proper test report output.
- **D-07:** Test files live in `tests/firestore-rules/` (new top-level directory, separate from `e2e/`). Jest config at `jest.config.ts` in repo root with `testMatch: ['<rootDir>/tests/firestore-rules/**/*.test.ts']`.
- **D-08:** Rules tests run against the **Firestore emulator** (`127.0.0.1:8080`). They do NOT need the Auth emulator or Functions emulator — `@firebase/rules-unit-testing` uses `initializeTestEnvironment()` with a `projectId` of `demo-proops-test`.
- **D-09:** Add `"test:rules": "jest --config jest.config.ts"` to `package.json` scripts.
- **D-10:** A dedicated `firestore-rules` CI job runs the rules tests. It only needs to: start the Firestore emulator, run Jest. No Next.js build needed. This job runs parallel to `e2e` and `performance`.

### Firestore Rules Coverage (SEC-02/03/04)

- **D-11:** Cover **8 core business collections** as "critical" for SEC-02:
  `proposals`, `clients`, `transactions`, `wallets`, `users`, `tenants`, `companies`, `wallet_transactions`
- **D-12:** Spot-check **backend-only collections** (verify fully denied for any auth state): `whatsappUsage`, `stripe_events`, `whatsappSessions`, `phoneNumberIndex`
- **D-13:** Three test categories per collection:
  1. **No claims** (unauthenticated): read/write must be denied (SEC-03)
  2. **Wrong tenant** (Tenant A user accessing Tenant B doc): read/write must be denied (SEC-04)
  3. **Correct tenant**: read must be allowed; write must be denied (all writes are Cloud Functions only)
- **D-14:** The `users` collection has a more complex rule (owner, masterId, admin, superAdmin). Test: owner reads own doc (allow), wrong user reads a different user's doc without admin role (deny).
- **D-15:** `tenants` collection allows `create` for bootstrap tenant (self-registration pattern). Test this allow path AND verify cross-tenant reads are denied.
- **D-16:** `plans` and `pages` collections allow any authenticated user to read (global reference collections). Verify authenticated read succeeds, unauthenticated read is denied.

### Claude's Discretion

- Exact Jest transform config (`ts-jest` vs `@swc/jest`) for TypeScript
- Whether to emit a JSON summary of rules test pass/fail counts as CI artifact
- Specific `initializeTestEnvironment()` helper structure (shared `before`/`after` hooks)
- How to structure test data fixtures (inline vs a shared `rulesTestData.ts` helper)
- TTFB-equivalent metric for the `firestore-rules` CI job (timeout budget)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — SEC-01 through SEC-04: exact acceptance criteria

### Existing security infrastructure (Phase 1)
- `e2e/security/run-security-scan.ts` — lightweight security scan (npm audit + header + CORS); keep untouched
- `e2e/security/checks/` — audit-check, header-check, cors-check implementations
- `.zap-rules.tsv` — ZAP alert policy (WARN/FAIL thresholds for common headers); keep as-is
- `.github/workflows/ci.yml` — existing `security` CI job with `zaproxy/action-baseline@v0.12.0` already configured

### Firestore rules
- `firestore.rules` — the rules file under test; contains 25+ collections with DENY-by-default catch-all
- Key helper functions in rules: `belongsToTenant()`, `getEffectiveTenantId()`, `isSuperAdmin()`, `isOwner()`

### Project constraints
- `.planning/PROJECT.md` — <15 min CI wall time; parallel jobs

</canonical_refs>

<code_context>
## Existing Code Insights

### What Phase 1 already delivered for security
- `security` CI job is fully wired: checkout → build Next.js → start server → ZAP scan → upload artifacts
- `.zap-rules.tsv` has a working baseline with 10 alert rules configured
- `npm run test:security` runs the lightweight scan (no ZAP)
- Gap: ZAP job needs validation that it actually passes (the Next.js standalone build may need `output: 'standalone'` in `next.config.ts` — verify)

### Firestore rules structure
- All 25+ collections use the same `belongsToTenant(resource.data.tenantId)` pattern for reads
- All writes are `if false` (Cloud Functions only) except: `users` (owner update), `tenants` (self-register create + admin update), `spreadsheets` (admin CRUD)
- Backend-only collections have explicit `allow read, write: if false` rules
- Catch-all `/{document=**}` denies everything else

### Integration Points
- `package.json`: Add `"test:rules"` script; add `jest` + `ts-jest` + `@firebase/rules-unit-testing` as devDependencies
- `.github/workflows/ci.yml`: Add `firestore-rules` job (Firestore emulator + Jest only; no Next.js)
- `jest.config.ts`: New file at repo root; scoped to `tests/firestore-rules/`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-security-tests*
*Context gathered: 2026-04-08*
