# Client Error Attribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attribute client-captured errors to the signed-in user by sending a Firebase ID token the backend verifies — securely, fail-open, never trusting client-asserted identity.

**Architecture:** A client module caches the freshest Firebase ID token (via `onIdTokenChanged`); the error reporter attaches it to the outgoing request body at send time (works with `sendBeacon`). The backend verifies the token with the Admin SDK and derives `uid`/`tenantId` only from the verified claims; any failure degrades to anonymous.

**Tech Stack:** Next.js 16 / React 19 / Firebase client SDK (web, Vitest); Firebase Cloud Functions V2 / Express / Firebase Admin SDK (functions, Jest).

## Global Constraints

- Commit messages: imperative, lowercase, no period. No `Co-Authored-By`, no `--author`, no `--no-verify`. One logical commit per task. Never `git push`.
- **Verify, never trust:** `uid`/`tenantId` derive ONLY from `auth.verifyIdToken` decoded claims (or the already-middleware-validated `req.user`). No client-asserted identity field is ever trusted.
- **Token is a transit-only secret:** never log it (or any fragment), never persist it, never pass it to `captureError`. Only derived `uid`/`tenantId` are stored.
- **Fail-open:** absent/expired/malformed/invalid token → anonymous capture. Never 401, never throw, never block the error from being recorded.
- `verifyReportIdentity` and the token cache never throw.
- `checkRevoked` is NOT enabled (telemetry; documented tradeoff).
- TypeScript strict — no `any` without a justification comment. kebab-case files, camelCase fns.
- Web client code imports Firebase only via `@/lib/firebase` (`auth`).

---

### Task 1: Client identity-token cache

**Files:**
- Create: `apps/web/src/lib/observability/identity-token-cache.ts`
- Test: `apps/web/src/lib/observability/__tests__/identity-token-cache.test.ts`

**Interfaces:**
- Consumes: `auth` from `@/lib/firebase`; `onIdTokenChanged` from `firebase/auth`.
- Produces:
  - `getCachedIdToken(): string | null`
  - `installIdentityTokenCache(): () => void` — subscribes to `onIdTokenChanged`, caches the freshest token, returns an unsubscribe that also clears the cache. SSR-guarded.
  - `__setCachedIdTokenForTest(token: string | null): void` — test-only setter (justified: lets the reporter test inject a token without standing up Firebase auth).

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/observability/__tests__/identity-token-cache.test.ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { onIdTokenChanged } = vi.hoisted(() => ({ onIdTokenChanged: vi.fn() }));
vi.mock("@/lib/firebase", () => ({ auth: {} }));
vi.mock("firebase/auth", () => ({ onIdTokenChanged }));

import {
  getCachedIdToken,
  installIdentityTokenCache,
  __setCachedIdTokenForTest,
} from "../identity-token-cache";

beforeEach(() => {
  onIdTokenChanged.mockReset();
  __setCachedIdTokenForTest(null);
});
afterEach(() => {
  __setCachedIdTokenForTest(null);
});

