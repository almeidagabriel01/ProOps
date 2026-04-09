# Phase 7: Security Tests — Research

**Researched:** 2026-04-08
**Phase:** 07-security-tests
**Requirements:** SEC-01, SEC-02, SEC-03, SEC-04

---

## Executive Summary

Phase 7 has two independent deliverables: (1) the OWASP ZAP CI scan, and (2) Firestore rules unit tests. The ZAP infrastructure was largely scaffolded in Phase 1 — it needs validation rather than greenfield work. The Firestore rules tests are new work using `@firebase/rules-unit-testing` + Jest, testing the existing `firestore.rules` file against the Firestore emulator.

---

## Deliverable 1: OWASP ZAP Scan (SEC-01)

### Current State (Phase 1 Scaffolding)

The `security` CI job in `.github/workflows/ci.yml` is already wired:
1. Builds Next.js production (`npm run build` — uses `output: 'standalone'` in `next.config.ts`)
2. Starts server on port 3000 (`npm start` = `next start`)
3. Waits for server (`npx wait-on http://localhost:3000`)
4. Runs `zaproxy/action-baseline@v0.12.0` targeting `http://localhost:3000`
5. Uploads `zap-report.html` / `zap-report.json` as artifacts

### `.zap-rules.tsv` State

File exists at repo root with 10 alert rules. Current FAIL-level rules:
- `10021 X-Content-Type-Options Header Missing → FAIL`
- `10020 X-Frame-Options Header Not Set → FAIL`

**Key insight:** `next.config.ts` already sets both headers:
```typescript
{ key: 'X-Content-Type-Options', value: 'nosniff' }  // ✓
{ key: 'X-Frame-Options', value: 'DENY' }             // ✓
```
ZAP won't trigger these alerts → the FAIL rules are correctly conservative guards that won't block CI given the current security header setup.

### Expected ZAP behavior

ZAP scans `http://localhost:3000` (unauthenticated — Firebase emulators NOT running). The login page will render (Next.js middleware redirects unauthenticated traffic to `/login`). ZAP will see full security headers from `next.config.ts`. The baseline scan checks ~50 passive rules. With current header configuration, the scan should produce WARNs only (not FAILs). **Phase 7 validation: run the job and confirm it produces a report.**

### What Phase 7 does NOT need to do for ZAP
- No changes to `.zap-rules.tsv` (already correct)
- No changes to the `security` CI job steps (already correct)
- No ZAP Docker install (GitHub Action handles this)

---

## Deliverable 2: Firestore Rules Tests (SEC-02/03/04)

### Tool: `@firebase/rules-unit-testing`

Standard Firebase library for testing Firestore security rules against the emulator.

**Installation:**
```bash
npm install --save-dev @firebase/rules-unit-testing jest ts-jest @types/jest
```

Latest stable versions (2025): `@firebase/rules-unit-testing@^3.0.1`, `jest@^29.7.0`, `ts-jest@^29.2.0`.

### Core API

```typescript
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-proops-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),   // reads current rules from disk
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});
```

### Creating Test Contexts

```typescript
// Authenticated context with custom claims (mirrors Firebase Auth custom claims)
const alphaDb = testEnv.authenticatedContext('uid-alpha', {
  tenantId: 'tenant-alpha',
  role: 'admin',
  masterId: 'uid-alpha',
}).firestore();

// Wrong-tenant context (Tenant B user)
const betaDb = testEnv.authenticatedContext('uid-beta', {
  tenantId: 'tenant-beta',
  role: 'admin',
}).firestore();

// Unauthenticated context (no Firebase auth token)
const unauthDb = testEnv.unauthenticatedContext().firestore();
```

### Seeding Test Data (bypass rules)

```typescript
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'proposals', 'prop-001'), {
    tenantId: 'tenant-alpha',
    title: 'Test Proposal',
  });
});
```

### Assertion Pattern

```typescript
// Expect allow
await assertSucceeds(getDoc(doc(alphaDb, 'proposals', 'prop-001')));

// Expect deny
await assertFails(getDoc(doc(betaDb, 'proposals', 'prop-001')));
await assertFails(getDoc(doc(unauthDb, 'proposals', 'prop-001')));
```

---

## TypeScript Configuration for Jest

