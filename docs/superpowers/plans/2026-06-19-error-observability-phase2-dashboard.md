# Error Observability — Phase 2 (Superadmin Dashboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the animated superadmin dashboard at `/admin/observability` that reads the Phase-1 `error_issues`/`error_metrics` data live (Firestore `onSnapshot`), lets the superadmin triage issues (resolve/ignore), and presents it as a distinctive bento + glass interface in the strict mono palette with severity color as the only accent.

**Architecture:** Reads are client-side `onSnapshot` against Firestore (Phase-1 rules already allow MFA-superadmin read; client writes are denied). The only backend addition is a superadmin-gated **triage mutation** endpoint (PUT) that flips an issue's `status` via the Admin SDK and emits a security audit event. The frontend is a set of isolated bento-cell components fed by focused live hooks, with all motion gated behind a `prefers-reduced-motion` guard.

**Tech Stack:** Next.js App Router (React 19), `firebase/firestore` client `onSnapshot`, `motion/react` (the `m` API, already wrapped by the root `MotionProvider`/LazyMotion), Tailwind v4 + `next-themes` (`dark` class), shadcn/ui primitives (`Card`, `Sheet`, `Badge`, `Button`, `Skeleton`, `Tooltip`), Express (Cloud Functions V2), Firebase Admin SDK, Jest (functions), Vitest (web), Playwright (E2E).

## Global Constraints

- **No Sentry.** This is an in-house pipeline. See `docs/superpowers/specs/2026-06-19-superadmin-error-observability-design.md`.
- **Commits:** imperative, lowercase, conventional-commits, single line. **No `Co-Authored-By`. No `--author`.** Never `git push`. Never merge to `main`. PRs target `develop` only.
- **Superadmin only** at three layers: Firestore rules (Phase 1, MFA-gated `isSuperAdmin()`), backend middleware (`isSuperAdminClaim(req)`), and the existing `AdminGuard` (auto-applied to every `/admin/*` route via `apps/web/src/app/admin/layout.tsx`).
- **Multi-tenant:** triage endpoint never trusts `tenantId`/`uid` from the body — `error_issues` are global (cross-tenant) docs read by superadmin only; the triage handler validates only the fingerprint + status.
- **Reads via `onSnapshot`**, never a backend GET (client read rules already permit MFA-superadmin). **Writes via the backend** (client write denied by rules).
- **Palette is strict mono:** `bg-white dark:bg-black`, neutral grays via Tailwind. The ONLY chromatic accent is severity: `critical` → red, `warning` → amber, `error` → neutral/zinc. No teal/brand/gradient-rainbow. (See memory: landing palette is mono.)
- **Motion is mandatory but accessible:** every animation must no-op (instant) under `prefers-reduced-motion: reduce`. Use the `usePrefersReducedMotion` hook from Task 5.
- **`callApi` signature:** `callApi<T>(endpoint, method, body?)` where method ∈ `"GET" | "POST" | "PUT" | "DELETE"`. Triage uses **PUT** (no PATCH). Import: `import { callApi } from "@/lib/api-client"`.
- **Client Firestore:** `import { db } from "@/lib/firebase"`; `import { onSnapshot, collection, doc, query, where, orderBy, limit } from "firebase/firestore"`.
- **`cn`:** `import { cn } from "@/lib/utils"`.
- Test commands: `npm run test:web` (Vitest), `npm run test:functions` (Jest; emulator-gated suites run via `cd apps/functions && npx firebase emulators:exec --only firestore "npx jest <path>"`), `npm run test:rules`.
- **Test resource caps are already configured** (jest/vitest `maxWorkers=2` locally). Do not override them; do not run full suites in parallel.

## Status / severity vocabulary (must match Phase 1 exactly)

- `ErrorSeverity = "critical" | "error" | "warning"`
- `ErrorIssueStatus = "unresolved" | "resolved" | "ignored"`
- `ErrorSource = "web" | "functions"`
- Collections: `error_issues/{fingerprint}`, `error_issues/{fp}/occurrences/{id}`, `error_metrics/{YYYYMMDDhh}` with `counters: { [`${severity}_${source}`]: number }`.

---

## File Structure

**Backend (`apps/functions/src/`):**
- `api/controllers/observability-admin.controller.ts` — `triageIssue` handler + `mapTriageErrorStatus()`.
- `api/routes/observability-admin.routes.ts` — `PUT /issues/:fingerprint/status`.
- Modify `api/index.ts` — mount `observabilityAdminRoutes` under `/v1/admin/observability` behind the existing `privilegedLimiter` (after the auth barrier).
- Test: `api/controllers/__tests__/observability-admin.controller.test.ts` (emulator) — or a focused service test; see Task 1.

**Frontend (`apps/web/src/`):**
- `types/observability.ts` — client-side `ErrorIssue`, `ErrorOccurrence`, `ErrorMetricWindow`, `ErrorSeverity`, `ErrorIssueStatus`, `ErrorSource`, filter types.
- `lib/observability/issue-format.ts` — pure: `severityRank`, `sortIssues`, `relativeTime`, `severityAccent`, `statusLabel`.
- `lib/observability/metrics-heatmap.ts` — pure: `buildHeatmap(windows, hours)` → grid cells.
- `hooks/use-prefers-reduced-motion.ts` — `usePrefersReducedMotion(): boolean`.
- `hooks/use-count-up.ts` — `useCountUp(target, opts?)` motion-based number animation (reduced-motion aware).
- `services/observability-service.ts` — `triageIssue(fingerprint, status)` via `callApi` PUT.
- `app/admin/observability/_hooks/use-error-issues.ts` — live issues list (`onSnapshot` query + filters + optimistic triage).
- `app/admin/observability/_hooks/use-error-metrics.ts` — live hourly metrics (`onSnapshot`).
- `app/admin/observability/_hooks/use-issue-occurrences.ts` — live occurrence sample for the drill-in.
- `app/admin/observability/page.tsx` — the dashboard shell (bento grid).
- `app/admin/observability/_components/` — isolated cells:
  - `hero-metrics.tsx`, `severity-heatmap.tsx`, `issue-list.tsx`, `issue-row.tsx`, `filter-chips.tsx`, `severity-badge.tsx`, `status-pill.tsx`, `issue-drawer.tsx`, `occurrence-sparkline.tsx`, `live-ticker.tsx`, `glass-card.tsx`, `dashboard-skeleton.tsx`.
- Tests: `lib/observability/__tests__/issue-format.test.ts`, `lib/observability/__tests__/metrics-heatmap.test.ts`, `hooks/__tests__/use-prefers-reduced-motion.test.ts`.

**E2E:** `tests/e2e/admin/observability.spec.ts`.

---

## Task 1: Backend triage endpoint

**Files:**
- Create: `apps/functions/src/api/controllers/observability-admin.controller.ts`
- Create: `apps/functions/src/api/routes/observability-admin.routes.ts`
- Modify: `apps/functions/src/api/index.ts` (mount route)
- Test: `apps/functions/src/api/controllers/__tests__/observability-admin.controller.test.ts`

**Interfaces:**
- Consumes: `db` from `../../init`; `isSuperAdminClaim` from `../../lib/request-auth`; `writeSecurityAuditEvent` from `../../lib/security-observability`; `ERROR_ISSUES_COLLECTION` from `../../lib/observability/error-ingest.service`.
- Produces: `triageIssue(req, res)`, `mapTriageErrorStatus(message)`, `observabilityAdminRoutes` (Router).

Behavior: `PUT /v1/admin/observability/issues/:fingerprint/status`, body `{ status: "unresolved" | "resolved" | "ignored" }`. Superadmin-gated. Validates status enum + fingerprint format (40-hex). Updates `error_issues/{fingerprint}`: sets `status`; if `status === "resolved"` sets `resolvedAt = now ISO`, else clears `resolvedAt = null`. 404 if the issue doc doesn't exist. Emits `writeSecurityAuditEvent({ eventType: "observability_issue_triaged", uid, reason: status, source: "observability_admin", route })`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/functions/src/api/controllers/__tests__/observability-admin.controller.test.ts
/**
 * Requires the Firestore emulator on 127.0.0.1:8080.
 * Run: cd apps/functions && npx firebase emulators:exec --only firestore "npx jest src/api/controllers/__tests__/observability-admin.controller.test.ts"
 */
