# Phase 5: Stripe & Billing E2E - Research

**Researched:** 2026-04-07
**Domain:** Playwright E2E tests for Stripe billing flows, plan enforcement, and WhatsApp overage cron
**Confidence:** HIGH

## Summary

Phase 5 adds E2E tests covering Stripe subscription state transitions, plan limit enforcement, and WhatsApp overage billing. No production billing code is added — only tests. The critical insight is that the existing infrastructure (Admin SDK in seed-factory, `signInWithEmailPassword` helper, `authenticatedPage` fixture, `request` fixture for API calls) covers all test patterns needed here. No new Playwright fixtures are required — only new test files and a billing seed helper.

The proposals controller uses `tenant-plan-policy.ts` (NOT `billing-helpers.ts`) for plan enforcement. Limits are read from `tenants/{tenantId}` (fields `plan`, `planTier`, `tier`, then `planId`), not from the user doc. The error status code for a plan limit violation on proposal creation is **402** (not 403 as D-02 suggests). The `whatsappUsage` Firestore path confirmed as `whatsappUsage/{tenantId}/months/{YYYY-MM}` (camelCase collection name).

**Primary recommendation:** One billing test file (`e2e/billing/billing.spec.ts`) with five describe blocks. All state setup via Admin SDK direct writes. BILL-01 through BILL-04 use `authenticatedPage.request` for API calls. BILL-05 uses `request` fixture (no browser page needed).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**BILL-01: Subscription feature unlock**
- D-01: No real Stripe checkout — subscription state simulated via Admin SDK direct write (`planId`, `subscriptionStatus`, `stripeSubscriptionId` on master user doc in Firestore).
- D-02: Test pattern: start tenant on `free` plan with `usage.proposals = 5` (at limit), assert `POST /api/backend/v1/proposals` returns 403 (blocked). Then write `planId = "pro"` via Admin SDK. Assert same POST now returns 201 (unblocked).

**BILL-02 + BILL-03: Webhook subscription.created / subscription.cancelled**
- D-03: Webhook simulation via Admin SDK direct write — bypasses `stripeWebhook` Cloud Function signature verification entirely.
- D-04: BILL-02 asserts after writing `planId = "pro"` + `subscriptionStatus = "active"`, previously-blocked API call is now allowed.
- D-05: BILL-03 asserts after writing `planId = "free"` + `subscriptionStatus = "canceled"`, previously-allowed action is blocked again (503/403 on protected API call).

**BILL-04: Plan limit enforcement**
- D-06: API level only — no UI. Set tenant to `free` plan with `usage.proposals` at limit via Admin SDK. Then POST proposal and assert 403/422 with plan limit error from `checkProposalLimit()`.
- D-07: Use separate seed tenant for plan limit tests — don't mutate `tenant-alpha`. Create a fresh tenant or use `tenant-beta` with temporary plan downgrade.

**BILL-05: WhatsApp overage cron**
- D-08: Direct HTTP test — no browser / no Playwright page.
- D-09: Seed Firestore with `whatsapp_usage/{tenantId}/{month}` doc having `overageMessages > 0` and `stripeReported = false`. POST to `/internal/cron/whatsapp-overage-report` with `x-cron-secret` header. Read back Firestore doc and assert `stripeReported = true`.
- D-10: `x-cron-secret` value must match `CRON_SECRET` in `functions/.env`.

### Claude's Discretion
- Exact Firestore document path for `whatsapp_usage` data
- Whether BILL-04 uses `tenant-beta` directly or creates a throwaway tenant
- Exact error message/status code from `checkProposalLimit()`
- Whether BILL-02/03 use a single test or two separate tests
- How to read Firestore state in a pure HTTP test

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BILL-01 | E2E validates tenant subscribes to a plan and features unlock accordingly | Admin SDK write to user doc + API assertion pattern confirmed |
| BILL-02 | E2E validates `subscription.created` webhook updates tenant status correctly | Admin SDK write to tenants/{id} fields; API behavior change confirms state respected |
| BILL-03 | E2E validates `subscription.cancelled` webhook revokes plan access | Admin SDK plan downgrade write; follow-up API call asserts 402 block |
| BILL-04 | E2E validates free-tier tenant is blocked beyond plan limits | tenant_usage monthly doc seeding pattern identified; 402 is correct status |
| BILL-05 | E2E validates WhatsApp overage cron calculates and records correct charge | whatsappUsage Firestore path confirmed; Stripe call fails silently in emulator |
</phase_requirements>

