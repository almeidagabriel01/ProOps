# Testing Patterns

**Analysis Date:** 2026-05-04

## Test Framework

**Runner:**
- Frontend E2E: Playwright `@playwright/test` v1.59.1
- Backend Firestore Rules: Jest `v30.3.0` with `ts-jest`
- Config: `tests/jest.config.js`, `tests/playwright.config.ts`, `tests/playwright.perf.config.ts`

**Assertion Library:**
- Playwright: built-in `expect()` from `@playwright/test`
- Jest: built-in `expect()` matcher syntax
- Firestore Rules: `@firebase/rules-unit-testing` v5.0.0 with `assertSucceeds()` / `assertFails()`

**Run Commands:**
```bash
npm run test:e2e                 # Run all E2E tests (59 tests)
npm run test:e2e:ui             # Playwright UI mode (interactive)
npm run test:e2e:debug          # Playwright debug mode (step-through)
npm run test:rules              # Firestore security rules tests (41 tests)
npm run test:performance        # Performance benchmarks (Core Web Vitals)
npm run test:functions          # Backend unit tests (npm test in apps/functions/)
npm run test:security           # OWASP ZAP baseline security scan
```

## Test File Organization

**Location:**
- E2E tests: `tests/e2e/**/*.spec.ts`
- Firestore rules: `tests/firestore-rules/**/*.test.ts`
- Performance: `tests/playwright.perf.config.ts` references same test directory

**Naming:**
- Test files: `*.spec.ts` (E2E), `*.test.ts` (Jest/rules)
- Test suites: `describe("AI-01: Feature description", () => { ... })`
- Individual tests: `test("specific behavior", async () => { ... })`

**Structure:**
```
tests/
├── e2e/
│   ├── ai/                           # AI feature tests (access control, rate limiting)
│   ├── auth/                         # Authentication tests (login, session, multi-tenant)
│   ├── fixtures/                     # Custom test fixtures (Page Object Model)
│   ├── helpers/                      # Helper functions (Firebase auth, API calls)
│   ├── pages/                        # Page Object Model (LoginPage, ProposalPage, etc.)
│   ├── seed/                         # Test data and seeding
│   │   ├── data/                     # Test user credentials, tenant data
│   │   └── seed-factory.ts           # seedAll(), clearAll() functions
│   ├── global-setup.ts               # Start emulators, build functions, seed data
│   ├── global-teardown.ts            # Stop emulators, cleanup
│   └── [...more domains...]
├── firestore-rules/
│   └── firestore.rules.test.ts       # Multi-section: SEC-*, TBL-*, etc.
├── jest.config.js                    # Jest config (ts-jest preset)
├── playwright.config.ts              # E2E Playwright config
├── playwright.perf.config.ts         # Performance Playwright config
└── tsconfig.rules.json               # TypeScript config for rules tests
```

## Test Structure

**E2E Test Suite Organization:**

```typescript
import { test, expect } from "@playwright/test";
import { test as uiTest } from "../fixtures/base.fixture";

test.describe.configure({ mode: "serial" });  // Force sequential execution

test.describe("AI-01: Free tier access blocked", () => {
  test("free tenant POST /v1/ai/chat returns 403 with AI_FREE_TIER_BLOCKED", async () => {
    // 1. Setup: authenticate user
    const { idToken } = await signInWithEmailPassword(USER.email, USER.password);
    
    // 2. Act: make API request
    const response = await fetch(`${FUNCTIONS_BASE}/v1/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ message: "Hello", sessionId: "test-session" }),
    });
    
    // 3. Assert: check response
    expect(response.status).toBe(403);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.code).toBe("AI_FREE_TIER_BLOCKED");
  });
});

uiTest.describe("AI-01: Free tier trigger button hidden", () => {
  uiTest("user with role=free does not see Lia trigger button", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER.email, USER.password);
    
    // Wait for auth and plan limits to resolve
    await page.waitForTimeout(2000);
    
    // Assert button is not visible
    await expect(page.getByRole("button", { name: "Abrir Lia" })).not.toBeVisible();
  });
});
```

**Firestore Rules Test Suite Organization:**

```typescript
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-proops-test",
    firestore: {
      rules: readFileSync("../../firebase/firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();  // Clean between tests
});

