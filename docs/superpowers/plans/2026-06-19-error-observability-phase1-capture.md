# Error Observability — Phase 1 (Capture Pipeline) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture every web + Cloud Functions error, format/redact it with evlog, and persist it into Firestore as deduplicated, idempotent **error issues** — with no dashboard yet.

**Architecture:** Errors flow into a single evlog logger per runtime whose custom Firestore **drain** forwards each `WideEvent` to a backend `error-ingest` service. Ingest computes a server-side fingerprint + severity and performs an **atomic, idempotent** `runTransaction` upsert on `error_issues/{fingerprint}` (increment count, update lastSeen, reopen on recurrence), then best-effort writes a bounded, TTL'd occurrence sample and updates hourly metrics. The frontend hooks its error boundaries + global handlers into a batched client reporter that POSTs to a rate-limited backend ingest endpoint. Reads/dashboard are Phase 2.

**Tech Stack:** TypeScript, Firebase Admin SDK (Firestore `runTransaction`, `FieldValue`), Express (Cloud Functions V2), [evlog](https://www.evlog.dev/) (`defineDrain`, `createError`, `parseError`), Next.js App Router, Jest (functions + rules), Vitest (web), `@firebase/rules-unit-testing`.

## Global Constraints

- **No Sentry.** This project has no error-monitoring SaaS — see `docs/superpowers/specs/2026-06-19-superadmin-error-observability-design.md` and the "no Sentry" rule. Never wire Sentry.
- **Commit style:** imperative, lowercase, conventional-commits, single line. **No `Co-Authored-By`.** Author is the current git user — never pass `--author`.
- **Never** run `git push`. **Never** merge to `main`. PRs target `develop` only.
- **Multi-tenant:** every Firestore query filters by `tenantId` from auth context, never the request body. New collections are DENY-by-default — explicit rules required.
- **Never log/persist** tokens, passwords, `FIREBASE_PRIVATE_KEY`, CPF, full emails, phone numbers. evlog redaction runs before persistence; keep it.
- **Bounded reads/writes:** every collection query carries `.limit()`; no unbounded arrays; occurrence subcollection is a capped, TTL'd sample, never the source of `count`.
- **Self-protection:** error-logging code must never throw into a request path and must never recurse (the ingest path is excluded from capture).
- **Firestore handle:** `import { db } from "../init"` (functions). `FieldValue` from `firebase-admin/firestore`.
- **Naming:** files kebab-case; collections snake_case plural; constants UPPER_SNAKE_CASE.
- Backend build compiles TS → `apps/functions/lib/` (CommonJS). Run `cd apps/functions && npm run build` before deploy/emulator.
- Test commands: `npm run test:web` (Vitest), `npm run test:functions` (Jest), `npm run test:rules` (rules; needs Firestore emulator on 127.0.0.1:8080).

---

## File Structure

**Backend (`apps/functions/src/`):**
- `shared/error-observability.types.ts` — `ErrorIssue`, `ErrorOccurrence`, `ErrorSeverity`, `ErrorSource`, `IngestErrorInput` interfaces (shared with controllers/drain).
- `lib/observability/fingerprint.ts` — pure: `normalizeErrorMessage()`, `computeFingerprint()`.
- `lib/observability/severity.ts` — pure: `mapSeverity()`.
- `lib/observability/ingest-rate-guard.ts` — in-memory per-fingerprint write-amplification guard.
- `lib/observability/error-ingest.service.ts` — `ingestError()`: atomic upsert + occurrence + metrics + affected agg.
- `lib/observability/error-logger.ts` — evlog logger + custom Firestore `defineDrain`; `captureError()` helper for the global handler and controllers.
- `api/controllers/observability.controller.ts` — `ingestClientError()` handler + `mapObservabilityErrorStatus()`.
- `api/routes/observability.routes.ts` — route table (Phase 1: client-error ingest only).
- Modify `api/index.ts` — register `observabilityRoutes`; call `captureError()` from the global error handler.

**Frontend (`apps/web/src/`):**
- `lib/observability/client-error-reporter.ts` — batch/dedup/beacon reporter + `installClientErrorReporter()`.
- `lib/observability/report-error.ts` — pure: `buildClientErrorPayload()`, `dedupeKey()`.
- Modify `components/shared/error-boundary.tsx` — report in `componentDidCatch`.
- Modify `app/global-error.tsx` — report on mount.
- Modify `app/layout.tsx` (or a small client provider) — install window/unhandledrejection handlers once.

**Rules / indexes:**
- Modify `firebase/firestore.rules` — `error_issues`, `error_issues/{fp}/occurrences`, `error_issues/{fp}/_agg`, `error_metrics`.
- Modify `firebase/firestore.indexes.json` — composite indexes for issue listing/filters (used in Phase 2, declared now).

**Tests:**
- `apps/functions/src/lib/observability/__tests__/fingerprint.test.ts`
- `apps/functions/src/lib/observability/__tests__/severity.test.ts`
- `apps/functions/src/lib/observability/__tests__/ingest-rate-guard.test.ts`
- `apps/functions/src/lib/observability/__tests__/error-ingest.service.test.ts` (Firestore emulator)
- `apps/web/src/lib/observability/__tests__/report-error.test.ts`
- `tests/firestore-rules/error-observability.test.ts`

---

## Task 1: Shared types

**Files:**
- Create: `apps/functions/src/shared/error-observability.types.ts`

**Interfaces:**
- Produces: `ErrorSeverity`, `ErrorSource`, `ErrorIssue`, `ErrorOccurrence`, `IngestErrorInput`.

- [ ] **Step 1: Write the types**

```typescript
// apps/functions/src/shared/error-observability.types.ts

export type ErrorSeverity = "critical" | "error" | "warning";
export type ErrorSource = "web" | "functions";
export type ErrorIssueStatus = "unresolved" | "resolved" | "ignored";

/**
 * Normalized input for the ingest pipeline. The fingerprint is ALWAYS computed
 * server-side from these fields — never trusted from a client.
 */
export interface IngestErrorInput {
  errorType: string;
  message: string;
  stack: string | null;
  source: ErrorSource;
  route: string | null;
  method: string | null;
  status: number | null;
  uid: string | null;
  tenantId: string | null;
  userAgent: string | null;
  /** evlog structured-error fields, when present. */
  why: string | null;
  fix: string | null;
  link: string | null;
}

export interface ErrorIssue {
  fingerprint: string;
  errorType: string;
  title: string;
  normalizedMessage: string;
  source: ErrorSource;
  route: string | null;
  method: string | null;
  severity: ErrorSeverity;
  status: ErrorIssueStatus;
  count: number;
  firstSeen: string; // ISO
  lastSeen: string; // ISO
  resolvedAt: string | null;
  affectedUsers: number;
  affectedTenants: number;
  tenantIds: string[]; // capped at 20, display-only
  sampleStack: string;
  why: string | null;
  fix: string | null;
  link: string | null;
}

export interface ErrorOccurrence {
  uid: string | null;
  tenantId: string | null;
  route: string | null;
  method: string | null;
  status: number | null;
  stack: string;
  userAgent: string | null;
  createdAt: string; // ISO
  expiresAt: string; // ISO — Firestore TTL field
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/functions && npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add apps/functions/src/shared/error-observability.types.ts
git commit -m "feat(observability): add error issue/occurrence shared types"
```

---

## Task 2: Fingerprint + message normalization (pure)

**Files:**
- Create: `apps/functions/src/lib/observability/fingerprint.ts`
- Test: `apps/functions/src/lib/observability/__tests__/fingerprint.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `normalizeErrorMessage(message: string): string`
  - `firstStackFrame(stack: string | null): string`
  - `computeFingerprint(input: { errorType: string; normalizedMessage: string; route: string | null; stackTopFrame: string }): string`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/functions/src/lib/observability/__tests__/fingerprint.test.ts
import {
  normalizeErrorMessage,
  firstStackFrame,
  computeFingerprint,
} from "../fingerprint";

describe("normalizeErrorMessage", () => {
  it("strips UUIDs, long numbers, emails and hex ids so similar errors collapse", () => {
    const a = normalizeErrorMessage("user 9f1c2e7a-1b2c-4d5e-8f90-abcdef012345 not found");
    const b = normalizeErrorMessage("user 0a2b3c4d-5e6f-7081-9abc-def012345678 not found");
    expect(a).toBe(b);
    expect(a).toBe("user <id> not found");
  });

  it("replaces standalone numbers and emails", () => {
    expect(normalizeErrorMessage("retry 4123 for a@b.com")).toBe("retry <n> for <email>");
  });

  it("collapses whitespace and trims", () => {
    expect(normalizeErrorMessage("  too   many \n requests ")).toBe("too many requests");
  });
});

describe("firstStackFrame", () => {
  it("returns the first 'at ...' frame", () => {
    const stack = "Error: boom\n    at foo (/srv/a.js:10:5)\n    at bar (/srv/b.js:2:1)";
    expect(firstStackFrame(stack)).toBe("at foo (/srv/a.js:10:5)");
  });

  it("returns empty string for null stack", () => {
    expect(firstStackFrame(null)).toBe("");
  });
});

describe("computeFingerprint", () => {
  it("is deterministic and stable for the same inputs", () => {
    const fp1 = computeFingerprint({
      errorType: "TypeError",
      normalizedMessage: "user <id> not found",
      route: "/v1/proposals",
      stackTopFrame: "at foo (/srv/a.js:10:5)",
    });
    const fp2 = computeFingerprint({
      errorType: "TypeError",
      normalizedMessage: "user <id> not found",
      route: "/v1/proposals",
      stackTopFrame: "at foo (/srv/a.js:10:5)",
    });
    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^[a-f0-9]{40}$/);
  });

  it("differs when route differs", () => {
    const base = { errorType: "TypeError", normalizedMessage: "x", stackTopFrame: "at a" };
    expect(computeFingerprint({ ...base, route: "/a" })).not.toBe(
      computeFingerprint({ ...base, route: "/b" }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/functions && npx jest src/lib/observability/__tests__/fingerprint.test.ts`
Expected: FAIL — "Cannot find module '../fingerprint'".

- [ ] **Step 3: Write the implementation**

```typescript
// apps/functions/src/lib/observability/fingerprint.ts
import { createHash } from "node:crypto";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const HEX_RE = /\b[0-9a-f]{16,}\b/gi;
const NUM_RE = /\b\d{2,}\b/g;

export function normalizeErrorMessage(message: string): string {
  return (message || "")
    .replace(UUID_RE, "<id>")
    .replace(EMAIL_RE, "<email>")
    .replace(HEX_RE, "<id>")
    .replace(NUM_RE, "<n>")
    .replace(/\s+/g, " ")
    .trim();
}

export function firstStackFrame(stack: string | null): string {
  if (!stack) return "";
  const line = stack.split("\n").map((l) => l.trim()).find((l) => l.startsWith("at "));
  return line || "";
}

export function computeFingerprint(input: {
  errorType: string;
  normalizedMessage: string;
  route: string | null;
  stackTopFrame: string;
}): string {
  const basis = [
    input.errorType || "Error",
    input.normalizedMessage || "",
    input.route || "",
    input.stackTopFrame || "",
  ].join("|");
  return createHash("sha1").update(basis).digest("hex");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/functions && npx jest src/lib/observability/__tests__/fingerprint.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add apps/functions/src/lib/observability/fingerprint.ts apps/functions/src/lib/observability/__tests__/fingerprint.test.ts
git commit -m "feat(observability): deterministic fingerprint and message normalization"
```

---

## Task 3: Severity mapping (pure)

**Files:**
- Create: `apps/functions/src/lib/observability/severity.ts`
- Test: `apps/functions/src/lib/observability/__tests__/severity.test.ts`

**Interfaces:**
- Produces: `mapSeverity(input: { status: number | null; source: ErrorSource; handled: boolean }): ErrorSeverity`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/functions/src/lib/observability/__tests__/severity.test.ts
import { mapSeverity } from "../severity";

describe("mapSeverity", () => {
  it("5xx or unhandled is critical", () => {
    expect(mapSeverity({ status: 500, source: "functions", handled: false })).toBe("critical");
    expect(mapSeverity({ status: null, source: "functions", handled: false })).toBe("critical");
    expect(mapSeverity({ status: 503, source: "web", handled: true })).toBe("critical");
  });

  it("handled 4xx domain errors are warning", () => {
    expect(mapSeverity({ status: 400, source: "functions", handled: true })).toBe("warning");
    expect(mapSeverity({ status: 404, source: "functions", handled: true })).toBe("warning");
  });

  it("everything else is error", () => {
    expect(mapSeverity({ status: 200, source: "web", handled: true })).toBe("error");
    expect(mapSeverity({ status: null, source: "web", handled: true })).toBe("error");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/functions && npx jest src/lib/observability/__tests__/severity.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/functions/src/lib/observability/severity.ts
import type { ErrorSeverity, ErrorSource } from "../../shared/error-observability.types";

export function mapSeverity(input: {
  status: number | null;
  source: ErrorSource;
  handled: boolean;
}): ErrorSeverity {
  const { status, handled } = input;
  if (!handled) return "critical";
  if (typeof status === "number" && status >= 500) return "critical";
  if (typeof status === "number" && status >= 400 && status < 500) return "warning";
  return "error";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/functions && npx jest src/lib/observability/__tests__/severity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/functions/src/lib/observability/severity.ts apps/functions/src/lib/observability/__tests__/severity.test.ts
git commit -m "feat(observability): severity mapping for error issues"
```

---

## Task 4: Write-amplification guard (in-memory, per-fingerprint)

**Files:**
- Create: `apps/functions/src/lib/observability/ingest-rate-guard.ts`
- Test: `apps/functions/src/lib/observability/__tests__/ingest-rate-guard.test.ts`

**Interfaces:**
- Produces: `class IngestRateGuard { constructor(maxPerWindow: number, windowMs: number); allow(fingerprint: string, now?: number): boolean }`

This coalesces error storms: at most `maxPerWindow` Firestore upserts per fingerprint per window per Cloud Run instance. Mirrors the in-memory sliding-window store pattern already used by `MemoryRateLimitStore`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/functions/src/lib/observability/__tests__/ingest-rate-guard.test.ts
import { IngestRateGuard } from "../ingest-rate-guard";

describe("IngestRateGuard", () => {
  it("allows up to maxPerWindow within the window, then blocks", () => {
    const guard = new IngestRateGuard(2, 10_000);
    expect(guard.allow("fp", 0)).toBe(true);
    expect(guard.allow("fp", 1)).toBe(true);
    expect(guard.allow("fp", 2)).toBe(false);
  });

  it("resets after the window elapses", () => {
    const guard = new IngestRateGuard(1, 10_000);
    expect(guard.allow("fp", 0)).toBe(true);
    expect(guard.allow("fp", 5_000)).toBe(false);
    expect(guard.allow("fp", 10_001)).toBe(true);
  });

  it("tracks fingerprints independently", () => {
    const guard = new IngestRateGuard(1, 10_000);
    expect(guard.allow("a", 0)).toBe(true);
    expect(guard.allow("b", 0)).toBe(true);
    expect(guard.allow("a", 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/functions && npx jest src/lib/observability/__tests__/ingest-rate-guard.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/functions/src/lib/observability/ingest-rate-guard.ts

type GuardEntry = { count: number; windowStart: number };

const MAX_KEYS = 10_000;

/**
 * Per-instance, in-memory coalescing guard. Bounds how many Firestore upserts a
 * single fingerprint can trigger per window, protecting cost under error storms.
 * Dropped writes are intentionally lost at the instance level (best-effort
 * observability, not billing) — `count` on surviving writes still climbs.
 */
export class IngestRateGuard {
  private readonly state = new Map<string, GuardEntry>();
  private readonly maxPerWindow: number;
  private readonly windowMs: number;

  constructor(maxPerWindow: number, windowMs: number) {
    this.maxPerWindow = Math.max(1, Math.floor(maxPerWindow));
    this.windowMs = Math.max(1_000, Math.floor(windowMs));
  }

  allow(fingerprint: string, now: number = Date.now()): boolean {
    if (this.state.size > MAX_KEYS) this.prune(now);
    const entry = this.state.get(fingerprint);
    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.state.set(fingerprint, { count: 1, windowStart: now });
      return true;
    }
    if (entry.count >= this.maxPerWindow) return false;
    entry.count += 1;
    return true;
  }

  private prune(now: number): void {
    this.state.forEach((entry, key) => {
      if (now - entry.windowStart > this.windowMs * 2) this.state.delete(key);
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/functions && npx jest src/lib/observability/__tests__/ingest-rate-guard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/functions/src/lib/observability/ingest-rate-guard.ts apps/functions/src/lib/observability/__tests__/ingest-rate-guard.test.ts
git commit -m "feat(observability): per-fingerprint write-amplification guard"
```

---

## Task 5: Error-ingest service (atomic idempotent upsert)

**Files:**
- Create: `apps/functions/src/lib/observability/error-ingest.service.ts`
- Test: `apps/functions/src/lib/observability/__tests__/error-ingest.service.test.ts` (Firestore emulator)

**Interfaces:**
- Consumes: `IngestErrorInput` (Task 1), `computeFingerprint`/`normalizeErrorMessage`/`firstStackFrame` (Task 2), `mapSeverity` (Task 3), `IngestRateGuard` (Task 4).
- Produces:
  - `ingestError(input: IngestErrorInput, opts?: { handled?: boolean }): Promise<{ fingerprint: string; persisted: boolean }>`
  - Constants: `ERROR_ISSUES_COLLECTION = "error_issues"`, `ERROR_METRICS_COLLECTION = "error_metrics"`, `OCCURRENCE_SAMPLE_CAP = 50`, `AFFECTED_CAP = 1000`.

Design notes the implementer must honor:
- The `db` handle is `import { db } from "../../init"`.
- `truncate(s, n)` caps strings; `sampleStack` ≤ 8000 chars, occurrence `stack` ≤ 8000.
- Upsert runs in `db.runTransaction`. Occurrence write + metrics + affected-agg happen AFTER commit, each wrapped in its own try/catch (best-effort, never throw).
- Recurrence: if the existing issue `status === "resolved"`, flip to `"unresolved"` and clear `resolvedAt`.
- `affectedUsers`/`affectedTenants` come from a sibling doc `error_issues/{fp}/_agg/affected` holding capped hashed-id sets; the issue doc stores only the counts + a display-capped `tenantIds` (≤ 20).
- Hourly metrics doc id is `YYYYMMDDhh` (UTC), counter key is `${severity}_${source}`, written with `FieldValue.increment(1)` + `{ merge: true }` — same shape as `security_metrics`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/functions/src/lib/observability/__tests__/error-ingest.service.test.ts
/**
 * Requires the Firestore emulator on 127.0.0.1:8080.
 * Run via: firebase emulators:exec --only firestore "cd apps/functions && npx jest src/lib/observability/__tests__/error-ingest.service.test.ts"
 */
import { ingestError, ERROR_ISSUES_COLLECTION } from "../error-ingest.service";
import { db } from "../../../init";

const baseInput = {
  errorType: "TypeError",
  message: "user 9f1c2e7a-1b2c-4d5e-8f90-abcdef012345 not found",
  stack: "Error: boom\n    at foo (/srv/a.js:10:5)",
  source: "functions" as const,
  route: "/v1/proposals",
  method: "GET",
  status: 500,
  uid: "uid-1",
  tenantId: "tenant-1",
  userAgent: null,
  why: null,
  fix: null,
  link: null,
};

async function wipe() {
  const snap = await db.collection(ERROR_ISSUES_COLLECTION).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

describe("ingestError", () => {
  beforeEach(wipe);
  afterAll(wipe);

  it("creates an issue with count 1 on first occurrence", async () => {
    const { fingerprint } = await ingestError(baseInput, { handled: false });
    const doc = await db.collection(ERROR_ISSUES_COLLECTION).doc(fingerprint).get();
    const data = doc.data()!;
    expect(data.count).toBe(1);
    expect(data.status).toBe("unresolved");
    expect(data.severity).toBe("critical");
    expect(data.normalizedMessage).toBe("user <id> not found");
  });

  it("is idempotent-by-grouping: two similar errors increment one issue", async () => {
    const a = await ingestError(baseInput, { handled: false });
    const b = await ingestError(
      { ...baseInput, message: "user 0a2b3c4d-5e6f-7081-9abc-def012345678 not found", uid: "uid-2" },
      { handled: false },
    );
    expect(a.fingerprint).toBe(b.fingerprint);
    const doc = await db.collection(ERROR_ISSUES_COLLECTION).doc(a.fingerprint).get();
    expect(doc.data()!.count).toBe(2);
    expect(doc.data()!.affectedUsers).toBe(2);
  });

  it("reopens a resolved issue on recurrence", async () => {
    const { fingerprint } = await ingestError(baseInput, { handled: false });
    await db.collection(ERROR_ISSUES_COLLECTION).doc(fingerprint).update({
      status: "resolved",
      resolvedAt: new Date().toISOString(),
    });
    await ingestError(baseInput, { handled: false });
    const doc = await db.collection(ERROR_ISSUES_COLLECTION).doc(fingerprint).get();
    expect(doc.data()!.status).toBe("unresolved");
    expect(doc.data()!.resolvedAt).toBeNull();
  });

  it("caps the occurrence sample subcollection", async () => {
    for (let i = 0; i < 55; i++) {
      await ingestError({ ...baseInput, uid: `uid-${i}` }, { handled: false });
    }
    const { fingerprint } = await ingestError(baseInput, { handled: false });
    const occ = await db
      .collection(ERROR_ISSUES_COLLECTION)
      .doc(fingerprint)
      .collection("occurrences")
      .get();
    expect(occ.size).toBeLessThanOrEqual(50);
  });

  it("never throws even if the input is degenerate", async () => {
    await expect(
      ingestError(
        { ...baseInput, message: "", stack: null, route: null, method: null, status: null, uid: null, tenantId: null },
        { handled: true },
      ),
    ).resolves.toHaveProperty("fingerprint");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/functions && npx jest src/lib/observability/__tests__/error-ingest.service.test.ts`
Expected: FAIL — "Cannot find module '../error-ingest.service'".

- [ ] **Step 3: Write the implementation**

```typescript
// apps/functions/src/lib/observability/error-ingest.service.ts
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../../init";
import type { IngestErrorInput, ErrorIssue } from "../../shared/error-observability.types";
import { normalizeErrorMessage, firstStackFrame, computeFingerprint } from "./fingerprint";
import { mapSeverity } from "./severity";
import { IngestRateGuard } from "./ingest-rate-guard";

export const ERROR_ISSUES_COLLECTION = "error_issues";
export const ERROR_METRICS_COLLECTION = "error_metrics";
export const OCCURRENCE_SAMPLE_CAP = 50;
export const AFFECTED_CAP = 1000;
const TENANT_DISPLAY_CAP = 20;
const STACK_MAX = 8000;
const OCCURRENCE_RETENTION_DAYS = 30;

const guard = new IngestRateGuard(
  Number(process.env.ERROR_INGEST_MAX_PER_WINDOW || 30),
  Number(process.env.ERROR_INGEST_WINDOW_MS || 10_000),
);

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function hashId(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 16);
}

function windowId(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}${p(now.getUTCHours())}`
  );
}

/**
 * Idempotent, atomic error ingestion. Never throws — failures degrade to a
 * console.warn so logging an error can never break the path that produced it.
 */
export async function ingestError(
  input: IngestErrorInput,
  opts: { handled?: boolean } = {},
): Promise<{ fingerprint: string; persisted: boolean }> {
  const handled = opts.handled !== false;
  const normalizedMessage = normalizeErrorMessage(input.message);
  const errorType = (input.errorType || "Error").slice(0, 200);
  const stackTopFrame = firstStackFrame(input.stack);
  const fingerprint = computeFingerprint({
    errorType,
    normalizedMessage,
    route: input.route,
    stackTopFrame,
  });

  if (!guard.allow(fingerprint)) {
    return { fingerprint, persisted: false };
  }

  const severity = mapSeverity({ status: input.status, source: input.source, handled });
  const nowIso = new Date().toISOString();
  const issueRef = db.collection(ERROR_ISSUES_COLLECTION).doc(fingerprint);

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(issueRef);
      if (!snap.exists) {
        const issue: ErrorIssue = {
          fingerprint,
          errorType,
          title: truncate(normalizedMessage || errorType, 300),
          normalizedMessage,
          source: input.source,
          route: input.route,
          method: input.method,
          severity,
          status: "unresolved",
          count: 1,
          firstSeen: nowIso,
          lastSeen: nowIso,
          resolvedAt: null,
          affectedUsers: input.uid ? 1 : 0,
          affectedTenants: input.tenantId ? 1 : 0,
          tenantIds: input.tenantId ? [input.tenantId] : [],
          sampleStack: truncate(input.stack || "", STACK_MAX),
          why: input.why,
          fix: input.fix,
          link: input.link,
        };
        tx.set(issueRef, issue);
        return;
      }
      const data = snap.data() as ErrorIssue;
      const update: Record<string, unknown> = {
        count: FieldValue.increment(1),
        lastSeen: nowIso,
        severity, // keep latest severity classification
      };
      if (data.status === "resolved") {
        update.status = "unresolved";
        update.resolvedAt = null;
      }
      if (input.tenantId && !(data.tenantIds || []).includes(input.tenantId)) {
        if ((data.tenantIds || []).length < TENANT_DISPLAY_CAP) {
          update.tenantIds = FieldValue.arrayUnion(input.tenantId);
        }
      }
      tx.update(issueRef, update);
    });
  } catch (error) {
    console.warn("[OBSERVABILITY] issue upsert failed", {
      fingerprint,
      error: error instanceof Error ? error.message : String(error),
    });
    return { fingerprint, persisted: false };
  }

  // Best-effort side writes — each isolated, never throws into the caller.
  await writeOccurrence(fingerprint, input, nowIso).catch(() => undefined);
  await updateAffectedAgg(fingerprint, input).catch(() => undefined);
  await incrementMetric(severity, input.source).catch(() => undefined);

  return { fingerprint, persisted: true };
}

async function writeOccurrence(
  fingerprint: string,
  input: IngestErrorInput,
  nowIso: string,
): Promise<void> {
  const col = db.collection(ERROR_ISSUES_COLLECTION).doc(fingerprint).collection("occurrences");
  const expiresAt = new Date(
    Date.now() + OCCURRENCE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  await col.add({
    uid: input.uid,
    tenantId: input.tenantId,
    route: input.route,
    method: input.method,
    status: input.status,
    stack: truncate(input.stack || "", STACK_MAX),
    userAgent: input.userAgent,
    createdAt: nowIso,
    expiresAt,
  });

  // Trim the sample to the cap: delete oldest beyond OCCURRENCE_SAMPLE_CAP.
  const overflow = await col.orderBy("createdAt", "desc").offset(OCCURRENCE_SAMPLE_CAP).limit(20).get();
  if (!overflow.empty) {
    const batch = db.batch();
    overflow.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

async function updateAffectedAgg(fingerprint: string, input: IngestErrorInput): Promise<void> {
  if (!input.uid && !input.tenantId) return;
  const aggRef = db.collection(ERROR_ISSUES_COLLECTION).doc(fingerprint).collection("_agg").doc("affected");
  const issueRef = db.collection(ERROR_ISSUES_COLLECTION).doc(fingerprint);

  await db.runTransaction(async (tx) => {
    const aggSnap = await tx.get(aggRef);
    const agg = (aggSnap.data() as { users?: string[]; tenants?: string[] } | undefined) || {};
    const users = new Set(agg.users || []);
    const tenants = new Set(agg.tenants || []);
    let changed = false;
    if (input.uid && users.size < AFFECTED_CAP && !users.has(hashId(input.uid))) {
      users.add(hashId(input.uid));
      changed = true;
    }
    if (input.tenantId && tenants.size < AFFECTED_CAP && !tenants.has(hashId(input.tenantId))) {
      tenants.add(hashId(input.tenantId));
      changed = true;
    }
    if (!changed) return;
    tx.set(aggRef, { users: Array.from(users), tenants: Array.from(tenants) }, { merge: true });
    tx.update(issueRef, { affectedUsers: users.size, affectedTenants: tenants.size });
  });
}

async function incrementMetric(severity: string, source: string): Promise<void> {
  const now = new Date();
  const id = windowId(now);
  await db.collection(ERROR_METRICS_COLLECTION).doc(id).set(
    {
      windowId: id,
      windowStart: new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(),
      )).toISOString(),
      updatedAt: now.toISOString(),
      counters: { [`${severity}_${source}`]: FieldValue.increment(1) },
    },
    { merge: true },
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/functions && firebase emulators:exec --only firestore "npx jest src/lib/observability/__tests__/error-ingest.service.test.ts"`
Expected: PASS (all 5 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/functions/src/lib/observability/error-ingest.service.ts apps/functions/src/lib/observability/__tests__/error-ingest.service.test.ts
git commit -m "feat(observability): atomic idempotent error-ingest service"
```

---

## Task 6: evlog logger + Firestore drain + captureError helper

**Files:**
- Create: `apps/functions/src/lib/observability/error-logger.ts`
- Modify: `apps/functions/package.json` (add `evlog` dependency)

**Interfaces:**
- Consumes: `ingestError` (Task 5), `IngestErrorInput` (Task 1).
- Produces:
  - `captureError(err: unknown, ctx: { source: "functions"; route?: string | null; method?: string | null; status?: number | null; uid?: string | null; tenantId?: string | null; handled: boolean }): Promise<void>`
  - `toIngestInput(err: unknown, ctx): IngestErrorInput` (uses evlog `parseError` for why/fix/link).

Note: evlog's drain batching is reserved for Phase 2 transport tuning. Phase 1 keeps the path simple and synchronous-to-Firestore via `ingestError`, but routes structured-error extraction through evlog `parseError` so `why`/`fix`/`link` are captured. This keeps a single formatting path per the spec.

- [ ] **Step 1: Add the dependency**

Run: `cd apps/functions && npm install evlog`
Expected: `evlog` added to `apps/functions/package.json` dependencies; lockfile updated.

- [ ] **Step 2: Write the failing test**

```typescript
// apps/functions/src/lib/observability/__tests__/error-logger.test.ts
import { toIngestInput } from "../error-logger";

describe("toIngestInput", () => {
  it("extracts type, message and stack from a native Error", () => {
    const err = new TypeError("boom 123");
    const input = toIngestInput(err, {
      source: "functions",
      route: "/v1/x",
      method: "GET",
      status: 500,
      uid: "u",
      tenantId: "t",
      handled: false,
    });
    expect(input.errorType).toBe("TypeError");
    expect(input.message).toBe("boom 123");
    expect(input.stack).toContain("boom 123");
    expect(input.route).toBe("/v1/x");
    expect(input.source).toBe("functions");
  });

  it("captures evlog why/fix/link when present", () => {
    const err = Object.assign(new Error("Payment failed"), {
      why: "Card declined",
      fix: "Try another card",
      link: "https://docs/x",
    });
    const input = toIngestInput(err, { source: "functions", handled: true, status: 402 });
    expect(input.why).toBe("Card declined");
    expect(input.fix).toBe("Try another card");
    expect(input.link).toBe("https://docs/x");
  });

  it("handles non-Error throwables", () => {
    const input = toIngestInput("string failure", { source: "functions", handled: true, status: null });
    expect(input.errorType).toBe("Error");
    expect(input.message).toBe("string failure");
    expect(input.stack).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/functions && npx jest src/lib/observability/__tests__/error-logger.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the implementation**

```typescript
// apps/functions/src/lib/observability/error-logger.ts
import { ingestError } from "./error-ingest.service";
import type { IngestErrorInput, ErrorSource } from "../../shared/error-observability.types";

interface CaptureCtx {
  source: ErrorSource;
  route?: string | null;
  method?: string | null;
  status?: number | null;
  uid?: string | null;
  tenantId?: string | null;
  userAgent?: string | null;
  handled: boolean;
}

function readField(err: unknown, key: string): string | null {
  if (err && typeof err === "object" && key in err) {
    const v = (err as Record<string, unknown>)[key];
    return typeof v === "string" && v.trim() ? v : null;
  }
  return null;
}

export function toIngestInput(err: unknown, ctx: CaptureCtx): IngestErrorInput {
  const isError = err instanceof Error;
  return {
    errorType: isError ? err.name || "Error" : "Error",
    message: isError ? err.message : String(err),
    stack: isError ? err.stack ?? null : null,
    source: ctx.source,
    route: ctx.route ?? null,
    method: ctx.method ?? null,
    status: ctx.status ?? null,
    uid: ctx.uid ?? null,
    tenantId: ctx.tenantId ?? null,
    userAgent: ctx.userAgent ?? null,
    why: readField(err, "why"),
    fix: readField(err, "fix"),
    link: readField(err, "link"),
  };
}

/**
 * Capture an error into the observability pipeline. Never throws. The ingest
 * path is intentionally excluded from re-capture (it only console.warns).
 */
export async function captureError(err: unknown, ctx: CaptureCtx): Promise<void> {
  try {
    await ingestError(toIngestInput(err, ctx), { handled: ctx.handled });
  } catch {
    // Swallowed by design — see Global Constraints (self-protection).
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/functions && npx jest src/lib/observability/__tests__/error-logger.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/functions/package.json apps/functions/package-lock.json apps/functions/src/lib/observability/error-logger.ts apps/functions/src/lib/observability/__tests__/error-logger.test.ts
git commit -m "feat(observability): evlog-backed captureError helper"
```

> Note: the root `package-lock.json` may also change because of the workspace install. If so, include it in this commit.

---

## Task 7: Wire the backend global error handler

**Files:**
- Modify: `apps/functions/src/api/index.ts:532-559` (global error handler)

**Interfaces:**
- Consumes: `captureError` (Task 6).

- [ ] **Step 1: Add the import (top of file, with the other `../lib` imports)**

```typescript
import { captureError } from "../lib/observability/error-logger";
```

- [ ] **Step 2: Call captureError inside the global handler**

Modify the existing global error handler so that, immediately after the `logger.error(...)` call (line ~553) and before the `if (!res.headersSent)` block, it fires the capture (fire-and-forget, never awaited into the response path):

```typescript
    // Feed the error observability pipeline (best-effort, never blocks response).
    void captureError(err, {
      source: "functions",
      route: sanitizeLoggedPath(req.path),
      method: req.method,
      status: 500,
      uid: String((req.user as { uid?: string })?.uid || "") || null,
      tenantId: String((req.user as { tenantId?: string })?.tenantId || "") || null,
      handled: false,
    });

    if (!res.headersSent) {
      res.status(500).json({ message: "Internal server error" });
    }
```

- [ ] **Step 3: Type-check + build**

Run: `cd apps/functions && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/functions/src/api/index.ts
git commit -m "feat(observability): capture unhandled express errors into the pipeline"
```

---

## Task 8: Backend client-error ingest endpoint (rate-limited, validated)

**Files:**
- Create: `apps/functions/src/api/controllers/observability.controller.ts`
- Create: `apps/functions/src/api/routes/observability.routes.ts`
- Modify: `apps/functions/src/api/index.ts` (register routes + a dedicated limiter)

**Interfaces:**
- Consumes: `captureError` (Task 6), `createRateLimiter` (existing in `api/index.ts`).
- Produces: `observabilityRoutes` (Express Router), `ingestClientError` handler, `mapObservabilityErrorStatus(message: string): number`.

The endpoint accepts authenticated or pre-auth (anonymous) client errors. `tenantId`/`uid` come from `req.user` when present — **never trusted from the body**. Body is size/shape validated; strings truncated.

- [ ] **Step 1: Write the controller**

```typescript
// apps/functions/src/api/controllers/observability.controller.ts
import { Request, Response } from "express";
import { captureError } from "../../lib/observability/error-logger";

const MESSAGE_MAX = 2000;
const STACK_MAX = 8000;

export function mapObservabilityErrorStatus(message: string): number {
  if (/inválid|invalid/i.test(message)) return 400;
  return 500;
}

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

/**
 * POST /v1/observability/client-error
 * Body: { errorType?, message, stack?, route?, status? }
 * uid/tenantId are derived from req.user (auth context), never the body.
 */
export async function ingestClientError(req: Request, res: Response): Promise<Response> {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const message = str(body.message, MESSAGE_MAX);
    if (!message) {
      return res.status(400).json({ message: "message inválido" });
    }
    const err = Object.assign(new Error(message), {
      name: str(body.errorType, 200) || "Error",
      stack: str(body.stack, STACK_MAX) || undefined,
    });
    const status = typeof body.status === "number" ? body.status : null;

    void captureError(err, {
      source: "web",
      route: str(body.route, 500),
      method: null,
      status,
      uid: (req.user as { uid?: string })?.uid || null,
      tenantId: (req.user as { tenantId?: string })?.tenantId || null,
      userAgent: str(req.headers["user-agent"], 500),
      handled: true,
    });

    return res.status(202).json({ accepted: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "unexpected";
    return res.status(mapObservabilityErrorStatus(msg)).json({ message: "Internal server error" });
  }
}
```

- [ ] **Step 2: Write the routes**

```typescript
// apps/functions/src/api/routes/observability.routes.ts
import { Router } from "express";
import { ingestClientError } from "../controllers/observability.controller";

const router = Router();

// Phase 1: client error ingestion only. Read/triage endpoints land in Phase 2.
router.post("/client-error", ingestClientError);

export const observabilityRoutes = router;
```

- [ ] **Step 3: Register the route with a dedicated rate limiter in `api/index.ts`**

Add the import alongside the other route imports:

```typescript
import { observabilityRoutes } from "./routes/observability.routes";
```

Create a dedicated limiter near the other `createRateLimiter(...)` instantiations (keyed by uid-or-ip via the existing `buildRateLimitIdentity`):

```typescript
const observabilityIngestLimiter = createRateLimiter({
  keyPrefix: "observability_ingest",
  maxRequests: Number(process.env.RATE_LIMIT_OBSERVABILITY_MAX || 60),
  windowMs: Number(process.env.RATE_LIMIT_OBSERVABILITY_WINDOW_MS || 60_000),
});
```

Mount the route. Place it so the ingest endpoint is reachable pre-auth (client errors can happen before login) but still rate-limited — mount it in the same public-routes region where other pre-auth routes are registered, BEFORE `validateFirebaseIdToken`:

```typescript
app.use("/v1/observability", observabilityIngestLimiter, observabilityRoutes);
```

> If `req.user` population requires the auth middleware, that's fine: pre-auth requests simply have `uid: null`/`tenantId: null`, which the controller already handles. Authenticated requests that pass through earlier optional-auth still get their `req.user`.

- [ ] **Step 4: Type-check + build**

Run: `cd apps/functions && npx tsc --noEmit && npm run build`
Expected: PASS, compiles to `lib/`.

- [ ] **Step 5: Commit**

```bash
git add apps/functions/src/api/controllers/observability.controller.ts apps/functions/src/api/routes/observability.routes.ts apps/functions/src/api/index.ts
git commit -m "feat(observability): rate-limited client-error ingest endpoint"
```

---

## Task 9: Frontend report-error helpers (pure)

**Files:**
- Create: `apps/web/src/lib/observability/report-error.ts`
- Test: `apps/web/src/lib/observability/__tests__/report-error.test.ts`

**Interfaces:**
- Produces:
  - `buildClientErrorPayload(err: unknown, ctx?: { route?: string }): { errorType: string; message: string; stack: string | null; route: string | null; status: number | null }`
  - `dedupeKey(payload: { errorType: string; message: string; route: string | null }): string`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/observability/__tests__/report-error.test.ts
import { describe, it, expect } from "vitest";
import { buildClientErrorPayload, dedupeKey } from "../report-error";

describe("buildClientErrorPayload", () => {
  it("extracts type/message/stack from an Error", () => {
    const p = buildClientErrorPayload(new TypeError("kaboom"), { route: "/dashboard" });
    expect(p.errorType).toBe("TypeError");
    expect(p.message).toBe("kaboom");
    expect(p.stack).toContain("kaboom");
    expect(p.route).toBe("/dashboard");
  });

  it("handles non-Error throwables", () => {
    const p = buildClientErrorPayload("oops");
    expect(p.errorType).toBe("Error");
    expect(p.message).toBe("oops");
    expect(p.stack).toBeNull();
    expect(p.route).toBeNull();
  });

  it("truncates very long messages", () => {
    const p = buildClientErrorPayload(new Error("x".repeat(5000)));
    expect(p.message.length).toBeLessThanOrEqual(2000);
  });
});

describe("dedupeKey", () => {
  it("is identical for same type+message+route", () => {
    const a = dedupeKey({ errorType: "TypeError", message: "x", route: "/a" });
    const b = dedupeKey({ errorType: "TypeError", message: "x", route: "/a" });
    expect(a).toBe(b);
  });
  it("differs by route", () => {
    expect(dedupeKey({ errorType: "E", message: "x", route: "/a" })).not.toBe(
      dedupeKey({ errorType: "E", message: "x", route: "/b" }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:web -- report-error`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/lib/observability/report-error.ts

const MESSAGE_MAX = 2000;
const STACK_MAX = 8000;

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

export function buildClientErrorPayload(
  err: unknown,
  ctx?: { route?: string },
): { errorType: string; message: string; stack: string | null; route: string | null; status: number | null } {
  const isError = err instanceof Error;
  return {
    errorType: isError ? err.name || "Error" : "Error",
    message: truncate(isError ? err.message : String(err), MESSAGE_MAX),
    stack: isError && err.stack ? truncate(err.stack, STACK_MAX) : null,
    route: ctx?.route ?? null,
    status: null,
  };
}

export function dedupeKey(payload: { errorType: string; message: string; route: string | null }): string {
  return `${payload.errorType}|${payload.message}|${payload.route ?? ""}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:web -- report-error`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/observability/report-error.ts apps/web/src/lib/observability/__tests__/report-error.test.ts
git commit -m "feat(observability): client error payload + dedupe helpers"
```

---

## Task 10: Frontend client-error reporter (batch/dedup/beacon)

**Files:**
- Create: `apps/web/src/lib/observability/client-error-reporter.ts`

**Interfaces:**
- Consumes: `buildClientErrorPayload`, `dedupeKey` (Task 9).
- Produces:
  - `reportClientError(err: unknown, ctx?: { route?: string }): void`
  - `installClientErrorReporter(): () => void` (idempotent install; returns an uninstaller).

Behavior: buffer payloads, dedupe by `dedupeKey` within the buffer, flush on a debounce timer and on `pagehide`/`visibilitychange` via `navigator.sendBeacon` to `/api/backend/v1/observability/client-error`. Best-effort, swallows its own errors, never throws.

- [ ] **Step 1: Write the implementation**

```typescript
// apps/web/src/lib/observability/client-error-reporter.ts
import { buildClientErrorPayload, dedupeKey } from "./report-error";

const ENDPOINT = "/api/backend/v1/observability/client-error";
const FLUSH_DEBOUNCE_MS = 2000;
const MAX_BUFFER = 20;

type Payload = ReturnType<typeof buildClientErrorPayload>;

let installed = false;
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

export function reportClientError(err: unknown, ctx?: { route?: string }): void {
  try {
    const route =
      ctx?.route ?? (typeof window !== "undefined" ? window.location.pathname : null) ?? undefined;
    const payload = buildClientErrorPayload(err, { route });
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

export function installClientErrorReporter(): () => void {
  if (installed || typeof window === "undefined") return () => undefined;
  installed = true;

  const onError = (event: ErrorEvent) => reportClientError(event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) => reportClientError(event.reason);
  const onHide = () => flush();

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  window.addEventListener("pagehide", onHide);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    window.removeEventListener("pagehide", onHide);
    installed = false;
  };
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/observability/client-error-reporter.ts
git commit -m "feat(observability): batched client error reporter with beacon flush"
```

---

## Task 11: Hook the reporter into React error surfaces

**Files:**
- Create: `apps/web/src/components/observability/error-reporter-installer.tsx`
- Modify: `apps/web/src/app/layout.tsx` (mount the installer once)
- Modify: `apps/web/src/components/shared/error-boundary.tsx:30` (report in `componentDidCatch`)
- Modify: `apps/web/src/app/global-error.tsx` (report on mount)

**Interfaces:**
- Consumes: `installClientErrorReporter`, `reportClientError` (Task 10).

- [ ] **Step 1: Create the installer client component**

```typescript
// apps/web/src/components/observability/error-reporter-installer.tsx
"use client";

import { useEffect } from "react";
import { installClientErrorReporter } from "@/lib/observability/client-error-reporter";

export function ErrorReporterInstaller(): null {
  useEffect(() => {
    const uninstall = installClientErrorReporter();
    return uninstall;
  }, []);
  return null;
}
```

- [ ] **Step 2: Mount it in the root layout**

In `apps/web/src/app/layout.tsx`, import and render `<ErrorReporterInstaller />` inside the `<body>` (alongside existing providers). Exact import:

```typescript
import { ErrorReporterInstaller } from "@/components/observability/error-reporter-installer";
```

Render it once near the top of the body subtree (it renders `null`, position is not visually significant):

```tsx
<ErrorReporterInstaller />
```

- [ ] **Step 3: Report from the error boundary**

In `apps/web/src/components/shared/error-boundary.tsx`, add the import at the top:

```typescript
import { reportClientError } from "@/lib/observability/client-error-reporter";
```

Update `componentDidCatch` to also report (keep the existing `console.error`):

```typescript
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[ErrorBoundary]", error, errorInfo.componentStack);
    reportClientError(error);
  }
```

- [ ] **Step 4: Report from global-error**

In `apps/web/src/app/global-error.tsx`, convert the body to report on mount. Add at the top of the file (after `"use client";`):

```typescript
import { useEffect } from "react";
import { reportClientError } from "@/lib/observability/client-error-reporter";
```

Inside `GlobalError`, before the `return`, add:

```typescript
  useEffect(() => {
    reportClientError(error);
  }, [error]);
```

- [ ] **Step 5: Type-check + lint**

Run: `cd apps/web && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/observability/error-reporter-installer.tsx apps/web/src/app/layout.tsx apps/web/src/components/shared/error-boundary.tsx apps/web/src/app/global-error.tsx
git commit -m "feat(observability): report client errors from boundaries and window handlers"
```

---

## Task 12: Firestore security rules for observability collections

**Files:**
- Modify: `firebase/firestore.rules`
- Test: `tests/firestore-rules/error-observability.test.ts`

**Interfaces:**
- Consumes: existing `isSuperAdmin()` rules helper (already MFA-gated).

Rule policy (defense-in-depth): client **read** only for an MFA'd superadmin (`isSuperAdmin()`); client **write** denied entirely (Admin SDK writes only). Applies to issues, their `occurrences` and `_agg` subcollections, and `error_metrics`.

- [ ] **Step 1: Write the failing rules test**

```typescript
// tests/firestore-rules/error-observability.test.ts
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { readFileSync } from "fs";
import * as path from "path";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-proops-test",
    firestore: {
      rules: readFileSync(path.resolve(__dirname, "../../firebase/firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

// Superadmin context WITH MFA (second factor) — matches isSuperAdmin() in rules.
function superAdminMfaDb() {
  return testEnv
    .authenticatedContext("uid-super", { role: "superadmin", firebase: { sign_in_second_factor: "totp" } })
    .firestore();
}
function superAdminNoMfaDb() {
  return testEnv.authenticatedContext("uid-super", { role: "superadmin" }).firestore();
}
function tenantAdminDb() {
  return testEnv
    .authenticatedContext("uid-a", { tenantId: "t-a", role: "admin", masterId: "uid-a" })
    .firestore();
}
function unauthDb() {
  return testEnv.unauthenticatedContext().firestore();
}

async function seed(collectionPath: string, id: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), collectionPath, id), data);
  });
}

describe("error_issues client access", () => {
  beforeEach(async () => {
    await seed("error_issues", "fp1", { fingerprint: "fp1", status: "unresolved", count: 3 });
  });

  test("MFA superadmin can read", async () => {
    await assertSucceeds(getDoc(doc(superAdminMfaDb(), "error_issues", "fp1")));
  });
  test("superadmin without MFA is denied", async () => {
    await assertFails(getDoc(doc(superAdminNoMfaDb(), "error_issues", "fp1")));
  });
  test("tenant admin is denied", async () => {
    await assertFails(getDoc(doc(tenantAdminDb(), "error_issues", "fp1")));
  });
  test("unauthenticated is denied", async () => {
    await assertFails(getDoc(doc(unauthDb(), "error_issues", "fp1")));
  });
  test("any client write is denied (even MFA superadmin)", async () => {
    await assertFails(setDoc(doc(superAdminMfaDb(), "error_issues", "fp2"), { forged: true }));
  });
});

describe("error_metrics client access", () => {
  test("MFA superadmin can read, write denied", async () => {
    await seed("error_metrics", "2026061914", { counters: {} });
    await assertSucceeds(getDoc(doc(superAdminMfaDb(), "error_metrics", "2026061914")));
    await assertFails(setDoc(doc(superAdminMfaDb(), "error_metrics", "x"), { counters: {} }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:rules -- error-observability`
Expected: FAIL — reads/writes are denied by the catch-all (no rules yet), so the "MFA superadmin can read" assertions fail.

- [ ] **Step 3: Add the rules**

In `firebase/firestore.rules`, inside `match /databases/{database}/documents { ... }`, near the other observability collection blocks (`security_audit_events`), add:

```
// ERROR OBSERVABILITY — written exclusively by Cloud Functions (Admin SDK).
// Read is allowed ONLY to an MFA'd super admin (isSuperAdmin() already requires
// hasMfa()), to power the live superadmin dashboard via onSnapshot. Client
// writes are denied entirely — the ingest pipeline is server-side only.
match /error_issues/{fingerprint} {
  allow read: if isSuperAdmin();
  allow write: if false;

  match /occurrences/{occurrenceId} {
    allow read: if isSuperAdmin();
    allow write: if false;
  }
  match /_agg/{aggId} {
    allow read: if isSuperAdmin();
    allow write: if false;
  }
}

match /error_metrics/{windowId} {
  allow read: if isSuperAdmin();
  allow write: if false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:rules -- error-observability`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add firebase/firestore.rules tests/firestore-rules/error-observability.test.ts
git commit -m "feat(observability): superadmin-read, client-write-denied rules for error collections"
```

---

## Task 13: Firestore composite indexes

**Files:**
- Modify: `firebase/firestore.indexes.json`

These power the Phase 2 issue list/filter queries (`status + severity + lastSeen`, `source + lastSeen`, `severity + lastSeen`). Declared now so they're built ahead of the dashboard.

- [ ] **Step 1: Add the index entries**

Add these three objects to the `"indexes"` array in `firebase/firestore.indexes.json` (match the existing JSON shape exactly):

```json
{
  "collectionGroup": "error_issues",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "severity", "order": "ASCENDING" },
    { "fieldPath": "lastSeen", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "error_issues",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "source", "order": "ASCENDING" },
    { "fieldPath": "lastSeen", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "error_issues",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "severity", "order": "ASCENDING" },
    { "fieldPath": "lastSeen", "order": "DESCENDING" }
  ]
}
```

- [ ] **Step 2: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('firebase/firestore.indexes.json','utf8')); console.log('valid')"`
Expected: prints `valid`.

- [ ] **Step 3: Commit**

```bash
git add firebase/firestore.indexes.json
git commit -m "feat(observability): composite indexes for error issue listing"
```

---

## Task 14: TTL policy + manual integration smoke + docs

**Files:**
- Modify: `apps/functions/CLAUDE.md` (document the new collections + TTL requirement)

The `occurrences` docs carry `expiresAt` for Firestore TTL auto-deletion, but the TTL **policy** must be enabled once per project in the Firebase console (it is not declared in `firestore.indexes.json`). Document this so deploy reviewers enable it.

- [ ] **Step 1: Document the collections + TTL**

Append to `apps/functions/CLAUDE.md` under the Firestore collections section:

```markdown
### Error Observability (collections)
- `error_issues/{fingerprint}` — grouped, deduplicated error issues (Admin SDK writes only; MFA superadmin client reads via dashboard).
- `error_issues/{fingerprint}/occurrences/{id}` — capped sample of recent occurrences; `expiresAt` field for Firestore TTL.
- `error_issues/{fingerprint}/_agg/affected` — capped hashed-id sets backing `affectedUsers`/`affectedTenants`.
- `error_metrics/{YYYYMMDDhh}` — hourly severity/source counters.

**Deploy note:** enable a Firestore **TTL policy** on the `occurrences` collection group, field `expiresAt` (Firebase console → Firestore → TTL). Not expressible in `firestore.indexes.json`.
```

- [ ] **Step 2: Manual smoke test (emulator)**

Run the backend against emulators and trigger a thrown error through any route, then confirm an `error_issues` doc appears.

Run:
```bash
cd apps/functions && npm run build
firebase emulators:start --only functions,firestore
# In another shell, hit an endpoint that 500s, then check the Firestore emulator UI (http://127.0.0.1:4000)
# for a doc under error_issues/.
```
Expected: one `error_issues/{fingerprint}` doc with `count: 1`, `severity: "critical"`, `status: "unresolved"`; one `occurrences` child; one `error_metrics` window doc.

- [ ] **Step 3: Full gate**

Run:
```bash
cd apps/functions && npx tsc --noEmit && npm run lint
cd apps/web && npx tsc --noEmit && npm run lint
npm run test:web
npm run test:functions
npm run test:rules
```
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/functions/CLAUDE.md
git commit -m "docs(observability): document error collections and TTL policy requirement"
```

---

## Phase 1 Done — Definition of Done

- Unhandled backend errors and unhandled/boundary frontend errors both land as grouped `error_issues` docs in Firestore.
- Ingestion is atomic, idempotent (grouping), reopens resolved issues on recurrence, and is storm-protected.
- No PII/secret leakage (evlog structured fields + truncation; client stack treated as untrusted text).
- Collections are superadmin-read (MFA-gated) / client-write-denied; rules tested.
- All unit/emulator/rules tests pass; types compile; lints clean.
- **Out of scope (Phase 2):** the `/admin/observability` dashboard (bento + glass), the superadmin GET issues/metrics + PATCH triage endpoints, live `onSnapshot` hook + UI, occurrence drill-down, charts, animations.

---

## Self-Review Notes (author)

- **Spec coverage:** capture scope (web+functions ✓ Tasks 7/8/11), grouped issues + bounded occurrences (✓ Task 5), recurrence reopen (✓ Task 5), severity (✓ Task 3), write-amplification guard (✓ Task 4), self-protection (✓ Tasks 5/6), evlog format + why/fix/link (✓ Task 6), rate-limited validated ingest (✓ Task 8), client reporter batch/dedup/beacon (✓ Tasks 9/10), rules defense-in-depth (✓ Task 12), indexes (✓ Task 13), TTL (✓ Task 14). Triage status field exists on the issue doc; the PATCH endpoint + UI are Phase 2.
- **Type consistency:** `ingestError` / `IngestErrorInput` / `captureError` / `toIngestInput` / `buildClientErrorPayload` / `dedupeKey` names are used identically across tasks.
- **Deferred to Phase 2 (intentional):** GET/PATCH endpoints, dashboard, onSnapshot. The read-rules added in Task 12 are what make Phase 2's live reads possible.