## Standard Stack

### Core (already installed — no new packages needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@playwright/test` | existing | E2E test runner + `request` fixture | Already in use across phases 2-4 |
| `firebase-admin` | existing | Admin SDK for direct Firestore writes | Already used in `seed-factory.ts` and `global-setup.ts` |

**Installation:** None required. All dependencies are present.

## Architecture Patterns

### Recommended File Structure
```
e2e/
├── billing/
│   └── billing.spec.ts          # All BILL-01 through BILL-05 tests
├── helpers/
│   ├── firebase-auth-api.ts     # Already exists — signInWithEmailPassword
│   └── admin-firestore.ts       # NEW: direct Firestore writes from Node context
└── seed/
    └── data/
        └── billing.ts           # NEW: seedBillingState() helper
```

### Pattern 1: Admin SDK Direct Write (state setup)
**What:** Call Firebase Admin SDK to write directly to Firestore emulator from Node test context (same pattern as `seed-factory.ts`).
**When to use:** All billing state setup — plan transitions, usage counters, whatsapp usage docs.

```typescript
// Source: e2e/seed/seed-factory.ts (getAdminApp pattern)
// Replicate getDb() from seed-factory.ts — Admin SDK already points to emulator
// via FIRESTORE_EMULATOR_HOST env var set in global-setup.ts

// Set user doc to free plan at proposal limit
await db.collection("users").doc("user-admin-beta").update({
  planId: "free",
  subscriptionStatus: "canceled",
});

// Set tenant doc tier for tenant-plan-policy resolution
await db.collection("tenants").doc("tenant-beta").update({
  plan: "free",
  subscriptionStatus: "canceled",
});

// Set monthly usage counter to at-limit
const monthId = buildMonthlyPeriodKeyUtc(); // current YYYY-MM
await db.collection("tenant_usage").doc("tenant-beta")
  .collection("months").doc(monthId).set({
    proposalsCreated: 5, // free tier limit is 5
    periodStart: "...",
    periodEnd: "...",
    resetAt: "...",
  });
```

### Pattern 2: API Call via `authenticatedPage.request`
**What:** Use Playwright's `request` object attached to the authenticated page to make direct HTTP calls to the Functions emulator.
**When to use:** BILL-01 through BILL-04 (proposal creation assertion).

```typescript
// Source: e2e/financial/installments.spec.ts — identical pattern
const { idToken } = await signInWithEmailPassword(
  USER_ADMIN_BETA.email,
  USER_ADMIN_BETA.password,
);

const response = await authenticatedPage.request.post(
  "/api/backend/v1/proposals",
  {
    headers: { Authorization: `Bearer ${idToken}` },
    data: { /* minimal valid proposal payload */ },
  }
);
expect(response.status()).toBe(402); // plan limit
```

### Pattern 3: Pure HTTP Request for BILL-05
**What:** Use Playwright `request` fixture (or Node `fetch`) directly — no browser page.
**When to use:** BILL-05 cron endpoint test.

```typescript
// Source: CONTEXT.md D-08, D-09
import { request } from "@playwright/test";

const FUNCTIONS_BASE = "http://127.0.0.1:5001/demo-proops-test/southamerica-east1/api";

const cronResponse = await fetch(`${FUNCTIONS_BASE}/internal/cron/whatsapp-overage-report`, {
  method: "POST",
  headers: {
    "x-cron-secret": process.env.CRON_SECRET || "test-cron-secret",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ month: "2026-01" }),
});
expect(cronResponse.status).toBe(200);

// Read back Firestore to confirm stripeReported = true
const usageSnap = await db.collection("whatsappUsage")
  .doc("tenant-beta")
  .collection("months")
  .doc("2026-01")
  .get();
expect(usageSnap.data()?.stripeReported).toBe(true);
```

### Pattern 4: Restore Tenant State After Test
**What:** Always restore mutated tenant/user docs to original seeded state in test teardown.
**When to use:** Any test that mutates `tenant-alpha` or `tenant-beta`.