// Helper to create authenticated context
function alphaDb() {
  return testEnv.authenticatedContext("uid-alpha", {
    tenantId: "tenant-alpha",
    role: "admin",
    masterId: "uid-alpha",
  }).firestore();
}

// Helper to seed data
async function seedDoc(collectionPath: string, docId: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), collectionPath, docId), data);
  });
}

test.describe("SEC-03: Unauthenticated access is denied", () => {
  test("proposals: unauthenticated read is denied", async () => {
    await seedDoc("proposals", "doc-001", { tenantId: "tenant-alpha" });
    await assertFails(getDoc(doc(unauthDb(), "proposals", "doc-001")));
  });

  test("proposals: authenticated read succeeds for same tenant", async () => {
    await seedDoc("proposals", "doc-001", { tenantId: "tenant-alpha" });
    await assertSucceeds(getDoc(doc(alphaDb(), "proposals", "doc-001")));
  });
});
```

## Mocking

**Framework:**
- Frontend: Jest mock functions (if unit tests exist) — not found in current codebase
- Backend: Firebase Admin SDK is never mocked — uses real emulator
- External services: mocked at request level or via environment variables

**Patterns:**

**Firebase Emulator Mocking:**
E2E tests use real Firebase emulators (no mocks):
```typescript
// In playwright.config.ts
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
```

Emulators started in `global-setup.ts`:
```typescript
const emulatorProcess = spawn("firebase", ["emulators:start", "--project", "demo-proops-test"]);
// waits for Firestore, Auth, Functions emulators to be ready
```

**Stripe Webhook Mocking:**
- E2E tests use fake Stripe webhook secrets and events
- `STRIPE_SECRET_KEY = "sk_test_fake_for_testing"` in test env
- Webhook payloads manually constructed and sent to test endpoint

**AI Provider Mocking:**
```typescript
// In global-setup.ts
process.env.AI_PROVIDER = "mock";  // Never call real Gemini/Groq in E2E
```

**What to Mock:**
- External rate limiters: not mocked, real rate limit checks run in tests
- Firestore Admin SDK: never mocked — use emulator
- Firebase Auth: never mocked — use emulator
- Stripe API: real API calls NOT made; webhook events mocked or skipped in E2E
- AI providers: always mocked in tests (Gemini/Groq calls are expensive)

**What NOT to Mock:**
- Firestore security rules: tested against real rules with emulator
- Authentication flow: tested end-to-end with real Firebase Auth
- Multi-tenant isolation: tested with real Firestore queries and tenant IDs
- Plan limit enforcement: tested with real limit checks

## Fixtures and Factories

**Test Data:**
Location: `tests/e2e/seed/data/`

```typescript
// Example: ai.ts
export const USER_AI_FREE = {
  email: "ai-free@test.local",
  password: "Test@12345",
};

export const USER_AI_STARTER = {
  email: "ai-starter@test.local",
  password: "Test@12345",
};
```

Used across all E2E tests for consistent test users. Credentials are created during `global-setup.ts` via `seedAll()`.

**Seed Factory:**
Location: `tests/e2e/seed/seed-factory.ts`

```typescript
export async function seedAll(): Promise<void> {
  // Creates all test tenants and users
  // Called from global-setup.ts ONCE before all tests
}

export async function clearAll(): Promise<void> {
  // Clears Firestore between test runs (called in global-teardown.ts)
}
```

The seed factory ensures:
- Consistent test data across all tests
- Fresh state for each test suite run
- Test users have predictable IDs and custom claims

**Page Object Model:**
Location: `tests/e2e/pages/`

```typescript
export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/login");
    await this.page.waitForLoadState("networkidle");
  }

  async login(email: string, password: string) {
    await this.page.fill("[name='email']", email);
    await this.page.fill("[name='password']", password);
    await this.page.click("button[type='submit']");
    await this.page.waitForNavigation();
  }
}

export class ProposalPage {
  constructor(private page: Page) {}