The project's root `tsconfig.json` uses `module: "esnext"` and `moduleResolution: "bundler"` — incompatible with Jest's CommonJS runtime. A dedicated `tsconfig.rules.json` is required:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "jsx": "react"
  },
  "include": ["tests/**/*.ts"]
}
```

**Jest config (`jest.config.js`, CommonJS format):**
```javascript
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/firestore-rules/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.rules.json' }],
  },
  testTimeout: 30000,  // Rules tests against emulator can take time
};
```

Note: `jest.config.js` uses `module.exports` (CommonJS) to avoid needing ts-node for config loading. The root tsconfig's `module: "esnext"` would break Jest config loading if using `jest.config.ts`.

---

## Emulator Startup for Rules Tests

`@firebase/rules-unit-testing` requires the Firestore emulator to be running. Two approaches:

**CI approach: `firebase emulators:exec`**
```yaml
- name: Run Firestore rules tests
  run: firebase emulators:exec --only firestore --project demo-proops-test "npm run test:rules"
```
Starts the Firestore emulator, runs Jest, then stops it. Self-contained.

**Local dev approach:**
```bash
firebase emulators:start --only firestore --project demo-proops-test &
npm run test:rules
```
Or simply start all emulators via `npm run dev:backend` and then run `npm run test:rules` separately.

**Package script:**
```json
"test:rules": "jest --config jest.config.js"
```
(No emulator start in the script — started by `emulators:exec` in CI, or manually for local dev)

---

## Test Collection Coverage

### 8 Core Business Collections (SEC-02/04)

| Collection | Document field for tenant check | Rule pattern |
|---|---|---|
| `proposals` | `resource.data.tenantId` | `belongsToTenant(resource.data.tenantId)` |
| `clients` | `resource.data.tenantId` | Same |
| `transactions` | `resource.data.tenantId` | Same |
| `wallets` | `resource.data.tenantId` | Same |
| `wallet_transactions` | `resource.data.tenantId` | Same |
| `users` | `resource.data.tenantId` (via `tenantFromData`) | Owner + admin tenant check |
| `tenants` | Doc ID = tenantId | `belongsToTenant(tenantId)` where tenantId = doc ID |
| `companies` | Doc ID = companyId | `companyId == getEffectiveTenantId()` |

### 4 Backend-Only Collections (SEC-03 spot-check)

All have `allow read, write: if false`:
- `whatsappUsage`
- `stripe_events`
- `whatsappSessions`
- `phoneNumberIndex`

Even authenticated users with correct claims are denied. Test: `assertFails` for authenticated alpha user.

### 2 Global Reference Collections

- `plans`: `allow read: if isAuthenticated()` — authenticated user reads allowed, unauthenticated denied
- `shared_proposals`: `allow read: if false` — always denied (access via backend token endpoint only)

---

## Test Scenarios Per Collection

For each core business collection (8 total), test 3 scenarios:

| Scenario | Context | Expected result | Requirement |
|---|---|---|---|
| Unauthenticated read | `unauthenticatedContext()` | DENY | SEC-03 |
| Wrong-tenant read | `authenticatedContext` with `tenantId: 'tenant-beta'` | DENY | SEC-04 |
| Correct-tenant read | `authenticatedContext` with `tenantId: 'tenant-alpha'` | ALLOW | SEC-02 |
| Any write | `authenticatedContext` with correct claims | DENY | SEC-02 (writes are Cloud Functions only) |

---

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| `module: "esnext"` tsconfig breaks ts-jest | High | Use dedicated `tsconfig.rules.json` with `module: "commonjs"` |
| Firestore emulator not running when Jest executes | Medium | Use `firebase emulators:exec` wrapper in CI; document for local dev |
| `users` collection rule complexity (owner/masterId/admin) causes false failures | Low | Seed user doc with matching tenantId; test as admin (hasTenantAdminRole + belongsToTenant) |
| `tenants` collection doc ID = tenantId causes confusion | Low | Clearly document in test: seed doc ID = 'tenant-alpha', assert belongsToTenant check |
| ZAP baseline scan fails on unexpected security finding | Low | `.zap-rules.tsv` already configured; headers set in next.config.ts; run and observe |
| `firebase emulators:exec` fails on Ubuntu CI (Java required for emulators) | Medium | The e2e job already uses emulators on the same ubuntu runner — confirm Java is available via setup-node or system Java |

---

## RESEARCH COMPLETE