import type { Request, Response } from "express";
import { triageIssue, mapTriageErrorStatus } from "../observability-admin.controller";
import { db } from "../../../init";
import { ERROR_ISSUES_COLLECTION } from "../../../lib/observability/error-ingest.service";

function mockRes() {
  const res: Partial<Response> & { _status?: number; _json?: unknown } = {};
  res.status = ((code: number) => {
    res._status = code;
    return res as Response;
  }) as Response["status"];
  res.json = ((body: unknown) => {
    res._json = body;
    return res as Response;
  }) as Response["json"];
  return res as Response & { _status?: number; _json?: unknown };
}

function superAdminReq(fingerprint: string, status: string): Request {
  return {
    params: { fingerprint },
    body: { status },
    path: `/v1/admin/observability/issues/${fingerprint}/status`,
    user: { uid: "uid-super", isSuperAdmin: true, role: "SUPERADMIN", tenantId: "" },
  } as unknown as Request;
}

const FP = "a".repeat(40);

async function seedIssue(status = "unresolved", resolvedAt: string | null = null) {
  await db.collection(ERROR_ISSUES_COLLECTION).doc(FP).set({
    fingerprint: FP, status, resolvedAt, count: 3, severity: "critical",
  });
}
async function wipe() {
  await db.recursiveDelete(db.collection(ERROR_ISSUES_COLLECTION));
}

describe("mapTriageErrorStatus", () => {
  it("maps invalid to 400, not found to 404, forbidden to 403, else 500", () => {
    expect(mapTriageErrorStatus("status inválido")).toBe(400);
    expect(mapTriageErrorStatus("issue não encontrada")).toBe(404);
    expect(mapTriageErrorStatus("FORBIDDEN_NOT_SUPERADMIN")).toBe(403);
    expect(mapTriageErrorStatus("kaboom")).toBe(500);
  });
});