  async createProposal(data: ProposalData) {
    // ... steps to create a proposal
  }
}
```

Fixture: `tests/e2e/fixtures/base.fixture.ts`
```typescript
export const test = base.extend({
  // Custom fixtures wired here
  // Example: page with emulator routes pre-configured
});
```

## Coverage

**Requirements:**
- No explicit coverage requirement enforced
- E2E tests aim for >80% path coverage of critical flows
- Firestore rules tested exhaustively (all allow/deny branches)
- Controllers tested indirectly via E2E (not unit tested separately)

**View Coverage:**
```bash
# E2E coverage (generated by Playwright HTML reporter)
npm run test:e2e
# Output: playwright-report/index.html
```

**Coverage Gaps:**
- Backend unit tests: not currently present (all testing is E2E with emulator)
- Component unit tests: not present (Playwright tests UI end-to-end)
- Error edge cases: covered by E2E, not isolated unit tests

## Test Types

**Unit Tests:**
- Scope: Firestore security rules
- Approach: isolated rule evaluation with `@firebase/rules-unit-testing`
- Coverage: all collections and permission scenarios (41 tests)
- Location: `tests/firestore-rules/firestore.rules.test.ts`

**Integration Tests:**
- Scope: API endpoints + Firestore + Auth emulator
- Approach: Playwright requests to real backend (emulated), asserts on response + Firestore state
- Coverage: workflow-level scenarios (propose → approve → pay)
- Examples: "create proposal, then sync transactions from approved status", "multi-tenant isolation"

**E2E Tests:**
- Scope: Full application flow (UI → API → Firestore)
- Approach: Playwright browser automation against real Next.js dev server
- Coverage: feature flags, access control, billing gates, UI interactions
- Organized by concern: `ai/`, `auth/`, `crm/`, `proposals/`, `transactions/`, etc.
- Test count: 59 tests (see `tests/e2e/` subdirectories)

**Performance Tests:**
- Scope: Core Web Vitals (LCP, CLS, FID)
- Approach: Lighthouse via Playwright + LHCI
- Baseline: stored in `test-results/lighthouse-baseline.json`
- Runs: `npm run test:performance` on CI and locally

**Security Tests:**
- Scope: OWASP Top 10 vulnerabilities
- Approach: ZAP (Zed Attack Proxy) baseline scan against running app
- Config: `tests/e2e/security/.zap-rules.tsv` (allows/denies specific findings)
- Runs: `npm run test:security` on CI after E2E passes

## Common Patterns

**Async Testing:**
```typescript
// E2E with Playwright
test("proposal can be created", async ({ page }) => {
  await page.goto("/proposals");
  await page.fill("[name='title']", "My Proposal");
  await page.click("button:text('Create')");
  await page.waitForSelector("[data-testid='success-message']");
  expect(successMessage).toBeVisible();
});

// Firestore rules with async
test("user can read own document", async () => {
  await seedDoc("users", "uid-1", { tenantId: "tenant-1", name: "User 1" });
  await assertSucceeds(
    getDoc(doc(authenticatedDb("uid-1", "tenant-1"), "users", "uid-1"))
  );
});
```

**Error Testing:**
```typescript
// E2E: verify error response
test("free tenant cannot use AI", async () => {
  const response = await fetch("/api/v1/ai/chat", {
    method: "POST",
    headers: { Authorization: `Bearer ${freeTenantToken}` },
    body: JSON.stringify({ message: "Hello" }),
  });
  expect(response.status).toBe(403);
  const body = await response.json();
  expect(body.code).toBe("AI_FREE_TIER_BLOCKED");
});