```typescript
test.afterEach(async () => {
  // Restore tenant-beta to seeded state
  await db.collection("tenants").doc("tenant-beta").update({
    plan: admin.firestore.FieldValue.delete(),
    subscriptionStatus: admin.firestore.FieldValue.delete(),
  });
  await db.collection("users").doc("user-admin-beta").update({
    planId: "pro", // restore to seeded value
  });
});
```

### Anti-Patterns to Avoid
- **Mutating `tenant-alpha` for billing tests:** `tenant-alpha` is used by all other tests (proposals, CRM, financial). Mutating its plan mid-run poisons parallel test isolation.
- **Calling `stripeWebhook` Cloud Function directly in emulator:** It's a separate function at a different URL requiring real Stripe signature — Admin SDK write is the correct approach per D-03.
- **Using `billing-helpers.ts` error shape as the expected response:** Proposals use `tenant-plan-policy.ts`, which returns 402 with `{ message, code, used, limit, projected, tier }` — not a plain error string.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Firebase Admin SDK in tests | Custom HTTP calls to Firestore REST API | `firebase-admin` (already initialized in seed-factory) | Admin SDK already configured for emulator via env vars |
| ID token for API calls | Custom JWT creation | `signInWithEmailPassword` from `e2e/helpers/firebase-auth-api.ts` | Already exists, tested, handles emulator URL rewriting |
| Stripe API mocking | Mock server or Playwright intercept | Accept Stripe call failure silently (per D-09) | Emulator has no Stripe configured; idempotency key prevents double-reporting |
| Monthly period key calculation | Date arithmetic | Copy `buildMonthlyPeriodKeyUtc()` output or hardcode test month | Tests control the month via `body.month` in cron endpoint |

**Key insight:** All patterns needed already exist in phases 2-4. This phase is assembly of existing patterns, not new infrastructure.

## Critical Technical Findings

### Finding 1: Proposal Plan Limit Returns 402, Not 403
**[VERIFIED: proposals.controller.ts line 1327]**

The CONTEXT.md D-02 states "assert returns 403 (blocked)". The actual code:
```typescript
if (transactionError instanceof ProposalMonthlyLimitError) {
  return res.status(402).json({ ... });
}
```
Tests must assert **402**, not 403. The response body shape is:
```json
{
  "message": "Limite de propostas mensais atingido (5/5). Faça upgrade do plano para continuar.",
  "code": "PLAN_LIMIT_PROPOSALS_MONTHLY",
  "used": 5,
  "limit": 5,
  "projected": 6,
  "tier": "free"
}
```

### Finding 2: Plan Enforcement Reads from `tenants/` Doc, Not User Doc
**[VERIFIED: tenant-plan-policy.ts resolveTenantPlanProfileUncached()]**

The proposals controller calls `enforceTenantPlanLimit({ tenantId, feature: "maxProposalsPerMonth", ... })` which reads `tenants/{tenantId}` — looking for fields `plan`, `planTier`, `tier` (direct tier), then `planId` (resolves via `plans/{planId}` doc), then `priceId`.

For BILL-04, seeding must write to **both**:
1. `tenants/{tenantId}.plan = "free"` (or `.planId = "free"`) — so the plan profile resolves to free tier
2. `tenant_usage/{tenantId}/months/{YYYY-MM}.proposalsCreated = 5` — so the usage counter is at the limit

Writing only to the user doc (`users/{uid}.planId`) is NOT sufficient for proposal plan enforcement.

### Finding 3: Proposals Controller Also Reads Monthly Usage from `tenant_usage`, Not `usage.proposals`
**[VERIFIED: proposals.controller.ts lines 1095-1105, tenant-plan-policy.ts line 952]**

The monthly enforcement reads `tenant_usage/{tenantId}/months/{YYYY-MM}.proposalsCreated`, not `users/{uid}.usage.proposals`. The CONTEXT.md D-02 references `usage.proposals = 5` — that field is on the user doc and used by `billing-helpers.ts` (which proposals no longer use). For BILL-04, seed `tenant_usage` collection.

### Finding 4: whatsappUsage Firestore Path is camelCase
**[VERIFIED: internal.controller.ts line 60]**

Collection name is `whatsappUsage` (camelCase), not `whatsapp_usage` as the CONTEXT.md D-09 spells it.

Path: `whatsappUsage/{tenantId}/months/{YYYY-MM}`

### Finding 5: BILL-05 Stripe Call Fails in Emulator — Affects `charged` Counter
**[VERIFIED: internal.controller.ts lines 93-113]**