describe("triageIssue", () => {
  beforeEach(wipe);
  afterAll(wipe);

  it("rejects a non-superadmin with 403", async () => {
    await seedIssue();
    const req = { ...superAdminReq(FP, "resolved"), user: { uid: "u", isSuperAdmin: false, role: "ADMIN", tenantId: "t" } } as unknown as Request;
    const res = mockRes();
    await triageIssue(req, res);
    expect(res._status).toBe(403);
  });

  it("rejects an invalid status with 400", async () => {
    await seedIssue();
    const res = mockRes();
    await triageIssue(superAdminReq(FP, "bogus"), res);
    expect(res._status).toBe(400);
  });

  it("404s when the issue does not exist", async () => {
    const res = mockRes();
    await triageIssue(superAdminReq(FP, "resolved"), res);
    expect(res._status).toBe(404);
  });

  it("resolves an issue: sets status and resolvedAt", async () => {
    await seedIssue();
    const res = mockRes();
    await triageIssue(superAdminReq(FP, "resolved"), res);
    expect(res._status).toBe(200);
    const doc = await db.collection(ERROR_ISSUES_COLLECTION).doc(FP).get();
    expect(doc.data()!.status).toBe("resolved");
    expect(typeof doc.data()!.resolvedAt).toBe("string");
  });

  it("ignoring clears resolvedAt", async () => {
    await seedIssue("resolved", new Date().toISOString());
    const res = mockRes();
    await triageIssue(superAdminReq(FP, "ignored"), res);
    const doc = await db.collection(ERROR_ISSUES_COLLECTION).doc(FP).get();
    expect(doc.data()!.status).toBe("ignored");
    expect(doc.data()!.resolvedAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/functions && npx jest src/api/controllers/__tests__/observability-admin.controller.test.ts`
Expected: FAIL — "Cannot find module '../observability-admin.controller'".

- [ ] **Step 3: Write the controller**

```typescript
// apps/functions/src/api/controllers/observability-admin.controller.ts
import { Request, Response } from "express";
import { db } from "../../init";
import { isSuperAdminClaim } from "../../lib/request-auth";
import { writeSecurityAuditEvent } from "../../lib/security-observability";
import { ERROR_ISSUES_COLLECTION } from "../../lib/observability/error-ingest.service";

const VALID_STATUSES = new Set(["unresolved", "resolved", "ignored"]);
const FINGERPRINT_RE = /^[a-f0-9]{40}$/;

export function mapTriageErrorStatus(message: string): number {
  if (/FORBIDDEN_/.test(message)) return 403;
  if (/não encontrada|not found/i.test(message)) return 404;
  if (/inválid|invalid/i.test(message)) return 400;
  return 500;
}

/**
 * PUT /v1/admin/observability/issues/:fingerprint/status
 * Body: { status: "unresolved" | "resolved" | "ignored" }
 */
export async function triageIssue(req: Request, res: Response): Promise<Response> {
  try {
    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({ message: "Acesso negado." });
    }
    const fingerprint = String(req.params.fingerprint || "");
    if (!FINGERPRINT_RE.test(fingerprint)) {
      return res.status(400).json({ message: "fingerprint inválido" });
    }
    const status = String((req.body || {}).status || "");
    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({ message: "status inválido" });
    }

    const ref = db.collection(ERROR_ISSUES_COLLECTION).doc(fingerprint);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ message: "Issue não encontrada" });
    }

    await ref.update({
      status,
      resolvedAt: status === "resolved" ? new Date().toISOString() : null,
    });

    const uid = (req.user as { uid?: string })?.uid || null;
    void writeSecurityAuditEvent({
      eventType: "observability_issue_triaged",
      uid: uid || undefined,
      reason: status,
      source: "observability_admin",
      route: req.path,
      eventId: fingerprint,
    });

    return res.status(200).json({ success: true, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected";
    return res.status(mapTriageErrorStatus(message)).json({ message: "Erro ao atualizar issue." });
  }
}
```

- [ ] **Step 4: Write the routes**

```typescript
// apps/functions/src/api/routes/observability-admin.routes.ts
import { Router } from "express";
import { triageIssue } from "../controllers/observability-admin.controller";

const router = Router();

router.put("/issues/:fingerprint/status", triageIssue);

export const observabilityAdminRoutes = router;
```

- [ ] **Step 5: Mount the route in `api/index.ts`**

Add the import near the other route imports:

```typescript
import { observabilityAdminRoutes } from "./routes/observability-admin.routes";
```

Mount it behind the existing `privilegedLimiter` and AFTER the `validateFirebaseIdToken` barrier — next to the existing `app.use("/v1/admin", privilegedLimiter, adminRoutes);` line, add:

```typescript
app.use("/v1/admin/observability", privilegedLimiter, observabilityAdminRoutes);
```

(Place it directly after the `app.use("/v1/admin", ...)` line so it sits in the protected region. The handler re-checks `isSuperAdminClaim` regardless.)

- [ ] **Step 6: Run the test under the emulator (capped)**

Run: `cd apps/functions && npx firebase emulators:exec --only firestore "npx jest src/api/controllers/__tests__/observability-admin.controller.test.ts"`
Expected: PASS (all cases). If port 8080 is busy, stop the stale emulator first; do not weaken the test.

- [ ] **Step 7: Type-check + build**

Run: `cd apps/functions && npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/functions/src/api/controllers/observability-admin.controller.ts apps/functions/src/api/routes/observability-admin.routes.ts apps/functions/src/api/index.ts apps/functions/src/api/controllers/__tests__/observability-admin.controller.test.ts
git commit -m "feat(observability): superadmin issue triage endpoint"
```

---

## Task 2: Client types

**Files:**
- Create: `apps/web/src/types/observability.ts`

**Interfaces:**
- Produces: `ErrorSeverity`, `ErrorSource`, `ErrorIssueStatus`, `ErrorIssue`, `ErrorOccurrence`, `ErrorMetricWindow`, `IssueFilters`.

- [ ] **Step 1: Write the types**

```typescript
// apps/web/src/types/observability.ts
export type ErrorSeverity = "critical" | "error" | "warning";
export type ErrorSource = "web" | "functions";
export type ErrorIssueStatus = "unresolved" | "resolved" | "ignored";

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
  firstSeen: string;
  lastSeen: string;
  resolvedAt: string | null;
  affectedUsers: number;
  affectedTenants: number;
  tenantIds: string[];
  sampleStack: string;
  why: string | null;
  fix: string | null;
  link: string | null;
}

export interface ErrorOccurrence {
  id: string;
  uid: string | null;
  tenantId: string | null;
  route: string | null;
  method: string | null;
  status: number | null;
  stack: string;
  userAgent: string | null;
  createdAt: string;
}

export interface ErrorMetricWindow {
  windowId: string; // YYYYMMDDhh
  windowStart: string; // ISO
  counters: Record<string, number>; // `${severity}_${source}` -> count
}

export interface IssueFilters {
  status: ErrorIssueStatus | "all";
  severity: ErrorSeverity | "all";
  source: ErrorSource | "all";
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/types/observability.ts
git commit -m "feat(observability): client types for dashboard"
```

---

## Task 3: Pure issue-format helpers

**Files:**
- Create: `apps/web/src/lib/observability/issue-format.ts`
- Test: `apps/web/src/lib/observability/__tests__/issue-format.test.ts`

**Interfaces:**
- Consumes: `ErrorIssue`, `ErrorSeverity` (Task 2).
- Produces:
  - `severityRank(s: ErrorSeverity): number`
  - `sortIssues(issues: ErrorIssue[]): ErrorIssue[]` — by severity desc then lastSeen desc
  - `relativeTime(iso: string, now?: number): string`
  - `severityAccent(s: ErrorSeverity): { text: string; border: string; dot: string }` — Tailwind class fragments
  - `statusLabel(s: ErrorIssueStatus): string`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/observability/__tests__/issue-format.test.ts
import { describe, it, expect } from "vitest";
import { severityRank, sortIssues, relativeTime, severityAccent, statusLabel } from "../issue-format";
import type { ErrorIssue } from "@/types/observability";

function issue(p: Partial<ErrorIssue>): ErrorIssue {
  return {
    fingerprint: "f", errorType: "E", title: "t", normalizedMessage: "m",
    source: "functions", route: null, method: null, severity: "error",
    status: "unresolved", count: 1, firstSeen: "2026-06-19T10:00:00.000Z",
    lastSeen: "2026-06-19T10:00:00.000Z", resolvedAt: null, affectedUsers: 0,
    affectedTenants: 0, tenantIds: [], sampleStack: "", why: null, fix: null, link: null,
    ...p,
  };
}

describe("severityRank", () => {
  it("ranks critical > error > warning", () => {
    expect(severityRank("critical")).toBeGreaterThan(severityRank("error"));
    expect(severityRank("error")).toBeGreaterThan(severityRank("warning"));
  });
});

describe("sortIssues", () => {
  it("orders by severity desc then lastSeen desc", () => {
    const a = issue({ fingerprint: "a", severity: "warning", lastSeen: "2026-06-19T12:00:00.000Z" });
    const b = issue({ fingerprint: "b", severity: "critical", lastSeen: "2026-06-19T09:00:00.000Z" });
    const c = issue({ fingerprint: "c", severity: "critical", lastSeen: "2026-06-19T11:00:00.000Z" });
    const out = sortIssues([a, b, c]).map((i) => i.fingerprint);
    expect(out).toEqual(["c", "b", "a"]);
  });
  it("does not mutate the input array", () => {
    const arr = [issue({ fingerprint: "a" }), issue({ fingerprint: "b" })];
    const copy = [...arr];
    sortIssues(arr);
    expect(arr).toEqual(copy);
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-06-19T12:00:00.000Z");
  it("formats seconds/minutes/hours/days", () => {
    expect(relativeTime("2026-06-19T11:59:30.000Z", now)).toBe("30s atrás");
    expect(relativeTime("2026-06-19T11:30:00.000Z", now)).toBe("30min atrás");
    expect(relativeTime("2026-06-19T09:00:00.000Z", now)).toBe("3h atrás");
    expect(relativeTime("2026-06-16T12:00:00.000Z", now)).toBe("3d atrás");
  });
});

describe("severityAccent", () => {
  it("returns red fragments for critical, amber for warning, zinc for error", () => {
    expect(severityAccent("critical").dot).toContain("red");
    expect(severityAccent("warning").dot).toContain("amber");
    expect(severityAccent("error").dot).toContain("zinc");
  });
});

describe("statusLabel", () => {
  it("maps to PT-BR labels", () => {
    expect(statusLabel("unresolved")).toBe("Não resolvido");
    expect(statusLabel("resolved")).toBe("Resolvido");
    expect(statusLabel("ignored")).toBe("Ignorado");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:web -- issue-format`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/lib/observability/issue-format.ts
import type { ErrorIssue, ErrorSeverity, ErrorIssueStatus } from "@/types/observability";

const RANK: Record<ErrorSeverity, number> = { warning: 1, error: 2, critical: 3 };

export function severityRank(s: ErrorSeverity): number {
  return RANK[s] ?? 0;
}

export function sortIssues(issues: ErrorIssue[]): ErrorIssue[] {
  return [...issues].sort((a, b) => {
    const r = severityRank(b.severity) - severityRank(a.severity);
    if (r !== 0) return r;
    return Date.parse(b.lastSeen) - Date.parse(a.lastSeen);
  });
}

export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - Date.parse(iso));
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

export function severityAccent(s: ErrorSeverity): { text: string; border: string; dot: string } {
  switch (s) {
    case "critical":
      return { text: "text-red-500", border: "border-red-500/40", dot: "bg-red-500" };
    case "warning":
      return { text: "text-amber-500", border: "border-amber-500/40", dot: "bg-amber-500" };
    default:
      return { text: "text-zinc-400", border: "border-zinc-500/30", dot: "bg-zinc-400" };
  }
}

export function statusLabel(s: ErrorIssueStatus): string {
  switch (s) {
    case "resolved":
      return "Resolvido";
    case "ignored":
      return "Ignorado";
    default:
      return "Não resolvido";
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:web -- issue-format`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/observability/issue-format.ts apps/web/src/lib/observability/__tests__/issue-format.test.ts
git commit -m "feat(observability): pure issue formatting helpers"
```

---

## Task 4: Pure metrics-heatmap helper

**Files:**
- Create: `apps/web/src/lib/observability/metrics-heatmap.ts`
- Test: `apps/web/src/lib/observability/__tests__/metrics-heatmap.test.ts`

**Interfaces:**
- Consumes: `ErrorMetricWindow`, `ErrorSeverity` (Task 2).
- Produces:
  - `HeatCell = { windowId: string; severity: ErrorSeverity; total: number; intensity: number }`
  - `buildHeatmap(windows: ErrorMetricWindow[], severities?: ErrorSeverity[]): HeatCell[]` — one cell per (window × severity), `total` summed across sources, `intensity` = total / maxTotal (0..1).

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/observability/__tests__/metrics-heatmap.test.ts
import { describe, it, expect } from "vitest";
import { buildHeatmap } from "../metrics-heatmap";
import type { ErrorMetricWindow } from "@/types/observability";

const windows: ErrorMetricWindow[] = [
  { windowId: "2026061910", windowStart: "2026-06-19T10:00:00.000Z", counters: { critical_functions: 4, critical_web: 1, warning_web: 2 } },
  { windowId: "2026061911", windowStart: "2026-06-19T11:00:00.000Z", counters: { error_functions: 1 } },
];

describe("buildHeatmap", () => {
  it("sums a severity across both sources per window", () => {
    const cells = buildHeatmap(windows, ["critical", "error", "warning"]);
    const c = cells.find((x) => x.windowId === "2026061910" && x.severity === "critical");
    expect(c!.total).toBe(5); // 4 functions + 1 web
  });

  it("normalizes intensity to the max total (0..1)", () => {
    const cells = buildHeatmap(windows, ["critical", "error", "warning"]);
    const max = Math.max(...cells.map((c) => c.total));
    const top = cells.find((c) => c.total === max)!;
    expect(top.intensity).toBe(1);
    const zero = cells.find((c) => c.total === 0)!;
    expect(zero.intensity).toBe(0);
  });

  it("produces windows.length * severities.length cells", () => {
    const cells = buildHeatmap(windows, ["critical", "error", "warning"]);
    expect(cells.length).toBe(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:web -- metrics-heatmap`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/lib/observability/metrics-heatmap.ts
import type { ErrorMetricWindow, ErrorSeverity } from "@/types/observability";

export interface HeatCell {
  windowId: string;
  severity: ErrorSeverity;
  total: number;
  intensity: number;
}

const DEFAULT_SEVERITIES: ErrorSeverity[] = ["critical", "error", "warning"];

export function buildHeatmap(
  windows: ErrorMetricWindow[],
  severities: ErrorSeverity[] = DEFAULT_SEVERITIES,
): HeatCell[] {
  const raw: Omit<HeatCell, "intensity">[] = [];
  for (const w of windows) {
    for (const sev of severities) {
      const total =
        (w.counters[`${sev}_functions`] || 0) + (w.counters[`${sev}_web`] || 0);
      raw.push({ windowId: w.windowId, severity: sev, total });
    }
  }
  const max = raw.reduce((m, c) => Math.max(m, c.total), 0);
  return raw.map((c) => ({ ...c, intensity: max === 0 ? 0 : c.total / max }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:web -- metrics-heatmap`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/observability/metrics-heatmap.ts apps/web/src/lib/observability/__tests__/metrics-heatmap.test.ts
git commit -m "feat(observability): heatmap aggregation helper"
```

---

## Task 5: prefers-reduced-motion hook

**Files:**
- Create: `apps/web/src/hooks/use-prefers-reduced-motion.ts`
- Test: `apps/web/src/hooks/__tests__/use-prefers-reduced-motion.test.ts`

**Interfaces:**
- Produces: `usePrefersReducedMotion(): boolean`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/hooks/__tests__/use-prefers-reduced-motion.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePrefersReducedMotion } from "../use-prefers-reduced-motion";

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }));
}

describe("usePrefersReducedMotion", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("returns true when the user prefers reduced motion", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it("returns false otherwise", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:web -- use-prefers-reduced-motion`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/hooks/use-prefers-reduced-motion.ts
"use client";

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(QUERY);
    setReduced(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:web -- use-prefers-reduced-motion`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-prefers-reduced-motion.ts apps/web/src/hooks/__tests__/use-prefers-reduced-motion.test.ts
git commit -m "feat(observability): prefers-reduced-motion hook"
```

---

## Task 6: count-up hook

**Files:**
- Create: `apps/web/src/hooks/use-count-up.ts`

**Interfaces:**
- Consumes: `usePrefersReducedMotion` (Task 5); `motion/react` (`animate`, `useMotionValue`, `useTransform`).
- Produces: `useCountUp(target: number, opts?: { duration?: number }): MotionValue<number>` (rounded integer motion value). Under reduced motion it jumps straight to `target`.

No unit test (it's a thin motion wrapper); verified via tsc + its consumer (Task 8) and E2E. This is a UI-glue hook — keep it tiny.

- [ ] **Step 1: Write the implementation**

```typescript
// apps/web/src/hooks/use-count-up.ts
"use client";

import { useEffect } from "react";
import { animate, useMotionValue, useTransform, type MotionValue } from "motion/react";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

export function useCountUp(target: number, opts?: { duration?: number }): MotionValue<number> {
  const raw = useMotionValue(0);
  const rounded = useTransform(raw, (v) => Math.round(v));
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) {
      raw.set(target);
      return;
    }
    const controls = animate(raw, target, {
      duration: opts?.duration ?? 1.1,
      ease: [0.2, 0.65, 0.3, 0.9],
    });
    return () => controls.stop();
  }, [target, reduced, raw, opts?.duration]);

  return rounded;
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/use-count-up.ts
git commit -m "feat(observability): reduced-motion-aware count-up hook"
```

---

## Task 7: observability service (triage) + live hooks

**Files:**
- Create: `apps/web/src/services/observability-service.ts`
- Create: `apps/web/src/app/admin/observability/_hooks/use-error-issues.ts`
- Create: `apps/web/src/app/admin/observability/_hooks/use-error-metrics.ts`
- Create: `apps/web/src/app/admin/observability/_hooks/use-issue-occurrences.ts`

**Interfaces:**
- Consumes: `callApi` from `@/lib/api-client`; `db` from `@/lib/firebase`; `firebase/firestore` query API; Task 2 types; `sortIssues` (Task 3).
- Produces:
  - `ObservabilityService.triageIssue(fingerprint: string, status: ErrorIssueStatus): Promise<void>`
  - `useErrorIssues(filters: IssueFilters): { issues: ErrorIssue[]; isLoading: boolean; triage: (fp: string, status: ErrorIssueStatus) => Promise<void> }`
  - `useErrorMetrics(hours?: number): { windows: ErrorMetricWindow[]; isLoading: boolean }`
  - `useIssueOccurrences(fingerprint: string | null): { occurrences: ErrorOccurrence[]; isLoading: boolean }`

No standalone unit test (Firestore-SDK + React-effect glue; covered by E2E in Task 12). Keep each hook focused and correct; follow the existing `onSnapshot` cleanup pattern.

- [ ] **Step 1: Write the service**

```typescript
// apps/web/src/services/observability-service.ts
import { callApi } from "@/lib/api-client";
import type { ErrorIssueStatus } from "@/types/observability";

export const ObservabilityService = {
  triageIssue: async (fingerprint: string, status: ErrorIssueStatus): Promise<void> => {
    await callApi(`/v1/admin/observability/issues/${fingerprint}/status`, "PUT", { status });
  },
};
```

- [ ] **Step 2: Write the issues hook**

```typescript
// apps/web/src/app/admin/observability/_hooks/use-error-issues.ts
"use client";

import * as React from "react";
import { collection, onSnapshot, query, orderBy, limit, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ObservabilityService } from "@/services/observability-service";
import { sortIssues } from "@/lib/observability/issue-format";
import type { ErrorIssue, ErrorIssueStatus, IssueFilters } from "@/types/observability";

const MAX_ISSUES = 200;

export function useErrorIssues(filters: IssueFilters) {
  const [issues, setIssues] = React.useState<ErrorIssue[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    setIsLoading(true);
    const clauses = [orderBy("lastSeen", "desc"), limit(MAX_ISSUES)];
    if (filters.status !== "all") clauses.unshift(where("status", "==", filters.status));
    if (filters.severity !== "all") clauses.unshift(where("severity", "==", filters.severity));
    if (filters.source !== "all") clauses.unshift(where("source", "==", filters.source));
    const q = query(collection(db, "error_issues"), ...clauses);
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ ...(d.data() as ErrorIssue), fingerprint: d.id }));
        setIssues(sortIssues(rows));
        setIsLoading(false);
      },
      () => setIsLoading(false),
    );
    return () => unsub();
  }, [filters.status, filters.severity, filters.source]);

  const triage = React.useCallback(async (fp: string, status: ErrorIssueStatus) => {
    // Optimistic — the onSnapshot stream will reconcile to server truth.
    setIssues((prev) => prev.map((i) => (i.fingerprint === fp ? { ...i, status } : i)));
    try {
      await ObservabilityService.triageIssue(fp, status);
    } catch (err) {
      // Reconciliation happens via onSnapshot; surface the error to the caller.
      throw err;
    }
  }, []);

  return { issues, isLoading, triage };
}
```

> Note: the `where + orderBy` combinations are backed by the Phase-1 composite indexes (`status+severity+lastSeen`, `source+lastSeen`, `severity+lastSeen`). A status-only or severity-only filter with `orderBy(lastSeen)` is covered by those indexes; if the emulator/console requests an additional single-field combination, add it to `firebase/firestore.indexes.json` in this task and note it in the commit.

- [ ] **Step 3: Write the metrics hook**

```typescript
// apps/web/src/app/admin/observability/_hooks/use-error-metrics.ts
"use client";

import * as React from "react";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ErrorMetricWindow } from "@/types/observability";

export function useErrorMetrics(hours = 24) {
  const [windows, setWindows] = React.useState<ErrorMetricWindow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const q = query(collection(db, "error_metrics"), orderBy("windowId", "desc"), limit(hours));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ ...(d.data() as ErrorMetricWindow), windowId: d.id }));
        setWindows(rows.reverse()); // chronological for the heatmap
        setIsLoading(false);
      },
      () => setIsLoading(false),
    );
    return () => unsub();
  }, [hours]);

  return { windows, isLoading };
}
```

- [ ] **Step 4: Write the occurrences hook**

```typescript
// apps/web/src/app/admin/observability/_hooks/use-issue-occurrences.ts
"use client";

import * as React from "react";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ErrorOccurrence } from "@/types/observability";

export function useIssueOccurrences(fingerprint: string | null) {
  const [occurrences, setOccurrences] = React.useState<ErrorOccurrence[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!fingerprint) {
      setOccurrences([]);
      return;
    }
    setIsLoading(true);
    const q = query(
      collection(db, "error_issues", fingerprint, "occurrences"),
      orderBy("createdAt", "desc"),
      limit(50),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setOccurrences(snap.docs.map((d) => ({ ...(d.data() as ErrorOccurrence), id: d.id })));
        setIsLoading(false);
      },
      () => setIsLoading(false),
    );
    return () => unsub();
  }, [fingerprint]);

  return { occurrences, isLoading };
}
```

- [ ] **Step 5: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/services/observability-service.ts apps/web/src/app/admin/observability/_hooks/
git commit -m "feat(observability): triage service and live data hooks"
```

---

## Task 8: Presentational primitives — glass-card, severity-badge, status-pill, skeleton

**Files:**
- Create: `apps/web/src/app/admin/observability/_components/glass-card.tsx`
- Create: `apps/web/src/app/admin/observability/_components/severity-badge.tsx`
- Create: `apps/web/src/app/admin/observability/_components/status-pill.tsx`
- Create: `apps/web/src/app/admin/observability/_components/dashboard-skeleton.tsx`

**Interfaces:**
- Consumes: `cn` (`@/lib/utils`); `severityAccent`, `statusLabel` (Task 3); Task 2 types.
- Produces (named exports): `GlassCard`, `SeverityBadge`, `StatusPill`, `DashboardSkeleton`.

Design: mono palette. `GlassCard` = the bento cell shell — translucent layered surface: `bg-white/70 dark:bg-white/[0.03]`, `backdrop-blur-xl`, `border border-black/10 dark:border-white/10`, `rounded-2xl`, subtle inset ring + shadow; an optional `accent` prop adds a thin top severity line. `SeverityBadge` = a dot + label using `severityAccent`. `StatusPill` = small rounded pill, neutral styling, label from `statusLabel`.

- [ ] **Step 1: Write `glass-card.tsx`**

```tsx
// apps/web/src/app/admin/observability/_components/glass-card.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { ErrorSeverity } from "@/types/observability";
import { severityAccent } from "@/lib/observability/issue-format";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  accent?: ErrorSeverity;
}

export function GlassCard({ accent, className, children, ...rest }: GlassCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-black/10 bg-white/70 shadow-sm",
        "backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]",
        "ring-1 ring-inset ring-white/40 dark:ring-white/5",
        className,
      )}
      {...rest}
    >
      {accent && (
        <span
          aria-hidden
          className={cn("absolute inset-x-0 top-0 h-px", severityAccent(accent).dot)}
        />
      )}
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Write `severity-badge.tsx`**

```tsx
// apps/web/src/app/admin/observability/_components/severity-badge.tsx
"use client";

import { cn } from "@/lib/utils";
import type { ErrorSeverity } from "@/types/observability";
import { severityAccent } from "@/lib/observability/issue-format";

const LABEL: Record<ErrorSeverity, string> = {
  critical: "Crítico",
  error: "Erro",
  warning: "Alerta",
};

export function SeverityBadge({ severity, className }: { severity: ErrorSeverity; className?: string }) {
  const a = severityAccent(severity);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", a.text, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", a.dot)} />
      {LABEL[severity]}
    </span>
  );
}
```

- [ ] **Step 3: Write `status-pill.tsx`**

```tsx
// apps/web/src/app/admin/observability/_components/status-pill.tsx
"use client";

import { cn } from "@/lib/utils";
import type { ErrorIssueStatus } from "@/types/observability";
import { statusLabel } from "@/lib/observability/issue-format";

export function StatusPill({ status, className }: { status: ErrorIssueStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        status === "unresolved" && "border-black/15 text-black/70 dark:border-white/20 dark:text-white/70",
        status === "resolved" && "border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
        status === "ignored" && "border-black/10 text-black/40 line-through dark:border-white/10 dark:text-white/40",
        className,
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
```

> Note: `resolved` uses emerald only as a status affordance (not a severity accent) — acceptable; severity colors stay red/amber/zinc.

- [ ] **Step 4: Write `dashboard-skeleton.tsx`**

```tsx
// apps/web/src/app/admin/observability/_components/dashboard-skeleton.tsx
"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { GlassCard } from "./glass-card";

export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <GlassCard key={i} className="h-40 p-5">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="mt-4 h-20 w-full" />
        </GlassCard>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Type-check + lint**

Run: `cd apps/web && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/admin/observability/_components/glass-card.tsx apps/web/src/app/admin/observability/_components/severity-badge.tsx apps/web/src/app/admin/observability/_components/status-pill.tsx apps/web/src/app/admin/observability/_components/dashboard-skeleton.tsx
git commit -m "feat(observability): bento glass primitives and badges"
```

---

## Task 9: Hero metrics + severity heatmap cells

**Files:**
- Create: `apps/web/src/app/admin/observability/_components/hero-metrics.tsx`
- Create: `apps/web/src/app/admin/observability/_components/severity-heatmap.tsx`

**Interfaces:**
- Consumes: `useCountUp` (Task 6), `GlassCard` (Task 8), `buildHeatmap` (Task 4), `severityAccent` (Task 3), `motion/react` (`m`), Task 2 types. Receives data as props (the page wires hooks).
- Produces: `HeroMetrics({ openIssues, events24h, affectedTenants })`, `SeverityHeatmap({ windows })`.

Design: `HeroMetrics` = three big mono numbers (count-up via `useCountUp`, rendered through `m.span` reading the MotionValue) with small uppercase tracking labels; the "open issues" figure tinted by the worst current severity is out of scope — keep numbers mono, labels gray. `SeverityHeatmap` = a CSS grid of cells (rows = severity, cols = hour window); each cell background opacity scales with `intensity` over the severity's accent color; hover lifts the cell (spring) and shows a tooltip with the count. Both respect reduced motion (count-up hook already does; heatmap hover is CSS-cheap).

- [ ] **Step 1: Write `hero-metrics.tsx`**

```tsx
// apps/web/src/app/admin/observability/_components/hero-metrics.tsx
"use client";

import { m } from "motion/react";
import { GlassCard } from "./glass-card";
import { useCountUp } from "@/hooks/use-count-up";

function Stat({ label, value }: { label: string; value: number }) {
  const v = useCountUp(value);
  return (
    <GlassCard className="flex flex-col justify-between p-5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/50 dark:text-white/50">
        {label}
      </span>
      <m.span className="mt-3 text-5xl font-bold tabular-nums tracking-tight text-black dark:text-white">
        {v}
      </m.span>
    </GlassCard>
  );
}

export function HeroMetrics({
  openIssues,
  events24h,
  affectedTenants,
}: {
  openIssues: number;
  events24h: number;
  affectedTenants: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Stat label="Issues abertas" value={openIssues} />
      <Stat label="Eventos / 24h" value={events24h} />
      <Stat label="Tenants afetados" value={affectedTenants} />
    </div>
  );
}
```

> Note: `m.span` renders the `MotionValue<number>` child directly — `motion` subscribes and updates the text node without React re-renders.

- [ ] **Step 2: Write `severity-heatmap.tsx`**

```tsx
// apps/web/src/app/admin/observability/_components/severity-heatmap.tsx
"use client";

import { m } from "motion/react";
import { cn } from "@/lib/utils";
import { GlassCard } from "./glass-card";
import { buildHeatmap } from "@/lib/observability/metrics-heatmap";
import { severityAccent } from "@/lib/observability/issue-format";
import type { ErrorMetricWindow, ErrorSeverity } from "@/types/observability";

const SEVERITIES: ErrorSeverity[] = ["critical", "error", "warning"];
const ROW_LABEL: Record<ErrorSeverity, string> = { critical: "Crítico", error: "Erro", warning: "Alerta" };

export function SeverityHeatmap({ windows }: { windows: ErrorMetricWindow[] }) {
  const cells = buildHeatmap(windows, SEVERITIES);
  const cols = windows.length || 1;

  return (
    <GlassCard className="p-5">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/50 dark:text-white/50">
        Severidade por hora
      </h2>
      <div className="mt-4 space-y-1.5">
        {SEVERITIES.map((sev) => (
          <div key={sev} className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-right text-[11px] text-black/40 dark:text-white/40">
              {ROW_LABEL[sev]}
            </span>
            <div
              className="grid flex-1 gap-1"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {cells
                .filter((c) => c.severity === sev)
                .map((c) => (
                  <m.div
                    key={c.windowId}
                    title={`${c.total} eventos`}
                    whileHover={{ scale: 1.18, transition: { type: "spring", stiffness: 400, damping: 18 } }}
                    className={cn("h-6 rounded-[4px] border border-black/5 dark:border-white/5", severityAccent(sev).dot)}
                    style={{ opacity: 0.12 + c.intensity * 0.88 }}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
```

- [ ] **Step 3: Type-check + lint**

Run: `cd apps/web && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/admin/observability/_components/hero-metrics.tsx apps/web/src/app/admin/observability/_components/severity-heatmap.tsx
git commit -m "feat(observability): hero count-up metrics and severity heatmap"
```

---

## Task 10: Filter chips, issue row + list, live ticker

**Files:**
- Create: `apps/web/src/app/admin/observability/_components/filter-chips.tsx`
- Create: `apps/web/src/app/admin/observability/_components/issue-row.tsx`
- Create: `apps/web/src/app/admin/observability/_components/issue-list.tsx`
- Create: `apps/web/src/app/admin/observability/_components/live-ticker.tsx`

**Interfaces:**
- Consumes: `GlassCard`, `SeverityBadge`, `StatusPill` (Task 8); `relativeTime` (Task 3); `motion/react` (`m`, `AnimatePresence`); `usePrefersReducedMotion` (Task 5); Task 2 types.
- Produces:
  - `FilterChips({ filters, onChange })`
  - `IssueRow({ issue, onSelect })`
  - `IssueList({ issues, filters, onChange, onSelect })`
  - `LiveTicker({ latest })` — animates the newest issue title in.

Design: `FilterChips` = three segmented chip groups (status / severity / source) in mono, active chip filled black/white-inverse. `IssueRow` = a row in a `GlassCard`-less compact list: severity dot, title (truncate), route mono, count, `relativeTime`, `StatusPill`; hover does a subtle parallax lift (`m.div whileHover y:-2`). `IssueList` = header (count + `FilterChips`) + the rows, with `AnimatePresence` so new/removed rows animate (gated by reduced motion → no layout animation). `LiveTicker` = a single line that crossfades the most-recent issue title as it changes.

- [ ] **Step 1: Write `filter-chips.tsx`**

```tsx
// apps/web/src/app/admin/observability/_components/filter-chips.tsx
"use client";

import { cn } from "@/lib/utils";
import type { IssueFilters, ErrorIssueStatus, ErrorSeverity, ErrorSource } from "@/types/observability";

type Group = { key: keyof IssueFilters; options: { value: string; label: string }[] };

const GROUPS: Group[] = [
  { key: "status", options: [
    { value: "all", label: "Todos" }, { value: "unresolved", label: "Abertos" },
    { value: "resolved", label: "Resolvidos" }, { value: "ignored", label: "Ignorados" }] },
  { key: "severity", options: [
    { value: "all", label: "Toda severidade" }, { value: "critical", label: "Crítico" },
    { value: "error", label: "Erro" }, { value: "warning", label: "Alerta" }] },
  { key: "source", options: [
    { value: "all", label: "Tudo" }, { value: "functions", label: "Backend" }, { value: "web", label: "Web" }] },
];

export function FilterChips({ filters, onChange }: { filters: IssueFilters; onChange: (f: IssueFilters) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      {GROUPS.map((g) => (
        <div key={g.key} className="flex flex-wrap gap-1">
          {g.options.map((o) => {
            const active = filters[g.key] === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange({ ...filters, [g.key]: o.value as ErrorIssueStatus & ErrorSeverity & ErrorSource })}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-black/15 text-black/60 hover:border-black/40 dark:border-white/15 dark:text-white/60 dark:hover:border-white/40",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write `issue-row.tsx`**

```tsx
// apps/web/src/app/admin/observability/_components/issue-row.tsx
"use client";

import { m } from "motion/react";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "./severity-badge";
import { StatusPill } from "./status-pill";
import { relativeTime, severityAccent } from "@/lib/observability/issue-format";
import type { ErrorIssue } from "@/types/observability";

export function IssueRow({ issue, onSelect }: { issue: ErrorIssue; onSelect: (i: ErrorIssue) => void }) {
  return (
    <m.button
      type="button"
      onClick={() => onSelect(issue)}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left",
        "hover:border-black/10 hover:bg-black/[0.02] dark:hover:border-white/10 dark:hover:bg-white/[0.03]",
      )}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", severityAccent(issue.severity).dot)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-black dark:text-white">{issue.title}</span>
        <span className="block truncate font-mono text-[11px] text-black/40 dark:text-white/40">
          {issue.method ? `${issue.method} ` : ""}{issue.route ?? "—"}
        </span>
      </span>
      <span className="hidden shrink-0 text-xs tabular-nums text-black/50 dark:text-white/50 sm:block">
        {issue.count}×
      </span>
      <span className="hidden shrink-0 text-xs text-black/40 dark:text-white/40 md:block">
        {relativeTime(issue.lastSeen)}
      </span>
      <StatusPill status={issue.status} className="shrink-0" />
      <SeverityBadge severity={issue.severity} className="hidden shrink-0 lg:inline-flex" />
    </m.button>
  );
}
```

- [ ] **Step 3: Write `issue-list.tsx`**

```tsx
// apps/web/src/app/admin/observability/_components/issue-list.tsx
"use client";

import { AnimatePresence, m } from "motion/react";
import { GlassCard } from "./glass-card";
import { FilterChips } from "./filter-chips";
import { IssueRow } from "./issue-row";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { ErrorIssue, IssueFilters } from "@/types/observability";

export function IssueList({
  issues,
  filters,
  onChange,
  onSelect,
}: {
  issues: ErrorIssue[];
  filters: IssueFilters;
  onChange: (f: IssueFilters) => void;
  onSelect: (i: ErrorIssue) => void;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <GlassCard className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/50 dark:text-white/50">
          Issues ({issues.length})
        </h2>
        <FilterChips filters={filters} onChange={onChange} />
      </div>
      <div className="mt-3 flex flex-col">
        {issues.length === 0 && (
          <p className="py-10 text-center text-sm text-black/40 dark:text-white/40">Nenhuma issue.</p>
        )}
        <AnimatePresence initial={false}>
          {issues.map((issue) => (
            <m.div
              key={issue.fingerprint}
              layout={!reduced}
              initial={reduced ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
            >
              <IssueRow issue={issue} onSelect={onSelect} />
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </GlassCard>
  );
}
```

- [ ] **Step 4: Write `live-ticker.tsx`**

```tsx
// apps/web/src/app/admin/observability/_components/live-ticker.tsx
"use client";

import { AnimatePresence, m } from "motion/react";
import { cn } from "@/lib/utils";
import { severityAccent } from "@/lib/observability/issue-format";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { ErrorIssue } from "@/types/observability";

export function LiveTicker({ latest }: { latest: ErrorIssue | null }) {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="flex h-6 items-center gap-2 overflow-hidden text-xs text-black/50 dark:text-white/50">
      <span className="shrink-0 font-semibold uppercase tracking-[0.18em]">Ao vivo</span>
      <AnimatePresence mode="wait">
        {latest && (
          <m.span
            key={latest.fingerprint + latest.lastSeen}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex min-w-0 items-center gap-1.5"
          >
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", severityAccent(latest.severity).dot)} />
            <span className="truncate">{latest.title}</span>
          </m.span>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 5: Type-check + lint**

Run: `cd apps/web && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/admin/observability/_components/filter-chips.tsx apps/web/src/app/admin/observability/_components/issue-row.tsx apps/web/src/app/admin/observability/_components/issue-list.tsx apps/web/src/app/admin/observability/_components/live-ticker.tsx
git commit -m "feat(observability): filter chips, animated issue list and live ticker"
```

---

## Task 11: Issue drawer (drill-in) + occurrence sparkline + dashboard page

**Files:**
- Create: `apps/web/src/app/admin/observability/_components/occurrence-sparkline.tsx`
- Create: `apps/web/src/app/admin/observability/_components/issue-drawer.tsx`
- Create: `apps/web/src/app/admin/observability/page.tsx`

**Interfaces:**
- Consumes: `Sheet` family from `@/components/ui/sheet`; `Button` from `@/components/ui/button`; `useIssueOccurrences` (Task 7); `useErrorIssues`, `useErrorMetrics` (Task 7); `HeroMetrics`, `SeverityHeatmap`, `IssueList`, `LiveTicker`, `SeverityBadge`, `StatusPill`, `DashboardSkeleton` (Tasks 8-10); `relativeTime` (Task 3); Task 2 types.
- Produces: `OccurrenceSparkline({ occurrences })`, `IssueDrawer({ issue, onClose, onTriage })`, default `ObservabilityPage`.

Design: `IssueDrawer` uses shadcn `Sheet` (right side, glass background) — header with severity + title; sections: route/method, `why`/`fix`/`link` (evlog structured fields, shown only when present), full `sampleStack` in a mono scroll box, affected users/tenants counters, an `OccurrenceSparkline` (bars of recent occurrences over time), and triage actions (Resolver / Ignorar / Reabrir) wired to `onTriage`. `OccurrenceSparkline` = simple inline bars from occurrence timestamps bucketed; no chart lib. The page composes the bento grid and owns filter state + selected issue.

- [ ] **Step 1: Write `occurrence-sparkline.tsx`**

```tsx
// apps/web/src/app/admin/observability/_components/occurrence-sparkline.tsx
"use client";

import { cn } from "@/lib/utils";
import type { ErrorOccurrence } from "@/types/observability";

// Buckets the last N occurrences into 12 columns by recency and renders bars.
export function OccurrenceSparkline({ occurrences }: { occurrences: ErrorOccurrence[] }) {
  const BUCKETS = 12;
  const counts = new Array(BUCKETS).fill(0);
  if (occurrences.length > 0) {
    const times = occurrences.map((o) => Date.parse(o.createdAt));
    const min = Math.min(...times);
    const max = Math.max(...times);
    const span = Math.max(1, max - min);
    for (const t of times) {
      const idx = Math.min(BUCKETS - 1, Math.floor(((t - min) / span) * BUCKETS));
      counts[idx] += 1;
    }
  }
  const peak = Math.max(1, ...counts);
  return (
    <div className="flex h-12 items-end gap-1">
      {counts.map((c, i) => (
        <div
          key={i}
          className={cn("flex-1 rounded-sm bg-black/70 dark:bg-white/70")}
          style={{ height: `${(c / peak) * 100}%`, minHeight: 2 }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write `issue-drawer.tsx`**

```tsx
// apps/web/src/app/admin/observability/_components/issue-drawer.tsx
"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "./severity-badge";
import { StatusPill } from "./status-pill";
import { OccurrenceSparkline } from "./occurrence-sparkline";
import { useIssueOccurrences } from "../_hooks/use-issue-occurrences";
import { relativeTime } from "@/lib/observability/issue-format";
import type { ErrorIssue, ErrorIssueStatus } from "@/types/observability";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-black/40 dark:text-white/40">{label}</p>
      <p className="mt-0.5 text-sm text-black/80 dark:text-white/80">{value}</p>
    </div>
  );
}

export function IssueDrawer({
  issue,
  onClose,
  onTriage,
}: {
  issue: ErrorIssue | null;
  onClose: () => void;
  onTriage: (fp: string, status: ErrorIssueStatus) => void;
}) {
  const { occurrences } = useIssueOccurrences(issue?.fingerprint ?? null);
  return (
    <Sheet open={!!issue} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto border-l border-black/10 bg-white/80 backdrop-blur-2xl dark:border-white/10 dark:bg-black/80 sm:max-w-xl">
        {issue && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <SeverityBadge severity={issue.severity} />
                <StatusPill status={issue.status} />
              </div>
              <SheetTitle className="mt-1 text-left text-lg leading-snug text-black dark:text-white">
                {issue.title}
              </SheetTitle>
            </SheetHeader>

            <div className="mt-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Rota" value={`${issue.method ?? ""} ${issue.route ?? "—"}`.trim()} />
                <Field label="Origem" value={issue.source === "functions" ? "Backend" : "Web"} />
                <Field label="Ocorrências" value={`${issue.count}`} />
                <Field label="Visto" value={`${relativeTime(issue.firstSeen)} → ${relativeTime(issue.lastSeen)}`} />
                <Field label="Usuários afetados" value={`${issue.affectedUsers}`} />
                <Field label="Tenants afetados" value={`${issue.affectedTenants}`} />
              </div>

              {(issue.why || issue.fix || issue.link) && (
                <div className="space-y-2 rounded-xl border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
                  {issue.why && <Field label="Por quê" value={issue.why} />}
                  {issue.fix && <Field label="Como corrigir" value={issue.fix} />}
                  {issue.link && (
                    <a href={issue.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline">
                      Documentação
                    </a>
                  )}
                </div>
              )}

              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-black/40 dark:text-white/40">
                  Ocorrências recentes
                </p>
                <OccurrenceSparkline occurrences={occurrences} />
              </div>

              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-black/40 dark:text-white/40">Stack</p>
                <pre className="max-h-60 overflow-auto rounded-lg bg-black/90 p-3 font-mono text-[11px] leading-relaxed text-white/90">
                  {issue.sampleStack || "—"}
                </pre>
              </div>

              <div className="flex gap-2 border-t border-black/10 pt-4 dark:border-white/10">
                {issue.status !== "resolved" && (
                  <Button size="sm" onClick={() => onTriage(issue.fingerprint, "resolved")}>Resolver</Button>
                )}
                {issue.status !== "ignored" && (
                  <Button size="sm" variant="outline" onClick={() => onTriage(issue.fingerprint, "ignored")}>Ignorar</Button>
                )}
                {issue.status !== "unresolved" && (
                  <Button size="sm" variant="ghost" onClick={() => onTriage(issue.fingerprint, "unresolved")}>Reabrir</Button>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Write the dashboard page**

```tsx
// apps/web/src/app/admin/observability/page.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { useErrorIssues } from "./_hooks/use-error-issues";
import { useErrorMetrics } from "./_hooks/use-error-metrics";
import { HeroMetrics } from "./_components/hero-metrics";
import { SeverityHeatmap } from "./_components/severity-heatmap";
import { IssueList } from "./_components/issue-list";
import { LiveTicker } from "./_components/live-ticker";
import { IssueDrawer } from "./_components/issue-drawer";
import { DashboardSkeleton } from "./_components/dashboard-skeleton";
import type { ErrorIssue, ErrorIssueStatus, IssueFilters } from "@/types/observability";

export default function ObservabilityPage() {
  const [filters, setFilters] = React.useState<IssueFilters>({ status: "all", severity: "all", source: "all" });
  const [selected, setSelected] = React.useState<ErrorIssue | null>(null);
  const { issues, isLoading, triage } = useErrorIssues(filters);
  const { windows } = useErrorMetrics(24);

  const openIssues = React.useMemo(() => issues.filter((i) => i.status === "unresolved").length, [issues]);
  const events24h = React.useMemo(
    () => windows.reduce((sum, w) => sum + Object.values(w.counters).reduce((a, b) => a + b, 0), 0),
    [windows],
  );
  const affectedTenants = React.useMemo(
    () => issues.reduce((max, i) => Math.max(max, i.affectedTenants), 0),
    [issues],
  );

  const onTriage = React.useCallback(
    async (fp: string, status: ErrorIssueStatus) => {
      try {
        await triage(fp, status);
        toast.success("Issue atualizada");
        setSelected((prev) => (prev && prev.fingerprint === fp ? { ...prev, status } : prev));
      } catch {
        toast.error("Falha ao atualizar issue");
      }
    },
    [triage],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white">Observabilidade</h1>
        <LiveTicker latest={issues[0] ?? null} />
      </header>

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-4">
          <HeroMetrics openIssues={openIssues} events24h={events24h} affectedTenants={affectedTenants} />
          <SeverityHeatmap windows={windows} />
          <IssueList issues={issues} filters={filters} onChange={setFilters} onSelect={setSelected} />
        </div>
      )}

      <IssueDrawer issue={selected} onClose={() => setSelected(null)} onTriage={onTriage} />
    </div>
  );
}
```

> Note: confirm `sonner`'s `toast` is the project's toast (the admin hook used `toast.error` from `sonner`). If the project imports toast elsewhere, match that import.

- [ ] **Step 4: Type-check + lint**

Run: `cd apps/web && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 5: Build**

Run: `cd apps/web && npm run build`
Expected: PASS (route `/admin/observability` compiles).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/admin/observability/_components/occurrence-sparkline.tsx apps/web/src/app/admin/observability/_components/issue-drawer.tsx apps/web/src/app/admin/observability/page.tsx
git commit -m "feat(observability): issue drawer, sparkline and dashboard page"
```

---

## Task 12: E2E + admin nav link + full gate

**Files:**
- Create: `tests/e2e/admin/observability.spec.ts`
- Modify: the admin navigation surface to add a link to `/admin/observability` (find the existing admin nav/menu — likely in `apps/web/src/app/admin/_components/` or a shared admin header; if none exists, add a simple link on `apps/web/src/app/admin/page.tsx`).

**Interfaces:**
- Consumes: the existing E2E auth/seed helpers in `tests/e2e/` (mirror an existing admin spec).

- [ ] **Step 1: Add the nav link**

Locate how the existing `/admin` and `/admin/overview` routes are linked (search `apps/web/src/app/admin` for `Link` to `/admin/overview`). Add an equivalent `Link` to `/admin/observability` labeled "Observabilidade" in the same nav surface. If there is genuinely no shared admin nav, add a small `Link` card at the top of `apps/web/src/app/admin/page.tsx`:

```tsx
import Link from "next/link";
// ...within the page header area:
<Link href="/admin/observability" className="text-sm font-medium text-black underline dark:text-white">
  Observabilidade →
</Link>
```

- [ ] **Step 2: Write the E2E spec**

Read an existing admin E2E spec under `tests/e2e/` first to reuse the exact superadmin login/seed helpers and `test.describe` structure, then write:

```typescript
// tests/e2e/admin/observability.spec.ts
import { test, expect } from "@playwright/test";
// Reuse the project's existing auth helpers — mirror the imports used by other admin specs
// (e.g. loginAsSuperAdmin / seeding). Replace the placeholders below with the real helpers
// discovered in tests/e2e.

test.describe("Admin observability dashboard", () => {
  test("non-superadmin is redirected away from /admin/observability", async ({ page }) => {
    // log in as a normal (non-superadmin) user via the existing helper
    // await loginAsUser(page);
    await page.goto("/admin/observability");
    await expect(page).toHaveURL(/\/403|\/login|\/dashboard/);
  });

  test("superadmin sees the dashboard shell", async ({ page }) => {
    // await loginAsSuperAdmin(page);
    await page.goto("/admin/observability");
    await expect(page.getByRole("heading", { name: "Observabilidade" })).toBeVisible();
    await expect(page.getByText("Issues abertas")).toBeVisible();
  });
});
```

> The exact auth helper names must come from the existing E2E suite — do not invent them. If the suite has a `loginAsSuperAdmin` fixture, use it; otherwise follow whatever pattern the neighboring admin spec uses. The two assertions above only require the shell to render (no seeded data), so they are stable.

- [ ] **Step 3: Run the E2E spec (capped — Playwright is already `workers: 1`)**

Run: `npm run test:e2e -- observability`
Expected: PASS. (Requires emulators + dev server per the project's E2E setup; if the harness can't run E2E in this environment, note it and rely on the build + unit/rules gate. Do not weaken assertions.)

- [ ] **Step 4: Full gate (sequential, capped)**

Run each, capture results:
```bash
cd apps/functions && npx tsc --noEmit && npm run lint
cd apps/web && npx tsc --noEmit && npm run lint
npm run test:web
cd apps/functions && npx firebase emulators:exec --only firestore "npx jest src/api/controllers/__tests__/observability-admin.controller.test.ts"
npx firebase emulators:exec --only firestore "npm run test:rules"
```
Expected: all PASS. Do not run suites concurrently (resource caps).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/admin/observability.spec.ts apps/web/src/app/admin
git commit -m "test(observability): e2e dashboard access + admin nav link"
```

---

## Phase 2 — Definition of Done

- `/admin/observability` renders a distinctive bento + glass mono dashboard: count-up hero metrics, severity heatmap, live-updating filterable issue list, drill-in drawer (stack, why/fix/link, occurrence sparkline, affected counts), and a live ticker.
- All reads are live `onSnapshot`; triage (resolve/ignore/reopen) goes through the superadmin-gated PUT endpoint and reconciles via the stream.
- Every animation is gated by `prefers-reduced-motion`.
- Superadmin-only at rules + middleware + `AdminGuard`.
- Pure helpers unit-tested (Vitest); triage endpoint emulator-tested (Jest); access E2E (Playwright); full gate green.

---

## Self-Review (author)

- **Spec coverage:** dashboard route + AdminGuard ✓ (Task 11/12); hero count-up ✓ (Task 9); severity heatmap ✓ (Task 9); issue list + filters + status pills ✓ (Task 10); drill-in panel with stack/why/fix/link/occurrence timeline/affected ✓ (Task 11); resolve/ignore triage with optimistic + server reconcile ✓ (Tasks 7/11); live ticker + reduced-motion ✓ (Tasks 5/10); mono palette + severity accent ✓ (Tasks 3/8); backend triage endpoint superadmin-gated + audit event ✓ (Task 1); composite indexes already exist from Phase 1 ✓ (note in Task 7).
- **Deferred/clarified:** reads use `onSnapshot` not backend GET (per the spec's chosen read path + Phase-1 rules), so the spec's GET issues/metrics endpoints are intentionally not built — the dashboard reads Firestore directly. Triage is PUT (callApi has no PATCH).
- **Type consistency:** `ErrorIssue`/`ErrorOccurrence`/`ErrorMetricWindow`/`IssueFilters`/`ErrorSeverity`/`ErrorIssueStatus`/`ErrorSource` names are identical across types, helpers, hooks, and components. `triageIssue(fingerprint, status)` and `useErrorIssues(filters)` signatures are stable across service/hook/page.
- **YAGNI:** no charting lib (inline sparkline + CSS heatmap), no virtualization lib (capped at 200 issues), no GET endpoints.
