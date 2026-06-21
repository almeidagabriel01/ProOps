# Total Error Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture every error everywhere — silently-caught client API failures, console.error of real Errors, all backend error responses (incl. non-throw), cron failures, Stripe webhook errors, and server-action errors — into the observability pipeline.

**Architecture:** Frontend: api-client auto-reports failures via the existing `reportClientError`; a `console.error` patch reports Error objects only; a server-side `reportServerError` covers server actions. Backend: an early-registered `res.on("finish")` middleware captures every `status >= 400` response that didn't already get captured by the global error handler; cron and webhook catch blocks call the existing `captureError`.

**Tech Stack:** Next.js 16 / React 19 / TypeScript (web, Vitest), Firebase Cloud Functions V2 / Express / Firebase Admin SDK (functions, Jest).

## Global Constraints

- Commit messages: imperative, lowercase, no period. No `Co-Authored-By`, no `--author`, no `--no-verify`. One logical commit per task. Never `git push`.
- Every new capture call is best-effort and MUST NOT break the host flow: `reportClientError`, `captureError`, and `reportServerError` never throw; original error always rethrown/returned unchanged.
- Anti-loop: never report failures of the observability pipeline itself. Client api-client skips paths starting with `/v1/observability`. Backend finish-middleware skips path prefixes `/v1/observability`, `/internal`, `/health`, `/api/health`. console.error patch uses a reentrancy guard.
- console.error patch reports ONLY when the first arg is an `Error` (or an object with a string `.stack`).
- Backend finish-middleware captures ALL responses with `status >= 400` (incl. 401/403/404/validation).
- Keep the existing 402 exclusion in api-client (402 = plan-limit signal, not an error).
- Never log tokens/passwords/CPF/full emails/phone numbers in any new code.
- TypeScript strict — no `any` without a justification comment. kebab-case files, camelCase fns.
- Billing-adjacent files (crons, stripe webhook): add capture inside existing catch blocks ONLY — do not touch business/idempotency logic.

---

### Task 1: Client payload carries status

**Files:**
- Modify: `apps/web/src/lib/observability/report-error.ts`
- Test: `apps/web/src/lib/observability/__tests__/report-error.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `buildClientErrorPayload(err, ctx?: { route?: string; status?: number })` → `{errorType,message,stack,route,status}` where `status = ctx.status ?? null`. `dedupeKey(payload)` returns `errorType|message|route|status`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/observability/__tests__/report-error.test.ts
import { describe, it, expect } from "vitest";
import { buildClientErrorPayload, dedupeKey } from "../report-error";

describe("buildClientErrorPayload", () => {
  it("captures status from ctx", () => {
    const p = buildClientErrorPayload(new Error("boom"), { route: "GET /x", status: 500 });
    expect(p.status).toBe(500);
    expect(p.route).toBe("GET /x");
    expect(p.errorType).toBe("Error");
    expect(p.message).toBe("boom");
  });
  it("defaults status to null", () => {
    const p = buildClientErrorPayload(new Error("boom"));
    expect(p.status).toBeNull();
  });
});

describe("dedupeKey", () => {
  it("includes status so same message at different status are distinct", () => {
    const base = { errorType: "ApiError", message: "fail", route: "POST /a" };
    expect(dedupeKey({ ...base, status: 500 } as never)).not.toBe(
      dedupeKey({ ...base, status: 404 } as never),
    );
    expect(dedupeKey({ ...base, status: 500 } as never)).toBe("ApiError|fail|POST /a|500");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/observability/__tests__/report-error.test.ts`
Expected: FAIL — `status` not on payload / `dedupeKey` lacks status.

- [ ] **Step 3: Write the implementation**

Replace `apps/web/src/lib/observability/report-error.ts` with:

```typescript
// apps/web/src/lib/observability/report-error.ts

const MESSAGE_MAX = 2000;
const STACK_MAX = 8000;

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

export function buildClientErrorPayload(
  err: unknown,
  ctx?: { route?: string; status?: number },
): { errorType: string; message: string; stack: string | null; route: string | null; status: number | null } {
  const isError = err instanceof Error;
  return {
    errorType: isError ? err.name || "Error" : "Error",
    message: truncate(isError ? err.message : String(err), MESSAGE_MAX),
    stack: isError && err.stack ? truncate(err.stack, STACK_MAX) : null,
    route: ctx?.route ?? null,
    status: ctx?.status ?? null,
  };
}

export function dedupeKey(payload: {
  errorType: string;
  message: string;
  route: string | null;
  status: number | null;
}): string {
  return `${payload.errorType}|${payload.message}|${payload.route ?? ""}|${payload.status ?? ""}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/observability/__tests__/report-error.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/observability/report-error.ts apps/web/src/lib/observability/__tests__/report-error.test.ts
git commit -m "feat(observability): carry http status in client error payload"
```

---

### Task 2: console.error patch + rich reportClientError ctx

**Files:**
- Modify: `apps/web/src/lib/observability/client-error-reporter.ts`
- Test: `apps/web/src/lib/observability/__tests__/client-error-reporter.test.ts`

**Interfaces:**
- Consumes: `buildClientErrorPayload`, `dedupeKey` (Task 1).
- Produces:
  - `reportClientError(err, ctx?: { route?: string; status?: number })` (status now forwarded).
  - `shouldReportConsoleArg(arg: unknown): boolean` (exported pure helper — true iff arg is an `Error` or an object with a string `.stack`).
  - `installClientErrorReporter()` additionally patches `console.error` (reports via `shouldReportConsoleArg`, reentrancy-guarded) and restores it on uninstall.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/observability/__tests__/client-error-reporter.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { shouldReportConsoleArg, installClientErrorReporter } from "../client-error-reporter";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("shouldReportConsoleArg", () => {
  it("true for Error", () => {
    expect(shouldReportConsoleArg(new Error("x"))).toBe(true);
  });
  it("true for object with string stack", () => {
    expect(shouldReportConsoleArg({ stack: "at foo" })).toBe(true);
  });
  it("false for plain string", () => {
    expect(shouldReportConsoleArg("Warning: each child needs a key")).toBe(false);
  });
  it("false for plain object", () => {
    expect(shouldReportConsoleArg({ a: 1 })).toBe(false);
  });
});

describe("console.error patch", () => {
  it("patches console.error on install and restores on uninstall", () => {
    const original = console.error;
    const uninstall = installClientErrorReporter();
    expect(console.error).not.toBe(original);
    // calling it with a string must still reach the original
    const spy = vi.spyOn({ original }, "original");
    console.error("hello"); // should not throw / loop
    uninstall();
    expect(console.error).toBe(original);
    spy.mockRestore();
  });

  it("calling patched console.error with an Error does not recurse or throw", () => {
    const uninstall = installClientErrorReporter();
    expect(() => console.error(new Error("loop?"))).not.toThrow();
    uninstall();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/observability/__tests__/client-error-reporter.test.ts`
Expected: FAIL — `shouldReportConsoleArg` not exported / console.error not patched.

- [ ] **Step 3: Write the implementation**

Edit `apps/web/src/lib/observability/client-error-reporter.ts`. Update `reportClientError` to forward `status`, add `shouldReportConsoleArg`, and patch `console.error` inside `installClientErrorReporter`. Full file:

```typescript
// apps/web/src/lib/observability/client-error-reporter.ts
import { buildClientErrorPayload, dedupeKey } from "./report-error";

const ENDPOINT = "/api/backend/v1/observability/client-error";
const FLUSH_DEBOUNCE_MS = 2000;
const MAX_BUFFER = 20;

type Payload = ReturnType<typeof buildClientErrorPayload>;

let installed = false;
let reentrant = false;
const buffer = new Map<string, Payload>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function send(payload: Payload): void {
  try {
    const body = JSON.stringify(payload);
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

function flush(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (buffer.size === 0) return;
  const items = Array.from(buffer.values());
  buffer.clear();
  items.forEach(send);
}

export function reportClientError(err: unknown, ctx?: { route?: string; status?: number }): void {
  if (typeof window === "undefined") return;
  try {
    const route =
      ctx?.route ?? (typeof window !== "undefined" ? window.location.pathname : null) ?? undefined;
    const payload = buildClientErrorPayload(err, { route, status: ctx?.status });
    const key = dedupeKey(payload);
    if (!buffer.has(key)) buffer.set(key, payload);
    if (buffer.size >= MAX_BUFFER) {
      flush();
      return;
    }
    if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_DEBOUNCE_MS);
  } catch {
    // never throw from the reporter
  }
}

/** Report a console.error arg only when it is a real Error (or carries a stack). */
export function shouldReportConsoleArg(arg: unknown): boolean {
  if (arg instanceof Error) return true;
  return (
    typeof arg === "object" &&
    arg !== null &&
    typeof (arg as { stack?: unknown }).stack === "string"
  );
}

export function installClientErrorReporter(): () => void {
  if (installed || typeof window === "undefined") return () => undefined;
  installed = true;

  const onError = (event: ErrorEvent) => reportClientError(event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) => reportClientError(event.reason);
  const onHide = () => flush();

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") flush();
  };

  const originalConsoleError = console.error;
  const patchedConsoleError = (...args: unknown[]): void => {
    originalConsoleError(...(args as []));
    if (reentrant) return;
    if (!shouldReportConsoleArg(args[0])) return;
    reentrant = true;
    try {
      reportClientError(args[0]);
    } finally {
      reentrant = false;
    }
  };
  console.error = patchedConsoleError as typeof console.error;

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  window.addEventListener("pagehide", onHide);
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (console.error === patchedConsoleError) {
      console.error = originalConsoleError;
    }
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    window.removeEventListener("pagehide", onHide);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    installed = false;
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/observability/__tests__/client-error-reporter.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint the changed file**

Run: `cd apps/web && npx eslint src/lib/observability/client-error-reporter.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/observability/client-error-reporter.ts apps/web/src/lib/observability/__tests__/client-error-reporter.test.ts
git commit -m "feat(observability): patch console.error to report real errors"
```

---

### Task 3: api-client auto-reports failures

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`
- Test: `apps/web/src/lib/__tests__/api-client.report.test.ts`

**Interfaces:**
- Consumes: `reportClientError` (Task 2), `ApiError`.
- Produces: on any failure in `callApi`/`callPublicApi`, calls `reportClientError(error, { route: "<METHOD> <path>", status })` then rethrows. Skips when the endpoint path starts with `/v1/observability`. Keeps 402 excluded.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/__tests__/api-client.report.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { getIdToken } = vi.hoisted(() => ({ getIdToken: vi.fn() }));
const { reportClientError } = vi.hoisted(() => ({ reportClientError: vi.fn() }));

vi.mock("@/lib/firebase", () => ({ auth: { currentUser: { getIdToken } } }));
vi.mock("firebase/auth", () => ({ onAuthStateChanged: vi.fn() }));
vi.mock("@/lib/observability/client-error-reporter", () => ({ reportClientError }));

import { callApi } from "../api-client";

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
      json: async () => body,
    }),
  );
}