describe("identity-token-cache", () => {
  it("caches the token when a user is present", async () => {
    let cb: (u: unknown) => void = () => {};
    onIdTokenChanged.mockImplementation((_auth, fn) => {
      cb = fn;
      return () => {};
    });
    installIdentityTokenCache();
    await cb({ getIdToken: () => Promise.resolve("tok-123") });
    // allow the resolved getIdToken().then to run
    await Promise.resolve();
    expect(getCachedIdToken()).toBe("tok-123");
  });

  it("clears the cache when the user signs out (null)", async () => {
    __setCachedIdTokenForTest("stale");
    let cb: (u: unknown) => void = () => {};
    onIdTokenChanged.mockImplementation((_auth, fn) => {
      cb = fn;
      return () => {};
    });
    installIdentityTokenCache();
    await cb(null);
    expect(getCachedIdToken()).toBeNull();
  });

  it("unsubscribe clears the cache and detaches", async () => {
    const unsub = vi.fn();
    onIdTokenChanged.mockReturnValue(unsub);
    __setCachedIdTokenForTest("tok");
    const teardown = installIdentityTokenCache();
    teardown();
    expect(unsub).toHaveBeenCalled();
    expect(getCachedIdToken()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/observability/__tests__/identity-token-cache.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/lib/observability/identity-token-cache.ts
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

let cachedToken: string | null = null;
let installed = false;

export function getCachedIdToken(): string | null {
  return cachedToken;
}

/**
 * Subscribe to Firebase ID-token changes (login, ~hourly auto-refresh, logout)
 * and keep the freshest token cached for synchronous read by the error reporter.
 * Returns a teardown that unsubscribes and clears the cache. SSR-safe.
 */
export function installIdentityTokenCache(): () => void {
  if (installed || typeof window === "undefined") return () => undefined;
  installed = true;

  const unsubscribe = onIdTokenChanged(auth, (user) => {
    if (!user) {
      cachedToken = null;
      return;
    }
    user
      .getIdToken()
      .then((token) => {
        cachedToken = token;
      })
      .catch(() => {
        // keep the prior token; never throw from the cache
      });
  });

  return () => {
    unsubscribe();
    cachedToken = null;
    installed = false;
  };
}

// test-only: inject a cache value without Firebase auth (justified for unit tests)
export function __setCachedIdTokenForTest(token: string | null): void {
  cachedToken = token;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/observability/__tests__/identity-token-cache.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint**

Run: `cd apps/web && npx eslint src/lib/observability/identity-token-cache.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/observability/identity-token-cache.ts apps/web/src/lib/observability/__tests__/identity-token-cache.test.ts
git commit -m "feat(observability): cache freshest firebase id token for reporting"
```

---

### Task 2: Reporter attaches token at send; installer wires the cache

**Files:**
- Modify: `apps/web/src/lib/observability/client-error-reporter.ts`
- Test: `apps/web/src/lib/observability/__tests__/client-error-reporter.token.test.ts`

**Interfaces:**
- Consumes: `getCachedIdToken`, `installIdentityTokenCache` (Task 1).
- Produces: `send` posts `{ ...payload, idToken }` (idToken added ONLY to the outgoing body, never to the buffered payload / dedupe key); `installClientErrorReporter` also installs the token cache and composes its teardown into the returned uninstall.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/observability/__tests__/client-error-reporter.token.test.ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/firebase", () => ({ auth: {} }));
vi.mock("firebase/auth", () => ({ onIdTokenChanged: vi.fn(() => () => {}) }));

import { reportClientError } from "../client-error-reporter";
import { __setCachedIdTokenForTest } from "../identity-token-cache";

let postedBodies: string[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  postedBodies = [];
  __setCachedIdTokenForTest(null);
  // Force the fetch path (no sendBeacon) so we can read the JSON body.
  vi.stubGlobal("navigator", {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body?: string }) => {
      if (init?.body) postedBodies.push(init.body);
      return { ok: true } as Response;
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  __setCachedIdTokenForTest(null);
});

// The reporter buffers and flushes after a 2s debounce; advance fake timers to flush.
function flushReports() {
  vi.advanceTimersByTime(2100);
}

describe("reporter token attachment", () => {
  it("includes idToken from the cache in the posted body", () => {
    __setCachedIdTokenForTest("tok-xyz");
    reportClientError(new Error("boom"), { route: "/products/new" });
    flushReports();
    expect(postedBodies.length).toBe(1);
    const body = JSON.parse(postedBodies[0]);
    expect(body.idToken).toBe("tok-xyz");
    expect(body.message).toBe("boom");
  });

  it("omits idToken when no user token is cached", () => {
    reportClientError(new Error("boom2"), { route: "/x" });
    flushReports();
    expect(postedBodies.length).toBe(1);
    const body = JSON.parse(postedBodies[0]);
    expect(body.idToken).toBeUndefined();
  });
});
```

> Note: the reporter dedupes by `errorType|message|route|status`. The two tests use different messages/routes so they never collide. If the implementer finds the reporter exposes no 2s debounce path (e.g. it changed), trigger the flush by the buffer-max path instead — but keep the assertions (body contains / omits `idToken`) identical.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/observability/__tests__/client-error-reporter.token.test.ts`
Expected: FAIL — body has no `idToken`.

- [ ] **Step 3: Implement**

In `apps/web/src/lib/observability/client-error-reporter.ts`:

1. Add imports at the top:

```typescript
import { getCachedIdToken, installIdentityTokenCache } from "./identity-token-cache";
```

2. Change `send` to attach the token to the OUTGOING body only (do not mutate `payload`):

```typescript
function send(payload: Payload): void {
  try {
    const idToken = getCachedIdToken();
    const body = JSON.stringify(idToken ? { ...payload, idToken } : payload);
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(ENDPOINT, blob);
      return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // best-effort
  }
}
```

3. In `installClientErrorReporter`, install the token cache and compose teardown. After the line `installed = true;`, add:

```typescript
  const uninstallTokenCache = installIdentityTokenCache();
```

Then in the returned teardown closure, before `installed = false;`, add:

```typescript
    uninstallTokenCache();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/observability/__tests__/client-error-reporter.token.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Regression — existing reporter tests still pass + lint**

Run: `cd apps/web && npx vitest run src/lib/observability/__tests__/client-error-reporter.test.ts && npx eslint src/lib/observability/client-error-reporter.ts`
Expected: existing tests PASS; lint clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/observability/client-error-reporter.ts apps/web/src/lib/observability/__tests__/client-error-reporter.token.test.ts
git commit -m "feat(observability): attach verified id token to client error reports"
```

---

### Task 3: Backend identity verifier

**Files:**
- Create: `apps/functions/src/lib/observability/verify-report-identity.ts`
- Test: `apps/functions/src/lib/observability/__tests__/verify-report-identity.test.ts`

**Interfaces:**
- Consumes: `auth` from `../../init`.
- Produces: `verifyReportIdentity(idToken: unknown): Promise<{ uid: string; tenantId: string | null } | null>` — never throws; null on any non-string/invalid/failed verification; never logs the token.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/functions/src/lib/observability/__tests__/verify-report-identity.test.ts
process.env.NODE_ENV = "test";

const verifyIdToken = jest.fn();
jest.mock("../../init", () => ({ auth: { verifyIdToken: (...a: unknown[]) => verifyIdToken(...a) } }));

import { verifyReportIdentity } from "../verify-report-identity";

beforeEach(() => verifyIdToken.mockReset());

it("returns uid + tenantId from verified claims", async () => {
  verifyIdToken.mockResolvedValue({ uid: "u1", tenantId: "t1" });
  await expect(verifyReportIdentity("good-token")).resolves.toEqual({ uid: "u1", tenantId: "t1" });
  expect(verifyIdToken).toHaveBeenCalledWith("good-token");
});

it("tenantId is null when the claim is absent", async () => {
  verifyIdToken.mockResolvedValue({ uid: "u2" });
  await expect(verifyReportIdentity("good-token")).resolves.toEqual({ uid: "u2", tenantId: null });
});

it("returns null for non-string input without calling verify", async () => {
  await expect(verifyReportIdentity(undefined)).resolves.toBeNull();
  await expect(verifyReportIdentity(123)).resolves.toBeNull();
  await expect(verifyReportIdentity("")).resolves.toBeNull();
  expect(verifyIdToken).not.toHaveBeenCalled();
});

it("returns null (never throws) when verification fails", async () => {
  verifyIdToken.mockRejectedValue(new Error("token expired"));
  await expect(verifyReportIdentity("bad-token")).resolves.toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/functions && npx jest --config jest.config.js src/lib/observability/__tests__/verify-report-identity.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/functions/src/lib/observability/verify-report-identity.ts
import { auth } from "../../init";

/**
 * Verify a Firebase ID token sent in a client error report and derive the
 * reporter's identity from the cryptographically verified claims. Best-effort:
 * returns null for any non-string / invalid / unverifiable token. NEVER throws,
 * and NEVER logs the token (or any fragment of it).
 */
export async function verifyReportIdentity(
  idToken: unknown,
): Promise<{ uid: string; tenantId: string | null } | null> {
  if (typeof idToken !== "string" || idToken.length === 0) return null;
  try {
    const decoded = await auth.verifyIdToken(idToken);
    const tenantId = (decoded as { tenantId?: unknown }).tenantId;
    return { uid: decoded.uid, tenantId: typeof tenantId === "string" ? tenantId : null };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/functions && npx jest --config jest.config.js src/lib/observability/__tests__/verify-report-identity.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/functions/src/lib/observability/verify-report-identity.ts apps/functions/src/lib/observability/__tests__/verify-report-identity.test.ts
git commit -m "feat(observability): add server-side id token verifier for reports"
```

---

### Task 4: Controller derives identity from token fallback

**Files:**
- Modify: `apps/functions/src/api/controllers/observability.controller.ts`
- Test: `apps/functions/src/api/controllers/__tests__/observability.controller.test.ts`

**Interfaces:**
- Consumes: `verifyReportIdentity` (Task 3); existing `captureError`.
- Produces: `ingestClientError` resolves identity as: `req.user.uid` if present (no verify call), else `verifyReportIdentity(body.idToken)`, else anonymous. `idToken` is used only for verification — never passed to `captureError`, logged, or stored.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/functions/src/api/controllers/__tests__/observability.controller.test.ts
process.env.NODE_ENV = "test";

const captureError = jest.fn();
const verifyReportIdentity = jest.fn();
jest.mock("../../../lib/observability/error-logger", () => ({
  captureError: (...a: unknown[]) => captureError(...a),
}));
jest.mock("../../../lib/observability/verify-report-identity", () => ({
  verifyReportIdentity: (...a: unknown[]) => verifyReportIdentity(...a),
}));

import { Request, Response } from "express";
import { ingestClientError } from "../observability.controller";

function mockRes() {
  const res: Partial<Response> & { _status?: number; _json?: unknown } = {};
  res.status = ((c: number) => { res._status = c; return res as Response; }) as Response["status"];
  res.json = ((b: unknown) => { res._json = b; return res as Response; }) as Response["json"];
  return res as Response & { _status?: number; _json?: unknown };
}
function req(body: unknown, user?: unknown): Request {
  return { body, headers: { "user-agent": "jest" }, user } as unknown as Request;
}

beforeEach(() => {
  captureError.mockReset();
  verifyReportIdentity.mockReset();
});

it("uses req.user when present and does NOT verify a token", async () => {
  await ingestClientError(
    req({ message: "boom", idToken: "ignored" }, { uid: "u-mw", tenantId: "t-mw" }),
    mockRes(),
  );
  expect(verifyReportIdentity).not.toHaveBeenCalled();
  const [, ctx] = captureError.mock.calls[0];
  expect(ctx).toMatchObject({ uid: "u-mw", tenantId: "t-mw" });
});

it("falls back to verifying body.idToken when req.user is absent", async () => {
  verifyReportIdentity.mockResolvedValue({ uid: "u-tok", tenantId: "t-tok" });
  await ingestClientError(req({ message: "boom", idToken: "good" }), mockRes());
  expect(verifyReportIdentity).toHaveBeenCalledWith("good");
  const [, ctx] = captureError.mock.calls[0];
  expect(ctx).toMatchObject({ uid: "u-tok", tenantId: "t-tok" });
});

it("captures anonymously when token verification fails", async () => {
  verifyReportIdentity.mockResolvedValue(null);
  await ingestClientError(req({ message: "boom", idToken: "bad" }), mockRes());
  const [, ctx] = captureError.mock.calls[0];
  expect(ctx).toMatchObject({ uid: null, tenantId: null });
});

it("never passes idToken to captureError", async () => {
  verifyReportIdentity.mockResolvedValue({ uid: "u", tenantId: null });
  await ingestClientError(req({ message: "boom", idToken: "secret" }), mockRes());
  const [errArg, ctx] = captureError.mock.calls[0];
  expect(JSON.stringify({ errArg, ctx })).not.toContain("secret");
});

it("still 400s on missing message", async () => {
  const res = mockRes();
  await ingestClientError(req({ idToken: "x" }), res);
  expect(res._status).toBe(400);
  expect(captureError).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/functions && npx jest --config jest.config.js src/api/controllers/__tests__/observability.controller.test.ts`
Expected: FAIL — controller still reads only `req.user` (token fallback not wired).

- [ ] **Step 3: Implement**

In `apps/functions/src/api/controllers/observability.controller.ts`:

1. Add the import near the existing imports:

```typescript
import { verifyReportIdentity } from "../../lib/observability/verify-report-identity";
```

2. Inside `ingestClientError`, AFTER the `message` validation (the `if (!message) return 400` block) and BEFORE the `captureError(...)` call, resolve identity:

```typescript
    const reqUser = req.user as { uid?: string; tenantId?: string } | undefined;
    let uid: string | null = reqUser?.uid ?? null;
    let tenantId: string | null = reqUser?.tenantId ?? null;
    if (!uid) {
      const verified = await verifyReportIdentity((req.body as { idToken?: unknown })?.idToken);
      if (verified) {
        uid = verified.uid;
        tenantId = verified.tenantId;
      }
    }
```

3. Replace the `uid`/`tenantId` fields in the existing `captureError(...)` call with the resolved locals:

```typescript
    void captureError(err, {
      source: "web",
      route: str(body.route, 500),
      method: null,
      status,
      uid,
      tenantId,
      userAgent: str(req.headers["user-agent"], 500),
      handled: true,
    });
```

(Leave the rest of the function — `str` sanitation, `status`, the 202 response, the catch — unchanged. Do not add `idToken` to any log.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/functions && npx jest --config jest.config.js src/api/controllers/__tests__/observability.controller.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Build**

Run: `cd apps/functions && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add apps/functions/src/api/controllers/observability.controller.ts apps/functions/src/api/controllers/__tests__/observability.controller.test.ts
git commit -m "feat(observability): attribute client errors via verified token fallback"
```

---

### Task 5: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Web unit suite + type-check + lint**

Run: `cd apps/web && npx tsc --noEmit && npm run lint && cd ../.. && npm run test:web`
Expected: tsc 0, lint 0, all unit tests pass (incl. the two new web tests + existing reporter tests).

- [ ] **Step 2: Web build**

Run: `cd apps/web && npm run build`
Expected: production build succeeds.

- [ ] **Step 3: Functions build + lint + observability tests**

Run: `cd apps/functions && npm run build && npm run lint && npx jest --config jest.config.js src/lib/observability/__tests__/verify-report-identity.test.ts src/api/controllers/__tests__/observability.controller.test.ts`
Expected: build OK; lint 0 errors; both new test files pass.

- [ ] **Step 4: Manual smoke (optional, requires emulators + signed-in session)**

- Sign in, open any page, browser console: `setTimeout(() => { throw new Error("evlog attrib " + Date.now()); })`.
- Open `/admin/observability` → the new issue's occurrence shows the signed-in user's name/email and `Usuários afetados: 1` (after identity resolution), not "anônimo".
- Sign out, repeat → the issue is anonymous (fail-open works).

- [ ] **Step 5: No commit** — verification only.

---

## Self-Review Notes

- **Spec coverage:** A token cache → Task 1; B reporter attaches token → Task 2; C verifier → Task 3; D controller wiring → Task 4. Security properties (verify-only identity, no token logging/storage, fail-open, never-throw) enforced in Tasks 3-4 and asserted by their tests. Final gate → Task 5.
- **Type consistency:** `verifyReportIdentity(idToken: unknown) → {uid, tenantId: string|null}|null` used identically in Tasks 3 and 4. `getCachedIdToken(): string|null` / `installIdentityTokenCache()` consistent across Tasks 1-2. `__setCachedIdTokenForTest` used in Tasks 1-2 tests.
- **Test-only export:** `__setCachedIdTokenForTest` is justified (unit injection without Firebase auth); it only mutates the in-memory cache and is harmless in production.
- **No double-attribution risk:** when `req.user` is present the controller skips verification entirely; when absent it verifies once.