// Rules: verify read/write denied
test("other tenant cannot read document", async () => {
  await seedDoc("proposals", "prop-1", { tenantId: "tenant-alpha" });
  // betaDb is authenticated as tenant-beta
  await assertFails(getDoc(doc(betaDb(), "proposals", "prop-1")));
});
```

**Multi-Tenant Isolation Testing:**
```typescript
test("tenant isolation: beta cannot read alpha's data", async () => {
  // Create document in tenant-alpha
  await seedDoc("proposals", "prop-001", { tenantId: "tenant-alpha" });
  
  // Attempt read as tenant-beta
  const betaDb = testEnv.authenticatedContext("uid-beta", {
    tenantId: "tenant-beta",
    role: "admin",
  }).firestore();
  
  // Should be denied
  await assertFails(getDoc(doc(betaDb, "proposals", "prop-001")));
});
```

**Plan Limit Testing:**
```typescript
test("free plan cannot create more than 5 proposals", async () => {
  const response = await fetch("/api/v1/proposals", {
    method: "POST",
    headers: { Authorization: `Bearer ${freeTenantToken}` },
    body: JSON.stringify({ title: "Proposal 6" }),
  });
  expect(response.status).toBe(402);  // Payment required
  const body = await response.json();
  expect(body.code).toBe("PLAN_LIMIT_EXCEEDED_PROPOSALS");
});
```

**Rate Limiting Testing:**
```typescript
test("AI requests are rate-limited (5 per minute)", async () => {
  const userId = "uid-test";
  const token = await signIn(userId);
  
  // Make 5 successful requests
  for (let i = 0; i < 5; i++) {
    const resp = await fetch("/api/v1/ai/field-gen", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ field: "description" }),
    });
    expect(resp.status).toBe(200);
  }
  
  // 6th request should fail with rate limit
  const rateLimitResp = await fetch("/api/v1/ai/field-gen", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ field: "description" }),
  });
  expect(rateLimitResp.status).toBe(429);
  expect(rateLimitResp.headers.get("Retry-After")).toBeDefined();
});
```

**Transaction/Multi-Document Atomicity Testing:**
```typescript
test("creating transaction updates wallet balance atomically", async () => {
  // Setup: wallet with initial balance
  await seedDoc("wallets", "wallet-1", {
    tenantId: "tenant-1",
    balance: 100,
    name: "Main",
  });
  
  // Act: create transaction that decrements balance
  const response = await fetch("/api/v1/transactions", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      amount: 25,
      type: "expense",
      wallet: "wallet-1",
    }),
  });
  expect(response.status).toBe(201);
  
  // Assert: balance was updated
  const walletSnap = await db.collection("wallets").doc("wallet-1").get();
  expect(walletSnap.data().balance).toBe(75);
});
```

## Test Execution in CI

**Push checks (`push-checks.yml`):**
- `type-check`: TypeScript validation
- `lint`: ESLint checks
- `e2e-push`: All 59 E2E tests with emulator
- `firestore-rules-push`: All 41 rules tests
- `performance-push`: Core Web Vitals baseline
- `security-scan-push`: OWASP ZAP baseline
- `push-gate`: Consolidates all results

**Test suite (`test-suite.yml`):**
- Runs on PR to `main` or `develop`
- `all-checks-passed` is the final gate (requires: type-check, lint, e2e-push, firestore-rules-push)

**Local Pre-Push:**
```bash
# Run full suite locally (must pass before push)
npm run test:e2e && npm run test:rules && npm run test:performance

# Or run individually
npm run test:e2e            # 59 tests, ~8 minutes
npm run test:rules          # 41 tests, ~3 minutes
npm run test:performance    # ~5 minutes
```

## Debugging Failed Tests

**E2E Failures:**
1. Download `playwright-report-*` artifact from CI
2. Open in browser: `playwright-report-*/index.html`
3. Inspect failed test video and trace
4. Run locally with `npm run test:e2e:ui` to step through interactively

**Firestore Rules Failures:**
1. Run locally: `npm run test:rules`
2. Check Jest output for assertion error message
3. Verify rule in `firebase/firestore.rules` matches test expectation
4. Ensure `testEnv.clearFirestore()` is called in `afterEach()` for isolation

**Performance Failures:**
1. Check `test-results/lighthouse-baseline.json` for baseline metrics
2. Run `npm run test:performance` locally to compare
3. If metrics regressed: identify code change that caused it
4. Update baseline after fix: commit new `lighthouse-baseline.json`

**Security Scan Failures:**
1. Download `security-scan-report/` artifact from CI
2. Review findings: may be false positives allowed in `.zap-rules.tsv`
3. For legitimate issues: fix in code, re-run scan
4. For known false positives: add to `.zap-rules.tsv` allowlist with justification

---

*Testing analysis: 2026-05-04*