The cron endpoint calls `stripe.billing.meterEvents.create(...)`. In the emulator there is no real Stripe configured — this call throws. The error is caught per-tenant (lines 116-120) and added to `errors[]`. The `stripeReported` field is only written **after** the Stripe call succeeds (line 103-113), so if Stripe fails, `stripeReported` stays `false`.

**Consequence:** BILL-05 cannot assert `stripeReported = true` directly, because the Stripe API call will fail in the emulator. The assertion must be `charged = 0, errors = [{tenantId, message}]` (confirming the cron processed the tenant but Stripe call failed). Alternatively, the test can mock the Stripe call via Playwright route interception or set `stripeCustomerId` to empty to trigger the pre-Stripe skip path.

**Recommended approach:** Seed tenant without `stripeCustomerId` field (or with an empty string) — the controller checks `if (!stripeCustomerId)` at line 84-89 and pushes to `errors[]` with `"Missing tenant.stripeCustomerId"`, skipping the Stripe call entirely. This lets the test assert the cron processed the right tenant without needing to mock Stripe. The idempotency behavior (skipping already-reported) can still be verified by seeding `stripeReported = true` and asserting `skipped = 1`.

### Finding 6: CRON_SECRET in Functions Emulator
**[ASSUMED]**

The Functions emulator loads env vars from `functions/.env.erp-softcode` at startup (the file that exists on the developer's machine but is not committed). The `CRON_SECRET` value is unknown to this research session. Tests must either:
- Read from `process.env.CRON_SECRET` (set by emulator at startup, not propagated to test process automatically), or
- Hardcode a test-only value and ensure the Functions emulator env has the same value

The safest pattern is to add `CRON_SECRET=test-cron-secret` to a committed `functions/.env.test` or to the emulator env injection in `global-setup.ts`.

### Finding 7: tenant-beta Admin User is Seeded with `planId = "pro"` on User Doc
**[VERIFIED: e2e/seed/data/users.ts line 86]**

Admin users get `planId = "pro"` on their user doc. But since proposals controller uses `tenant-plan-policy.ts` (reads from `tenants/` doc), the user doc `planId` field is irrelevant for proposal enforcement. The `tenants/tenant-beta` doc has no `plan` field (only `id`, `tenantId`, `name`, `niche`, `primaryColor`, `createdAt`). Without a plan field, the compat fallback resolves to `starter` tier (80 proposals/month limit). For BILL-04, must explicitly write `plan: "free"` to `tenants/tenant-beta`.

## Common Pitfalls

### Pitfall 1: Asserting Wrong Status Code for Plan Limit
**What goes wrong:** Test asserts 403 for proposal plan limit block — test fails because controller returns 402.
**Why it happens:** CONTEXT.md D-02 says "returns 403" but the code returns 402 for `ProposalMonthlyLimitError`.
**How to avoid:** Assert `toBe(402)` for proposal creation when over limit.
**Warning signs:** Test expecting 403 gets 402 and fails.

### Pitfall 2: Seeding Only User Doc for Plan State
**What goes wrong:** Test writes `planId = "free"` to user doc, but proposal creation still succeeds because `tenant-plan-policy.ts` reads from `tenants/` doc.
**Why it happens:** Two coexisting billing systems — `billing-helpers.ts` reads user doc (old controllers), `tenant-plan-policy.ts` reads tenant doc (proposals controller).
**How to avoid:** For proposal limit tests, write `plan: "free"` to `tenants/{tenantId}` AND seed `tenant_usage/{tenantId}/months/{YYYY-MM}.proposalsCreated = 5`.

### Pitfall 3: BILL-05 Expecting stripeReported = true When Stripe Fails
**What goes wrong:** Test seeds usage doc and calls cron, expects `stripeReported = true` — but Stripe API call throws in emulator and the field is never written.
**Why it happens:** The update to `stripeReported: true` is inside the try block after the Stripe call.
**How to avoid:** Either seed tenant without `stripeCustomerId` (triggers pre-Stripe error path, controllable assertion) or intercept the Stripe call via Playwright route mock. Recommended: use the missing `stripeCustomerId` path.

### Pitfall 4: Plan Cache in Functions Emulator
**What goes wrong:** Test writes `plan: "free"` to tenant doc, immediately calls POST /proposals — but the in-memory plan cache (30s TTL) serves the old "starter" profile.
**Why it happens:** `tenant-plan-policy.ts` caches plan profiles in `PLAN_CACHE: Map` for 30s per Cloud Run instance. The emulator runs a single instance.
**How to avoid:** Test always creates a fresh tenant doc state before making the proposal POST. Since emulator instance persists across a test run, wait for cache TTL OR use a unique `tenantId` per test that was never cached. Recommended: use a unique throwaway tenant for BILL-04 so the plan cache never has an entry for it.

### Pitfall 5: whatsappUsage Collection Name Spelling
**What goes wrong:** Seed writes to `whatsapp_usage` (snake_case) but controller reads from `whatsappUsage` (camelCase) — doc never found, test passes trivially because the cron skips the tenant.
**Why it happens:** CONTEXT.md D-09 spells it `whatsapp_usage` but the controller uses `whatsappUsage`.
**How to avoid:** Use `whatsappUsage` (camelCase) in all test seed writes.

### Pitfall 6: BILL-05 Tenant Must Have whatsappEnabled = true AND whatsappAllowOverage = true
**What goes wrong:** Cron skips tenant because these boolean fields are missing from the `tenants/` doc — `processed = 0`.
**Why it happens:** The cron queries `tenants.where("whatsappEnabled", "==", true).where("whatsappAllowOverage", "==", true)`.
**How to avoid:** Seed `tenants/{tenantId}` with both `whatsappEnabled: true` and `whatsappAllowOverage: true` before calling the cron endpoint.

## Code Examples

### BILL-04 Correct Seeding Pattern
```typescript
// Source: tenant-plan-policy.ts resolveTenantPlanProfileUncached() + proposals.controller.ts
// Step 1: Set tenant doc to free tier (policy reads tenants/{id}.plan first)
await db.collection("tenants").doc("tenant-billing-test").set({
  id: "tenant-billing-test",
  tenantId: "tenant-billing-test",
  name: "Billing Test Tenant",
  niche: "automacao_residencial",
  plan: "free",  // direct tier — resolves without plans/ collection lookup
}, { merge: true });

// Step 2: Seed monthly usage at limit (policy reads tenant_usage/{id}/months/{YYYY-MM})
const monthId = new Date().toISOString().slice(0, 7); // YYYY-MM
await db.collection("tenant_usage").doc("tenant-billing-test")
  .collection("months").doc(monthId).set({
    proposalsCreated: 5,  // free tier limit = 5
    periodStart: `${monthId}-01T00:00:00.000Z`,
    periodEnd: `${new Date(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1).toISOString()}`,
    resetAt: `${new Date(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1).toISOString()}`,
    updatedAt: new Date().toISOString(),
  });
```

### BILL-05 Correct Seeding Pattern
```typescript
// Source: internal.controller.ts — tenant must have whatsappEnabled + whatsappAllowOverage
// and a stripeCustomerId for the Stripe path, OR omit stripeCustomerId for the error path

// Seed tenant for WhatsApp overage
await db.collection("tenants").doc("tenant-beta").set({
  whatsappEnabled: true,
  whatsappAllowOverage: true,
  // Intentionally omit stripeCustomerId to avoid Stripe API call in emulator
  // Controller returns error: "Missing tenant.stripeCustomerId" — testable assertion
}, { merge: true });

// Seed overage usage doc
const testMonth = "2026-01"; // past month — not current month
await db.collection("whatsappUsage").doc("tenant-beta")
  .collection("months").doc(testMonth).set({
    overageMessages: 50,
    stripeReported: false,
  });
```

### Admin SDK Helper (to add as e2e/helpers/admin-firestore.ts)
```typescript
// Source: seed-factory.ts getAdminApp() pattern
import * as admin from "firebase-admin";

export function getTestDb(): admin.firestore.Firestore {
  const app = admin.apps.length > 0 ? admin.apps[0]! : admin.initializeApp({ projectId: "demo-proops-test" });
  return app.firestore();
}
```

## Runtime State Inventory

Not applicable — greenfield test files. No rename/refactor.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Firebase Emulators | All tests | Already running (phases 1-4) | — | — |
| `firebase-admin` in test context | Admin SDK writes | Already used in seed-factory | — | — |
| `CRON_SECRET` env var | BILL-05 | ASSUMED available in functions/.env | — | Hardcode test value in emulator env |

**Missing dependencies with no fallback:**
- `CRON_SECRET` value must be known at test time. Planner should add a task to verify or inject a test-safe value.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright Test (existing) |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test e2e/billing/billing.spec.ts` |
| Full suite command | `npm run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BILL-01 | Plan upgrade unblocks proposal creation | API (no UI) | `npx playwright test e2e/billing/billing.spec.ts --grep BILL-01` | ❌ Wave 0 |
| BILL-02 | subscription.created write allows API call | API (no UI) | `npx playwright test e2e/billing/billing.spec.ts --grep BILL-02` | ❌ Wave 0 |
| BILL-03 | subscription.cancelled write blocks API call | API (no UI) | `npx playwright test e2e/billing/billing.spec.ts --grep BILL-03` | ❌ Wave 0 |
| BILL-04 | Free plan blocks proposal creation at limit | API (no UI) | `npx playwright test e2e/billing/billing.spec.ts --grep BILL-04` | ❌ Wave 0 |
| BILL-05 | Overage cron processes tenant and records result | HTTP (no browser) | `npx playwright test e2e/billing/billing.spec.ts --grep BILL-05` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test e2e/billing/billing.spec.ts`
- **Per wave merge:** `npm run test:e2e`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `e2e/billing/billing.spec.ts` — all BILL-01 through BILL-05 tests
- [ ] `e2e/helpers/admin-firestore.ts` — `getTestDb()` helper for Node-context Firestore access

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `CRON_SECRET` value is available in the Functions emulator env at test time | Environment Availability | BILL-05 returns 401 — test fails to invoke cron |
| A2 | Plan cache (30s TTL) does not interfere if test uses a unique throwaway tenantId | Common Pitfalls (Pitfall 4) | BILL-04 might pass even when it should block (stale "starter" cache entry) |
| A3 | The `tenant-plan-policy.ts` in-memory cache is cold for a fresh throwaway tenantId | Critical Finding 7 | Low risk — new tenantIds are never pre-cached |

## Open Questions (RESOLVED)

1. **CRON_SECRET value for tests** *(RESOLVED)*
   - What we know: `internal.controller.ts` reads `process.env.CRON_SECRET` and returns 401 if it doesn't match
   - Resolution: Plan 05-01 Task 1 creates `functions/.env.local` with `CRON_SECRET=test-cron-secret`. Tests use `process.env.CRON_SECRET || "test-cron-secret"` as fallback.

2. **Whether BILL-02/03 should be one test or two** *(RESOLVED)*
   - What we know: CONTEXT.md leaves this to Claude's discretion
   - Resolution: Two separate describe blocks in `subscription.spec.ts`, each self-contained with setup/teardown.

## Sources

### Primary (HIGH confidence)
- `functions/src/api/controllers/proposals.controller.ts` — plan enforcement status code (402), ProposalMonthlyLimitError shape, tenant_usage collection path
- `functions/src/lib/tenant-plan-policy.ts` — resolveTenantPlanProfileUncached(), tenant doc field priority (plan → planId → priceId), 30s cache TTL
- `functions/src/api/controllers/internal.controller.ts` — whatsappUsage path (camelCase), Stripe call inside try block, stripeCustomerId guard, tenant query filters
- `functions/src/lib/billing-helpers.ts` — confirmed proposals controller does NOT use this file
- `e2e/seed/seed-factory.ts` — Admin SDK initialization pattern for emulator
- `e2e/helpers/firebase-auth-api.ts` — signInWithEmailPassword reuse pattern
- `e2e/financial/installments.spec.ts` — API call via authenticatedPage.request pattern
- `e2e/seed/data/users.ts` — confirmed admin users get `planId: "pro"` on user doc
- `e2e/seed/data/tenants.ts` — confirmed tenant docs have no `plan` field by default

### Secondary (MEDIUM confidence)
- `functions/src/CLAUDE.md` — whatsappUsage collection name reference, cron manual endpoint docs
- `functions/src/lib/CLAUDE.md` — billing systems architecture diagram, compat fallback = "starter"

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing packages, no new dependencies
- Architecture: HIGH — all patterns verified in codebase
- Pitfalls: HIGH — all verified by reading actual controller code
- CRON_SECRET: LOW — env file not committed, actual value unknown

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable billing code, no active changes expected)
