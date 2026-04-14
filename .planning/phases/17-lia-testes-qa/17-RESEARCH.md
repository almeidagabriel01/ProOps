# Phase 17: Lia Testes & QA — Research

**Phase:** 17 — Lia Testes & QA
**Goal:** A dedicated E2E suite covering all 12 AI scenarios runs automatically in CI on every PR.
**Requirements:** AIQA-01, AIQA-02, AIQA-03, AIQA-04, AIQA-05, AIQA-06
**Researched:** 2026-04-14

---

## 1. Existing E2E Test Suite Architecture

### Directory structure
```
e2e/
├── ai/                          ← NEW (Phase 17 adds this)
│   ├── access-control.spec.ts   ← AI-01, AI-02, AI-03
│   ├── tool-execution.spec.ts   ← AI-04, AI-05, AI-07
│   ├── plan-limits.spec.ts      ← AI-06, AI-08
│   └── isolation.spec.ts        ← AI-10, AI-11, AI-12
├── auth/
├── billing/                     ← plan-limits.spec.ts is the primary pattern reference
├── contacts/
├── financial/
├── fixtures/
│   ├── auth.fixture.ts          ← provides authenticatedPage (tenant-alpha admin)
│   └── base.fixture.ts          ← page objects + Firebase emulator route proxying
├── helpers/
│   ├── admin-firestore.ts       ← getTestDb() for Admin SDK access in tests
│   └── firebase-auth-api.ts     ← signInWithEmailPassword() for pure API tests
├── pages/                       ← page object model
│   ├── lia.page.ts              ← NEW (Phase 17 adds this)
│   └── ... (login, dashboard, etc.)
├── seed/
│   ├── data/
│   │   ├── ai.ts                ← NEW (Phase 17 adds this)
│   │   ├── tenants.ts           ← TENANT_ALPHA, TENANT_BETA
│   │   ├── users.ts             ← USER_ADMIN_ALPHA, USER_ADMIN_BETA, USER_MEMBER_*
│   │   └── billing.ts           ← seedBillingState(), restoreTenantState()
│   ├── seed-factory.ts          ← orchestrates all seed data in order
│   └── run-seed.ts
├── global-setup.ts              ← build → emulators → clearAll → seedAll
└── global-teardown.ts
```

### Playwright config
- **Config:** `playwright.config.ts` (root)
- **testDir:** `./e2e`, **testMatch:** `**/*.spec.ts`
- **baseURL:** `http://localhost:3001` (port 3001, avoids conflict with dev server on 3000)
- **workers:** 1 (serial execution — Firebase emulator is shared state)
- **timeout:** 90000ms per test, **expect timeout:** 10000ms
- **globalSetup:** `./e2e/global-setup.ts`
- **Retries:** 2 in CI, 0 locally
- **webServer:** starts Next.js via `npm run dev:test` on port 3001

### Firebase emulator environment
```
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
FUNCTIONS_LOCAL_API_URL=http://127.0.0.1:5001/demo-proops-test/southamerica-east1/api
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-proops-test
```

### Global setup sequence
1. Build Cloud Functions (`cd functions && npm run build`)
2. Spawn Firebase emulators (auth, firestore, storage, functions)
3. Poll `/api/v1/proposals` until 401 (auth working = emulator ready)
4. `clearAll()` — deletes tenants, users, wallets, sistemas, clients, products, proposals, transactions
5. `seedAll()` — seeds all domains in dependency order

---

## 2. Seed Data Pattern

### Existing seed data files
- `e2e/seed/data/tenants.ts` — exports `TENANT_ALPHA` (automacao_residencial), `TENANT_BETA` (cortinas)
- `e2e/seed/data/users.ts` — exports `USER_ADMIN_ALPHA`, `USER_ADMIN_BETA`, `USER_MEMBER_*`

### SeedTenant interface
```typescript
interface SeedTenant {
  id: string;
  tenantId: string;
  name: string;
  niche: "automacao_residencial" | "cortinas";
  primaryColor: string;
  createdAt: string;
}
```

### SeedUser interface
```typescript
interface SeedUser {
  uid: string;
  email: string;
  password: string;
  name: string;
  tenantId: string;
  role: "admin" | "member";
  masterId: string;
}
```

### Phase 17 seed requirements
Phase 17 must add `e2e/seed/data/ai.ts` with:

```typescript
// Tenant: pro plan, all modules active, automacao_residencial niche
export const TENANT_AI_TEST: SeedTenant = {
  id: "ai-test",
  tenantId: "ai-test",
  name: "AI Test Corp",
  niche: "automacao_residencial",
  primaryColor: "#7C3AED",
  createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
};

// Admin user: full AI access (admin role + pro plan)
export const USER_AI_ADMIN: SeedUser = {
  uid: "ai-admin-uid",
  email: "ai-admin@test.com",
  password: "TestPass123!",
  name: "AI Admin",
  tenantId: "ai-test",
  role: "admin",
  masterId: "ai-admin-uid",
};

// Member user: restricted tool access
export const USER_AI_MEMBER: SeedUser = {
  uid: "ai-member-uid",
  email: "ai-member@test.com",
  password: "TestPass123!",
  name: "AI Member",
  tenantId: "ai-test",
  role: "member",
  masterId: "ai-admin-uid",
};
```

**Critical additions to seed-factory.ts:**
1. Call `seedAiTenant()` after `seedTenants()`
2. Add AI collections to `clearAll()`: `aiConversations`, `aiUsage`

**Tenant Firestore document** for ai-test must include:
- `planId: "pro"` (enables 400 msg/month limit)
- `subscriptionStatus: "active"` (required by AIBI-02 guard added in Phase 16)
- `liaEnabled: true` (or whichever flag enables the Lia module)
- All module flags enabled: `whatsappEnabled`, etc.
- `stripeSubscriptionId` can be omitted in test env (subscription guard reads planId)

**User document** for AI_ADMIN must include:
- `planId: "pro"` (sets AI_LIMITS.pro = 400 messages)

---

## 3. AI Plan Limits (Source of Truth)

From `functions/src/ai/ai.types.ts`:

```typescript
const AI_LIMITS = {
  free:       { model: "none",                             messagesPerMonth: 0,    persistHistory: false },
  starter:    { model: "gemini-2.0-flash",                messagesPerMonth: 80,   persistHistory: false },
  pro:        { model: "gemini-2.5-flash-preview-05-14",  messagesPerMonth: 400,  persistHistory: true  },
  enterprise: { model: "gemini-2.5-flash-preview-05-14",  messagesPerMonth: 2000, persistHistory: true  },
};
```

**Limits to verify in tests:**
- Starter badge: 80 messages/month
- Pro badge: 400 messages/month

**Note:** Free tier = 0 messages → trigger button hidden entirely (no limit badge shown).

---

## 4. AI Backend Error Codes

From `functions/src/ai/chat.route.ts` and `functions/src/ai/usage-tracker.ts`:

| Scenario | HTTP Status | Code | Fields |
|----------|-------------|------|--------|
| Free tier | 403 | `AI_FREE_TIER_BLOCKED` | message |
| Inactive subscription (Phase 16) | 403 | `AI_SUBSCRIPTION_INACTIVE` | message |
| Message limit exceeded | 429 | `AI_LIMIT_EXCEEDED` | messagesUsed, messagesLimit, resetAt |

**Limit check logic:** `allowed = messagesUsed < config.messagesPerMonth` (strict `<`, not `<=`).

---

## 5. Firestore Collections for AI

### aiUsage
```
tenants/{tenantId}/aiUsage/{YYYY-MM}
{
  tenantId: string,
  month: string,           // "2026-04"
  messagesUsed: number,    // FieldValue.increment(1) per message
  totalTokensUsed: number, // FieldValue.increment(tokens)
  lastUpdatedAt: Timestamp
}
```