beforeEach(() => {
  getIdToken.mockReset().mockResolvedValue("tok");
  reportClientError.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api-client auto-report", () => {
  it("reports a 500 with status + method route then throws", async () => {
    mockFetchOnce(500, { message: "boom" });
    await expect(callApi("/v1/proposals", "POST", {})).rejects.toThrow();
    expect(reportClientError).toHaveBeenCalledTimes(1);
    const [, ctx] = reportClientError.mock.calls[0];
    expect(ctx).toMatchObject({ status: 500, route: "POST /v1/proposals" });
  });

  it("reports a 404 (4xx included)", async () => {
    mockFetchOnce(404, { message: "not found" });
    await expect(callApi("/v1/x", "GET")).rejects.toThrow();
    expect(reportClientError).toHaveBeenCalledTimes(1);
  });

  it("does NOT report failures of the observability endpoint", async () => {
    mockFetchOnce(500, { message: "boom" });
    await expect(callApi("/v1/observability/issues", "GET")).rejects.toThrow();
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it("does NOT report a 402 plan-limit signal", async () => {
    mockFetchOnce(402, { message: "limit" });
    await expect(callApi("/v1/proposals", "POST", {})).rejects.toThrow();
    expect(reportClientError).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/__tests__/api-client.report.test.ts`
Expected: FAIL — reportClientError not called.

- [ ] **Step 3: Write the implementation**

In `apps/web/src/lib/api-client.ts`, add the import at the top (after the existing imports):

```typescript
import { reportClientError } from "@/lib/observability/client-error-reporter";
```

Add this helper above `callApi`:

```typescript
const OBSERVABILITY_PREFIX = "/v1/observability";

function reportApiFailure(method: string, path: string, error: unknown): void {
  // Never report failures of the observability pipeline itself (loop guard).
  if (path.startsWith(OBSERVABILITY_PREFIX)) return;
  // 402 is the plan-limit signal, not an error.
  if (error instanceof ApiError && error.status === 402) return;
  const status = error instanceof ApiError ? error.status : undefined;
  reportClientError(error, { route: `${method} ${path}`, status });
}
```

In `callApi`, replace the `catch (error)` block (the one with `console.error("API Call Failed…")`) with:

```typescript
  } catch (error) {
    reportApiFailure(method, path, error);
    throw error;
  }
```

In `callPublicApi`, replace its `catch (error)` block (the one with `console.error("Public API Call Failed…")`) with:

```typescript
  } catch (error) {
    reportApiFailure(method, path, error);
    throw error;
  }
```

(Both `callApi` and `callPublicApi` already compute `path` from the endpoint before building the URL; reuse that local `path` variable. If `path` is not in scope in `callPublicApi`'s catch, it is — it's declared near the top of the function alongside `url`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/__tests__/api-client.report.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Type-check + lint**

Run: `cd apps/web && npx tsc --noEmit && npx eslint src/lib/api-client.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/api-client.ts apps/web/src/lib/__tests__/api-client.report.test.ts
git commit -m "feat(observability): auto-report backend call failures from api-client"
```

---

### Task 4: Server-action error reporting

**Files:**
- Modify: `apps/web/src/lib/server-api-upstream.ts` (extract host helper)
- Create: `apps/web/src/lib/observability/report-server-error.ts`
- Modify: `apps/web/src/app/actions/auth.ts` (report inside existing catches)
- Test: `apps/web/src/lib/__tests__/server-api-upstream.test.ts`

**Interfaces:**
- Consumes: existing `resolveFunctionsApiUpstream(req)`, `UpstreamTarget`, the `LOCAL/DEV/PROD` constants and `getValidatedOverride`/`PRODUCTION_HOSTS` already in `server-api-upstream.ts`.
- Produces:
  - `resolveUpstreamForHost(host: string | null): UpstreamTarget` (pure; existing `resolveFunctionsApiUpstream` delegates to it).
  - `reportServerError(err: unknown, ctx?: { route?: string; status?: number }): Promise<void>` — resolves upstream from `next/headers` host, POSTs the client-error payload to `${baseUrl}/v1/observability/client-error`; never throws.

> Design note (deviation from spec's HOF): the two existing server actions (`deleteAuthUser`, `checkAdminConfig`) already catch internally and return a structured `ActionResult` rather than throwing — a `withServerErrorReporting` HOF wrapper would never see those errors. So we call `reportServerError` directly inside their existing catch blocks. The reusable `reportServerError` helper is exported for any future action. This matches the spec's intent (capture server-action errors) against the real code shape.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/__tests__/server-api-upstream.test.ts
import { describe, it, expect } from "vitest";
import { resolveUpstreamForHost } from "../server-api-upstream";

describe("resolveUpstreamForHost", () => {
  it("local for localhost", () => {
    expect(resolveUpstreamForHost("localhost").target).toBe("local");
    expect(resolveUpstreamForHost("127.0.0.1").target).toBe("local");
  });
  it("dev for an unknown host", () => {
    expect(resolveUpstreamForHost("preview-xyz.vercel.app").target).toBe("dev");
  });
  it("dev for null host", () => {
    expect(resolveUpstreamForHost(null).target).toBe("dev");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/__tests__/server-api-upstream.test.ts`
Expected: FAIL — `resolveUpstreamForHost` not exported.

- [ ] **Step 3: Extract the host helper**

In `apps/web/src/lib/server-api-upstream.ts`, refactor `resolveFunctionsApiUpstream` so the host→target decision lives in a new exported pure function, and the request-based function delegates:

```typescript
export function resolveUpstreamForHost(host: string | null): UpstreamTarget {
  const isLocalHost = host === "localhost" || host === "127.0.0.1";
  if (isLocalHost) {
    return { baseUrl: getValidatedOverride(process.env.FUNCTIONS_LOCAL_API_URL, LOCAL_UPSTREAM), target: "local" };
  }
  if (host && PRODUCTION_HOSTS.has(host)) {
    return { baseUrl: getValidatedOverride(process.env.FUNCTIONS_PROD_API_URL, PROD_UPSTREAM), target: "prod" };
  }
  return { baseUrl: getValidatedOverride(process.env.FUNCTIONS_DEV_API_URL, DEV_UPSTREAM), target: "dev" };
}

export function resolveFunctionsApiUpstream(req: NextRequest): UpstreamTarget {
  return resolveUpstreamForHost(getHostFromRequest(req));
}
```

(Keep the existing `getHostFromRequest`, constants, and `UpstreamTarget` type. Only the body of `resolveFunctionsApiUpstream` and the new exported function change.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/__tests__/server-api-upstream.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the server-side reporter**

```typescript
// apps/web/src/lib/observability/report-server-error.ts
import "server-only";
import { headers } from "next/headers";
import { resolveUpstreamForHost } from "@/lib/server-api-upstream";
import { buildClientErrorPayload } from "./report-error";

/**
 * Report an error thrown inside a Server Action / Server Component into the
 * observability pipeline. Best-effort; never throws.
 */
export async function reportServerError(
  err: unknown,
  ctx?: { route?: string; status?: number },
): Promise<void> {
  try {
    const host = (await headers()).get("host");
    const { baseUrl } = resolveUpstreamForHost(host);
    const payload = buildClientErrorPayload(err, { route: ctx?.route, status: ctx?.status });
    await fetch(`${baseUrl}/v1/observability/client-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  } catch {
    // never throw from the reporter
  }
}
```

- [ ] **Step 6: Wire into the existing server actions**

In `apps/web/src/app/actions/auth.ts`, add the import:

```typescript
import { reportServerError } from "@/lib/observability/report-server-error";
```

In `deleteAuthUser`'s `catch (error: unknown) {` block, add as the first line inside the catch (before reading `err`):

```typescript
    void reportServerError(error, { route: "action/deleteAuthUser" });
```

In `checkAdminConfig`'s catch block, add as the first line inside the catch:

```typescript
    void reportServerError(error, { route: "action/checkAdminConfig" });
```

- [ ] **Step 7: Type-check + lint**

Run: `cd apps/web && npx tsc --noEmit && npx eslint src/lib/server-api-upstream.ts src/lib/observability/report-server-error.ts src/app/actions/auth.ts`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/server-api-upstream.ts apps/web/src/lib/observability/report-server-error.ts apps/web/src/app/actions/auth.ts apps/web/src/lib/__tests__/server-api-upstream.test.ts
git commit -m "feat(observability): report server action errors to pipeline"
```

---

### Task 5: Backend finish-middleware captures non-throw error responses

**Files:**
- Create: `apps/functions/src/api/middleware/error-response-capture.ts`
- Modify: `apps/functions/src/api/index.ts` (register middleware early; set capture flag in global handler)
- Test: `apps/functions/src/api/middleware/__tests__/error-response-capture.test.ts`

**Interfaces:**
- Consumes: `captureError` from `../../lib/observability/error-logger`.
- Produces: `captureResponseErrors(req, res, next)` Express middleware. On `res.on("finish")`, if `res.statusCode >= 400` AND `res.locals.__obsCaptured !== true` AND path not excluded → `captureError(synthetic, { source: "functions", route, method, status, uid, tenantId, handled: true })`. Exported const `EXCLUDED_PREFIXES`.
- The global error handler sets `res.locals.__obsCaptured = true`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/functions/src/api/middleware/__tests__/error-response-capture.test.ts
process.env.NODE_ENV = "test";

const captureError = jest.fn();
jest.mock("../../../lib/observability/error-logger", () => ({ captureError: (...a: unknown[]) => captureError(...a) }));

import { EventEmitter } from "events";
import { Request, Response } from "express";
import { captureResponseErrors } from "../error-response-capture";

function run(path: string, method: string, statusCode: number, locals: Record<string, unknown> = {}) {
  const res = new EventEmitter() as unknown as Response & { statusCode: number; locals: Record<string, unknown> };
  res.statusCode = statusCode;
  res.locals = locals as never;
  const req = { path, method, user: { uid: "u1", tenantId: "t1" } } as unknown as Request;
  const next = jest.fn();
  captureResponseErrors(req, res, next);
  expect(next).toHaveBeenCalled();
  (res as unknown as EventEmitter).emit("finish");
}

beforeEach(() => captureError.mockReset());

it("captures a 404 non-throw response", () => {
  run("/v1/proposals/x", "GET", 404);
  expect(captureError).toHaveBeenCalledTimes(1);
  const [, ctx] = captureError.mock.calls[0];
  expect(ctx).toMatchObject({ source: "functions", status: 404, method: "GET", route: "/v1/proposals/x", handled: true });
});

it("captures a 500 non-throw response", () => {
  run("/v1/x", "POST", 500);
  expect(captureError).toHaveBeenCalledTimes(1);
});

it("skips when already captured by the global error handler", () => {
  run("/v1/x", "POST", 500, { __obsCaptured: true });
  expect(captureError).not.toHaveBeenCalled();
});

it("skips success responses", () => {
  run("/v1/x", "GET", 200);
  expect(captureError).not.toHaveBeenCalled();
});

it("skips excluded prefixes", () => {
  run("/v1/observability/issues", "GET", 500);
  run("/internal/cron/x", "POST", 500);
  run("/health", "GET", 503);
  expect(captureError).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/functions && npx jest --config jest.config.js src/api/middleware/__tests__/error-response-capture.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the middleware**

```typescript
// apps/functions/src/api/middleware/error-response-capture.ts
import { Request, Response, NextFunction } from "express";
import { captureError } from "../../lib/observability/error-logger";

export const EXCLUDED_PREFIXES = ["/v1/observability", "/internal", "/health", "/api/health"];

function isExcluded(path: string): boolean {
  return EXCLUDED_PREFIXES.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p));
}

/**
 * Captures every response with status >= 400 that was NOT already fed to the
 * observability pipeline by the global error handler (which sets
 * res.locals.__obsCaptured). Covers handlers that res.status(4xx/5xx) without
 * throwing. Best-effort, never blocks the response.
 */
export function captureResponseErrors(req: Request, res: Response, next: NextFunction): void {
  res.on("finish", () => {
    try {
      if (res.statusCode < 400) return;
      if ((res.locals as { __obsCaptured?: boolean })?.__obsCaptured === true) return;
      if (isExcluded(req.path)) return;
      const user = req.user as { uid?: string; tenantId?: string } | undefined;
      const synthetic = {
        name: "HttpError",
        message: `HTTP ${res.statusCode} ${req.method} ${req.path}`,
      };
      void captureError(synthetic, {
        source: "functions",
        route: req.path,
        method: req.method,
        status: res.statusCode,
        uid: user?.uid ?? null,
        tenantId: user?.tenantId ?? null,
        handled: true,
      });
    } catch {
      // best-effort
    }
  });
  next();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/functions && npx jest --config jest.config.js src/api/middleware/__tests__/error-response-capture.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Register the middleware early + set the capture flag**

In `apps/functions/src/api/index.ts`:

1. Add the import near the other middleware imports:

```typescript
import { captureResponseErrors } from "./middleware/error-response-capture";
```

2. Register it immediately AFTER the requestId-attach middleware block (the `app.use((req, res, next) => { const requestId = attachRequestId(req, res); ... })` around lines 338-362) and BEFORE the public routes — so it covers public AND protected routes. `req.user` is read lazily inside the finish handler, so registering before auth is fine:

```typescript
app.use(captureResponseErrors);
```

3. In the global error handler block, set the capture flag so this middleware does not double-capture thrown errors. Add this line inside the handler, right before the existing `void captureError(err, {...})` call:

```typescript
    res.locals.__obsCaptured = true;
```

- [ ] **Step 6: Build + run the middleware test again**

Run: `cd apps/functions && npx tsc --noEmit && npx jest --config jest.config.js src/api/middleware/__tests__/error-response-capture.test.ts`
Expected: tsc clean; tests PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/functions/src/api/middleware/error-response-capture.ts apps/functions/src/api/middleware/__tests__/error-response-capture.test.ts apps/functions/src/api/index.ts
git commit -m "feat(observability): capture non-throw error responses backend-wide"
```

---

### Task 6: Capture cron failures

**Files:**
- Modify: `apps/functions/src/checkDueDates.ts`
- Modify: `apps/functions/src/checkManualSubscriptions.ts`
- Modify: `apps/functions/src/checkStripeSubscriptions.ts`
- Modify: `apps/functions/src/reportWhatsappOverage.ts`
- Modify: `apps/functions/src/cleanupStorageAndSharedLinks.ts`

**Interfaces:**
- Consumes: `captureError` from `./lib/observability/error-logger`.

> No unit test: cron bodies are wrapped by `onSchedule(...)` and are not directly invocable without the Firebase scheduler/emulator harness. The change is a one-line capture inside each existing top-level catch. Verified by build + the next task's full suite. (Documented deviation from the spec's "one cron catch test".)

- [ ] **Step 1: Add capture to `checkDueDates.ts`**

Add the import near the top (after the existing `import { db } from "./init";`):

```typescript
import { captureError } from "./lib/observability/error-logger";
```

In the outer catch (`} catch (error) { console.error("Error checking due dates:", error); }`), add after the `console.error`:

```typescript
      void captureError(error, { source: "functions", route: "cron/checkDueDates", handled: false });
```

- [ ] **Step 2: Add capture to `checkManualSubscriptions.ts`**

Add import:

```typescript
import { captureError } from "./lib/observability/error-logger";
```

In the outer catch (`console.error("Error checking manual subscriptions:", error)`), add after it:

```typescript
      void captureError(error, { source: "functions", route: "cron/checkManualSubscriptions", handled: false });
```

- [ ] **Step 3: Add capture to `checkStripeSubscriptions.ts`**

This file already imports `logger` from `./lib/logger`. Add:

```typescript
import { captureError } from "./lib/observability/error-logger";
```

This file has the outer catch logging `logger.error("Error notifying superadmins:", { error })`. Locate the OUTERMOST try/catch of the scheduled handler body and add inside its catch (after the existing log):

```typescript
      void captureError(error, { source: "functions", route: "cron/checkStripeSubscriptions", handled: false });
```

(If the only top-level catch is the "notifying superadmins" one, add it there — it is the handler's outer catch.)

- [ ] **Step 4: Add capture to `reportWhatsappOverage.ts`**

Add import:

```typescript
import { captureError } from "./lib/observability/error-logger";
```

In the global catch (`console.error("[Cron] whatsapp overage report failed to run globally", error)`), add after it:

```typescript
      void captureError(error, { source: "functions", route: "cron/reportWhatsappOverage", handled: false });
```

- [ ] **Step 5: Add capture to `cleanupStorageAndSharedLinks.ts`**

Add import:

```typescript
import { captureError } from "./lib/observability/error-logger";
```

In the first/main catch (`console.error("[cleanupStorageAndSharedLinks] failed during expired link cleanup", error)`), add after it:

```typescript
      void captureError(error, { source: "functions", route: "cron/cleanupStorageAndSharedLinks", handled: false });
```

- [ ] **Step 6: Build**

Run: `cd apps/functions && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add apps/functions/src/checkDueDates.ts apps/functions/src/checkManualSubscriptions.ts apps/functions/src/checkStripeSubscriptions.ts apps/functions/src/reportWhatsappOverage.ts apps/functions/src/cleanupStorageAndSharedLinks.ts
git commit -m "feat(observability): capture scheduled function failures"
```

---

### Task 7: Capture Stripe webhook failures

**Files:**
- Modify: `apps/functions/src/stripe/stripeWebhook.ts`

**Interfaces:**
- Consumes: `captureError` from `../lib/observability/error-logger`.

> No unit test: the webhook handler requires Stripe signature construction + Firestore; the change is a one-line capture inside two existing catch blocks. Verified by build. Billing/idempotency logic untouched. (Documented deviation.)

- [ ] **Step 1: Add the import**

Near the top of `apps/functions/src/stripe/stripeWebhook.ts`, add:

```typescript
import { captureError } from "../lib/observability/error-logger";
```

- [ ] **Step 2: Capture in the handler-level catch**

In the inner `catch (handlerError)` block (the one that calls `finalizeStripeEventProcessing(event, "failed", …)` and ends with `throw handlerError;`), add right before `throw handlerError;`:

```typescript
        void captureError(handlerError, {
          source: "functions",
          route: `stripeWebhook/${event.type}`,
          status: 500,
          handled: false,
        });
```

- [ ] **Step 3: Capture in the generic outer catch**

In the outer `catch (error)` block (the one ending with `res.status(500).json({ error: "Webhook handler failed" })`), add right before the `res.status(500)` line:

```typescript
      void captureError(error, {
        source: "functions",
        route: "stripeWebhook/unknown",
        status: 500,
        handled: false,
      });
```

- [ ] **Step 4: Build**

Run: `cd apps/functions && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/functions/src/stripe/stripeWebhook.ts
git commit -m "feat(observability): capture stripe webhook handler failures"
```

---

### Task 8: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Web unit suite + type-check + lint**

Run: `cd apps/web && npx tsc --noEmit && npm run lint && cd .. && cd .. && npm run test:web`
Expected: tsc 0, lint 0, all unit tests pass (incl. the new report-error / client-error-reporter / api-client / server-api-upstream tests).

- [ ] **Step 2: Web build**

Run: `cd apps/web && npm run build`
Expected: production build succeeds (validates `server-only` import in report-server-error.ts is not pulled into a client bundle).

- [ ] **Step 3: Functions build + lint + observability tests**

Run: `cd apps/functions && npm run build && npm run lint && npx jest --config jest.config.js src/api/middleware/__tests__/error-response-capture.test.ts src/api/controllers/__tests__`
Expected: build OK; lint 0 errors; middleware test passes; pre-existing observability controller tests behave as before (triage suite still needs the Firestore emulator — unchanged by this branch).

- [ ] **Step 4: Manual smoke (optional, requires emulators + dev session)**

- Browser console on any page: `setTimeout(() => { throw new Error("evlog test " + Date.now()); })` → appears as a Web issue.
- Trigger a failing backend call (e.g. a request that 404s) → appears as a Web issue (api-client) AND a Functions `HttpError` issue (finish-middleware).
- `console.error(new Error("evlog console test"))` → appears as a Web issue; `console.error("plain string")` → does NOT.

- [ ] **Step 5: No commit** — verification only.

---

## Self-Review Notes

- **Spec coverage:** A1 status payload → Task 1; A2 console.error patch (Error-only) → Task 2; A3 api-client auto-report (incl 4xx, skip observability, keep 402) → Task 3; A4 server actions → Task 4; B1 finish-middleware (all >=400, skip excluded, no double-capture) → Task 5; B2 crons → Task 6; B3 webhook → Task 7. Guards C and tests D covered across tasks; final gate in Task 8.
- **Deviation 1 (server actions):** spec proposed a `withServerErrorReporting` HOF; the real actions catch internally and return structured results, so the HOF would never fire. Replaced with direct `reportServerError` calls in the existing catches + an exported reusable helper. Same intent, fits the code.
- **Deviation 2 (middleware registration):** spec said "register at line 487 (after auth)"; that misses public routes (which respond before the auth barrier). Registering early (after requestId) + reading `req.user` lazily in the finish handler covers public AND protected routes. Strictly better for "everywhere".
- **Deviation 3 (cron/webhook tests):** spec wanted a cron catch unit test; `onSchedule`/webhook bodies aren't unit-invocable without the emulator. These are one-line catch insertions verified by build; the genuinely new logic (middleware, console patch, api-client, payload, host helper) is fully unit-tested.
- **Volume note:** all-4xx + Error-level console.error + per-failure double issues (web + functions) are intentional per the user's "máximo" choice. The backend rate-guard (30/fp/10s) and client dedupe bound storms.