### aiConversations
```
tenants/{tenantId}/aiConversations/{sessionId}
{
  sessionId: string,
  uid: string,
  tenantId: string,
  messages: array,         // capped at 20 (10 exchanges)
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**For test helpers:** Tests can seed aiUsage via `getTestDb()` to pre-set messagesUsed to 79 (1 below starter limit) or 80 (at starter limit) to test limit scenarios without making real AI calls.

---

## 6. Lia Frontend Components & Selectors

From `src/components/lia/`:

| Component | Key Selectors |
|-----------|--------------|
| `lia-trigger-button.tsx` | `aria-label="Abrir Lia"` / `aria-label="Fechar Lia"` |
| `lia-panel.tsx` | `aria-label="Assistente Lia"` |
| `lia-usage-badge.tsx` | `aria-label="{N} de {M} mensagens usadas"` |
| `lia-input-bar.tsx` | `aria-label="Mensagem para Lia"` (textarea); `aria-label="Enviar mensagem"` (button); `placeholder="Limite de mensagens atingido."` when at limit |
| `lia-container.tsx` | `aria-label="Fechar aviso de limite"` (near-limit banner close button) |

**Key UI states to test:**
- **Free tenant:** Trigger button NOT in DOM (hidden, not just disabled)
- **Starter/Pro:** Badge shows `{messagesUsed} de {messagesLimit} mensagens usadas`
- **At limit (AI-08):** Input textarea disabled, placeholder = "Limite de mensagens atingido."
- **Near limit (AI-05/AIBI-05):** Amber warning banner visible

---

## 7. Critical Testing Strategy: GEMINI_API_KEY Limitation

**The key constraint:** The Functions emulator requires a real `GEMINI_API_KEY` to forward requests to Gemini. Without it, the chat endpoint returns 500.

**Recommended approach per scenario type:**

### Group A — No AI call needed (seed state + UI/API assertion only)
These scenarios can be tested purely by seeding Firestore state and checking UI or API responses:
- **AI-01:** Free tenant → trigger button hidden (check DOM)
- **AI-02:** Starter tenant → badge shows "80" (check badge text)
- **AI-03:** Pro tenant → badge shows "400" (check badge text)
- **AI-06:** At-limit messaging → disabled input with correct placeholder
- **AI-08:** At message limit → disabled input, check reset date displayed
- **AI-10:** Cross-tenant isolation → API call as wrong tenant returns 403/404
- **AI-11:** Member role → certain tool calls return 403

### Group B — Needs AI response mock or real API key
- **AI-04:** Tool execution creates real data (contact/proposal created)
- **AI-05:** Inactive module → Lia refuses in UI
- **AI-07:** Plan limits surface correct messaging (UI after message attempt)
- **AI-12:** Delete confirmation dialog (needs tool_call chunk in SSE response)

**Recommended solution for Group B:**
Add `GEMINI_API_KEY` as a GitHub Actions secret (CI secret, not committed). Tests that require an actual AI response will only pass in CI where the key is available. For local runs without the key, these tests can be skipped via `test.skip(process.env.GEMINI_API_KEY === undefined, 'Requires GEMINI_API_KEY')`.

**Alternative for AI-12 specifically:** Intercept the SSE stream in Playwright (`page.route`) to inject a mock `tool_call` chunk, avoiding the need for a real Gemini call.

---

## 8. Plan-Limits Test Pattern (Reference Implementation)

From `e2e/billing/plan-limits.spec.ts` (the primary pattern to follow):

```typescript
// Pure API test pattern (no browser page needed for access control tests)
import { test, expect } from "@playwright/test";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { getTestDb } from "../helpers/admin-firestore";
import { seedAiState, restoreAiState } from "../seed/data/ai";

const FUNCTIONS_BASE = "http://127.0.0.1:5001/demo-proops-test/southamerica-east1/api";

test.describe.configure({ mode: "serial" });

test.describe("AI-01: Free tier blocked", () => {
  test("free tenant gets 403 AI_FREE_TIER_BLOCKED", async () => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_FREE.email, USER_ADMIN_FREE.password
    );
    const response = await fetch(`${FUNCTIONS_BASE}/v1/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ message: "Hello", sessionId: "test-session" }),
    });
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("AI_FREE_TIER_BLOCKED");
  });
});
```

**beforeEach/afterEach pattern for seeding aiUsage:**
```typescript
test.beforeEach(async () => {
  const db = getTestDb();
  const month = new Date().toISOString().slice(0, 7); // "2026-04"
  await db.doc(`tenants/ai-test/aiUsage/${month}`).set({
    tenantId: "ai-test",
    month,
    messagesUsed: 400, // pro limit — test at-limit state
    totalTokensUsed: 0,
    lastUpdatedAt: new Date(),
  });
});

test.afterEach(async () => {
  const db = getTestDb();
  const month = new Date().toISOString().slice(0, 7);
  await db.doc(`tenants/ai-test/aiUsage/${month}`).delete();
});
```

---

## 9. CI Integration

### Existing CI job: `e2e-push`
The E2E suite already runs on every push via `.github/workflows/push-checks.yml`. Phase 17 tests are simply new spec files under `e2e/ai/` — they are automatically picked up by `testMatch: "**/*.spec.ts"`.

**No new CI job needed** for the base requirement. The "Lia smoke test job runs on every CI PR" requirement (AIQA-05 success criterion) is satisfied by the existing `e2e-push` job picking up `e2e/ai/*.spec.ts`.

**GitHub secret needed:** `GEMINI_API_KEY` must be added to the repository's Actions secrets for Group B tests to run in CI.

**CI environment additions** (in `push-checks.yml` `e2e-push` job):
```yaml
env:
  GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

---

## 10. Scenario Mapping: Requirements → Test Scenarios

| Req | Success Criterion | Scenario IDs | Test Type |
|-----|------------------|--------------|-----------|
| AIQA-01 | AI-01 to AI-03: access control by plan | AI-01, AI-02, AI-03 | UI (DOM check) + API |
| AIQA-02 | AI-04 to AI-07: tool execution, inactive module, plan limits | AI-04, AI-05, AI-06, AI-07 | Mixed: API + UI |
| AIQA-03 | AI-08: at-limit disabled input with reset date | AI-08 | UI (seeded state) |
| AIQA-04 | AI-10 to AI-12: isolation, permissions, delete confirm | AI-10, AI-11, AI-12 | API + UI |
| AIQA-05 | Seed creates ai-test tenant; smoke test runs on every CI PR | Seed + CI config | Infrastructure |
| AIQA-06 | Regression: existing E2E suite still passes | All existing specs | CI gate |

**Note:** AI-09 is not listed in the success criteria — it is either not scoped for Phase 17 or was intentionally omitted. Plans should cover AI-01 through AI-08 and AI-10 through AI-12 (11 scenarios total).

---

## 11. Starter Tenant Requirement

The success criteria reference "Starter badge shows correct limit (80)" (AI-02). This requires a **Starter plan tenant** in addition to the Pro tenant. Options:

**Option A:** Add `TENANT_STARTER_TEST` + `USER_STARTER_ADMIN` to seed data (clean, preferred)
**Option B:** Reuse `TENANT_ALPHA` or `TENANT_BETA` — but these are used by existing tests, risking interference

**Recommendation:** Add a second seeded user for starter plan. The Starter tenant only needs to exist in Firestore with `planId: "starter"` — no Auth user needed for pure UI badge checks if the badge is rendered from Firestore data passed down via the tenant context.

Actually, for UI tests, a real login is needed. Create `USER_AI_STARTER` in the ai.ts seed file.

---

## Validation Architecture

### Test Coverage Matrix

| Scenario | Method | Assertion | Emulator Dependency |
|----------|--------|-----------|---------------------|
| AI-01: Free tier no button | UI + API | Trigger button absent from DOM; POST returns 403 AI_FREE_TIER_BLOCKED | Auth emulator only |
| AI-02: Starter badge 80 | UI | Badge text = "0 de 80 mensagens usadas" | Auth + Firestore |
| AI-03: Pro badge 400 | UI | Badge text = "0 de 400 mensagens usadas" | Auth + Firestore |
| AI-04: Tool execution | UI + API | POST /v1/ai/chat creates real data in Firestore | Functions + Gemini key |
| AI-05: Inactive module refuse | API | Tool call for inactive module returns error in SSE | Functions + Gemini key |
| AI-06: Plan limit messaging | UI | Input disabled + placeholder at limit; API returns 429 AI_LIMIT_EXCEEDED | Auth + Firestore |
| AI-07: Plan limits correct message | UI | 429 response body contains messagesUsed, messagesLimit, resetAt | Functions |
| AI-08: Disabled input + reset date | UI | Input disabled; reset date visible in UI | Auth + Firestore (seeded aiUsage) |
| AI-10: Cross-tenant isolation | API | Auth as ai-test admin; request for tenant-alpha data returns 403/404 | Functions |
| AI-11: Member role restrictions | API | Auth as ai-member; admin tool call returns 403 | Functions |
| AI-12: Delete confirm dialog | UI | Dialog appears; cancel → no delete | Functions + Gemini key |

### Validation commands
```bash
# Run AI E2E suite only (after emulators running)
npx playwright test e2e/ai/

# Run full suite (CI equivalent)
npm run test:e2e

# Run with headed browser (debug UI tests)
npx playwright test e2e/ai/ --headed

# Run single scenario
npx playwright test e2e/ai/access-control.spec.ts
```

---

## RESEARCH COMPLETE
