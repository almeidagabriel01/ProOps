# Observability UX & Error Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface full per-occurrence error detail (who/where/browser/stack) and add server-backed search/filter/sort to the super admin observability dashboard.

**Architecture:** Two new read-only superadmin-gated backend endpoints (batch identity-resolve + history search). Frontend keeps live `onSnapshot` occurrence streaming, resolves user/tenant names lazily via the batch endpoint (cached in a Map), parses userAgent client-side, and redesigns the issue drawer into an occurrences table with click-to-expand per-event stacks. A new filter bar drives a live-vs-query mode in `useErrorIssues`.

**Tech Stack:** Next.js 16 / React 19 / TypeScript (web, Vitest), Firebase Cloud Functions V2 / Express / Firebase Admin SDK (functions, Jest), Firestore, shadcn/ui.

## Global Constraints

- Commit messages: imperative, lowercase, no period. No `Co-Authored-By`. No `--author` override. Hooks stay ON (no `--no-verify`).
- Never run `git push`. One logical commit per completed task.
- Backend: every new endpoint validates `isSuperAdminClaim(req)` → 403 otherwise. Never trust `tenantId`/`uid` from request body for the caller's identity.
- Web services call `/api/backend/*` via `callApi` only — never Firestore writes, never raw Cloud Functions URLs. Direct Firestore client reads are allowed only where already established (observability live reads).
- Never log tokens, passwords, CPF, full emails, phone numbers.
- File naming: kebab-case files, PascalCase components, camelCase functions.
- TypeScript strict — no `any` without a justification comment.

---

### Task 1: Client userAgent parser

**Files:**
- Create: `apps/web/src/lib/observability/parse-user-agent.ts`
- Test: `apps/web/src/lib/observability/__tests__/parse-user-agent.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseUserAgent(ua: string | null): { browser: string; os: string; device: string }`. Unknown parts → `"Desconhecido"`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/observability/__tests__/parse-user-agent.test.ts
import { describe, it, expect } from "vitest";
import { parseUserAgent } from "../parse-user-agent";

describe("parseUserAgent", () => {
  it("parses Chrome on Windows desktop", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
    expect(parseUserAgent(ua)).toEqual({ browser: "Chrome", os: "Windows", device: "Desktop" });
  });

  it("parses Safari on iPhone", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
    expect(parseUserAgent(ua)).toEqual({ browser: "Safari", os: "iOS", device: "Mobile" });
  });

  it("parses Firefox on Android", () => {
    const ua = "Mozilla/5.0 (Android 14; Mobile; rv:124.0) Gecko/124.0 Firefox/124.0";
    expect(parseUserAgent(ua)).toEqual({ browser: "Firefox", os: "Android", device: "Mobile" });
  });

  it("returns Desconhecido for null", () => {
    expect(parseUserAgent(null)).toEqual({
      browser: "Desconhecido",
      os: "Desconhecido",
      device: "Desconhecido",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/observability/__tests__/parse-user-agent.test.ts`
Expected: FAIL — `parse-user-agent` not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/web/src/lib/observability/parse-user-agent.ts
const UNKNOWN = "Desconhecido";

export interface ParsedUserAgent {
  browser: string;
  os: string;
  device: string;
}

export function parseUserAgent(ua: string | null): ParsedUserAgent {
  if (!ua) return { browser: UNKNOWN, os: UNKNOWN, device: UNKNOWN };

  // Order matters: Edge/Opera masquerade as Chrome; Chrome contains Safari token.
  const browser =
    /Edg\//.test(ua) ? "Edge"
      : /OPR\/|Opera/.test(ua) ? "Opera"
      : /Firefox\//.test(ua) ? "Firefox"
      : /Chrome\//.test(ua) ? "Chrome"
      : /Safari\//.test(ua) ? "Safari"
      : UNKNOWN;

  const os =
    /iPhone|iPad|iPod/.test(ua) ? "iOS"
      : /Android/.test(ua) ? "Android"
      : /Windows/.test(ua) ? "Windows"
      : /Mac OS X|Macintosh/.test(ua) ? "macOS"
      : /Linux/.test(ua) ? "Linux"
      : UNKNOWN;

  const device =
    /iPad|Tablet/.test(ua) ? "Tablet"
      : /Mobile|iPhone|Android/.test(ua) ? "Mobile"
      : "Desktop";

  return { browser, os, device };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/observability/__tests__/parse-user-agent.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/observability/parse-user-agent.ts apps/web/src/lib/observability/__tests__/parse-user-agent.test.ts
git commit -m "feat(observability): add client user-agent parser"
```

---

### Task 2: Frontend types

**Files:**
- Modify: `apps/web/src/types/observability.ts`

**Interfaces:**
- Consumes: existing `ErrorIssueStatus`, `ErrorSeverity`, `ErrorSource`, `ErrorOccurrence`.
- Produces: `ResolvedUser`, `ResolvedTenant`, `IssueSort`, `IssueTimeRange`, expanded `IssueFilters`, `ResolveIdentitiesResponse`, `IssueSearchResponse`.

- [ ] **Step 1: Replace the `IssueFilters` interface and append new types**

Replace the existing `IssueFilters` block (lines 47-51) with:

```typescript
export interface ResolvedUser {
  name: string;
  email: string;
}

export interface ResolvedTenant {
  name: string;
}

export type IssueSort = "recent" | "frequent" | "newest";
export type IssueTimeRange = "1h" | "24h" | "7d" | "30d" | "all";

export interface IssueFilters {
  status: ErrorIssueStatus | "all";
  severity: ErrorSeverity | "all";
  source: ErrorSource | "all";
  errorType: string | "all";
  q: string;
  range: IssueTimeRange;
  sort: IssueSort;
}

export interface ResolveIdentitiesResponse {
  users: Record<string, ResolvedUser>;
  tenants: Record<string, ResolvedTenant>;
}

export interface IssueSearchResponse {
  issues: ErrorIssue[];
  nextCursor: string | null;
}

export const DEFAULT_ISSUE_FILTERS: IssueFilters = {
  status: "all",
  severity: "all",
  source: "all",
  errorType: "all",
  q: "",
  range: "all",
  sort: "recent",
};
```

- [ ] **Step 2: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: errors only in files that still construct the old `IssueFilters` shape (`page.tsx`, `issue-list.tsx`, `filter-chips.tsx`). These are fixed in later tasks. No errors inside `types/observability.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/types/observability.ts
git commit -m "feat(observability): expand issue filter and resolve types"
```

---

### Task 3: Backend batch identity-resolve endpoint

**Files:**
- Create: `apps/functions/src/api/controllers/__tests__/observability-resolve.controller.test.ts`
- Modify: `apps/functions/src/api/controllers/observability-admin.controller.ts` (append `resolveIdentities`)
- Modify: `apps/functions/src/api/routes/observability-admin.routes.ts` (add route)

**Interfaces:**
- Consumes: `db` from `../../init`, `isSuperAdminClaim` from `../../lib/request-auth`.
- Produces: `resolveIdentities(req, res)`. Route `POST /v1/admin/observability/resolve-identities`, body `{ uids: string[]; tenantIds: string[] }`, response `{ users: Record<uid,{name,email}>, tenants: Record<id,{name}> }`. Cap 100 ids each.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/functions/src/api/controllers/__tests__/observability-resolve.controller.test.ts
process.env.NODE_ENV = "test";

const mockUserGet = jest.fn();
const mockTenantGet = jest.fn();

jest.mock("../../../init", () => ({
  db: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: name === "users" ? () => mockUserGet(id) : () => mockTenantGet(id),
      }),
    }),
  },
  auth: {},
  adminApp: {},
}));

import { Request, Response } from "express";
import { resolveIdentities } from "../observability-admin.controller";

function mockRes() {
  const res: Partial<Response> & { _status?: number; _json?: unknown } = {};
  res.status = ((code: number) => { res._status = code; return res as Response; }) as Response["status"];
  res.json = ((body: unknown) => { res._json = body; return res as Response; }) as Response["json"];
  return res as Response & { _status?: number; _json?: unknown };
}

function superReq(body: unknown): Request {
  return { body, user: { uid: "u", isSuperAdmin: true, role: "SUPERADMIN", tenantId: "" } } as unknown as Request;
}

beforeEach(() => {
  mockUserGet.mockReset();
  mockTenantGet.mockReset();
});

it("rejects non-superadmin with 403", async () => {
  const req = { body: { uids: [], tenantIds: [] }, user: { isSuperAdmin: false } } as unknown as Request;
  const res = mockRes();
  await resolveIdentities(req, res);
  expect(res._status).toBe(403);
});

it("resolves users and tenants, dedups repeated ids, omits missing docs", async () => {
  mockUserGet.mockImplementation((id: string) =>
    Promise.resolve(
      id === "u1"
        ? { exists: true, data: () => ({ name: "Alice", email: "a@x.com" }) }
        : { exists: false, data: () => undefined },
    ),
  );
  mockTenantGet.mockImplementation((id: string) =>
    Promise.resolve({ exists: true, data: () => ({ name: id === "t1" ? "Acme" : "Other" }) }),
  );

  const res = mockRes();
  await resolveIdentities(superReq({ uids: ["u1", "u1", "u2"], tenantIds: ["t1"] }), res);

  expect(res._status).toBe(200);
  expect(mockUserGet).toHaveBeenCalledTimes(2); // deduped u1
  expect((res._json as { users: Record<string, unknown> }).users).toEqual({
    u1: { name: "Alice", email: "a@x.com" },
  });
  expect((res._json as { tenants: Record<string, unknown> }).tenants).toEqual({
    t1: { name: "Acme" },
  });
});

it("returns 400 when uids is not an array", async () => {
  const res = mockRes();
  await resolveIdentities(superReq({ uids: "nope", tenantIds: [] }), res);
  expect(res._status).toBe(400);
});

it("returns 400 when over the 100-id cap", async () => {
  const res = mockRes();
  const uids = Array.from({ length: 101 }, (_, i) => `u${i}`);
  await resolveIdentities(superReq({ uids, tenantIds: [] }), res);
  expect(res._status).toBe(400);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/functions && npx jest --config jest.config.js src/api/controllers/__tests__/observability-resolve.controller.test.ts`
Expected: FAIL — `resolveIdentities` is not exported.

- [ ] **Step 3: Append the controller function**

Add to the end of `apps/functions/src/api/controllers/observability-admin.controller.ts`:

```typescript
const ID_CAP = 100;

/**
 * POST /v1/admin/observability/resolve-identities
 * Body: { uids: string[]; tenantIds: string[] }
 * Resolves uid -> {name,email} and tenantId -> {name}. Superadmin only.
 */
export async function resolveIdentities(req: Request, res: Response): Promise<Response> {
  try {
    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({ message: "Acesso negado." });
    }
    const body = (req.body || {}) as { uids?: unknown; tenantIds?: unknown };
    if (!Array.isArray(body.uids) || !Array.isArray(body.tenantIds)) {
      return res.status(400).json({ message: "uids e tenantIds inválidos" });
    }
    const uids = [...new Set(body.uids.filter((x): x is string => typeof x === "string"))];
    const tenantIds = [...new Set(body.tenantIds.filter((x): x is string => typeof x === "string"))];
    if (uids.length > ID_CAP || tenantIds.length > ID_CAP) {
      return res.status(400).json({ message: "limite de ids excedido" });
    }

    const users: Record<string, { name: string; email: string }> = {};
    const tenants: Record<string, { name: string }> = {};

    await Promise.all([
      ...uids.map(async (uid) => {
        const snap = await db.collection("users").doc(uid).get();
        if (snap.exists) {
          const d = snap.data() as { name?: string; email?: string };
          users[uid] = { name: d.name || "—", email: d.email || "—" };
        }
      }),
      ...tenantIds.map(async (id) => {
        const snap = await db.collection("tenants").doc(id).get();
        if (snap.exists) {
          const d = snap.data() as { name?: string };
          tenants[id] = { name: d.name || "—" };
        }
      }),
    ]);

    return res.status(200).json({ users, tenants });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected";
    return res.status(mapTriageErrorStatus(message)).json({ message: "Erro ao resolver identidades." });
  }
}
```

- [ ] **Step 4: Add the route**

In `apps/functions/src/api/routes/observability-admin.routes.ts`, update imports and add the route:

```typescript
import { Router } from "express";
import { triageIssue, resolveIdentities } from "../controllers/observability-admin.controller";

const router = Router();

router.put("/issues/:fingerprint/status", triageIssue);
router.post("/resolve-identities", resolveIdentities);

export const observabilityAdminRoutes = router;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/functions && npx jest --config jest.config.js src/api/controllers/__tests__/observability-resolve.controller.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/functions/src/api/controllers/observability-admin.controller.ts apps/functions/src/api/routes/observability-admin.routes.ts apps/functions/src/api/controllers/__tests__/observability-resolve.controller.test.ts
git commit -m "feat(observability): add batch identity-resolve endpoint"
```

---

### Task 4: Backend issue search/query endpoint

**Files:**
- Create: `apps/functions/src/api/controllers/__tests__/observability-search.controller.test.ts`
- Modify: `apps/functions/src/api/controllers/observability-admin.controller.ts` (append `searchIssues` + helpers)
- Modify: `apps/functions/src/api/routes/observability-admin.routes.ts` (add route)

**Approach:** Order by one auto-indexed field (`lastSeen`/`count`/`firstSeen`), scan a bounded page, then in-memory filter by status/severity/source/errorType/`q`/time-range. No composite indexes required. Cursor = base64 `{v,id}` of the last *scanned* doc for `startAfter(v, id)`.

**Interfaces:**
- Consumes: `db`, `isSuperAdminClaim`, `ERROR_ISSUES_COLLECTION` from `../../lib/observability/error-ingest.service`.
- Produces: `searchIssues(req, res)`. Route `GET /v1/admin/observability/issues`. Query: `status, severity, source, errorType, q, from, to, sort, limit, cursor`. Response `{ issues: ErrorIssue[], nextCursor: string | null }`.
- Also exports pure helper `matchesFilters(issue, f)` and `encodeCursor`/`decodeCursor` for unit testing.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/functions/src/api/controllers/__tests__/observability-search.controller.test.ts
process.env.NODE_ENV = "test";

jest.mock("../../../init", () => ({ db: {}, auth: {}, adminApp: {} }));
jest.mock("../../../lib/observability/error-ingest.service", () => ({
  ERROR_ISSUES_COLLECTION: "error_issues",
}));

import { matchesFilters, encodeCursor, decodeCursor } from "../observability-admin.controller";

const base = {
  fingerprint: "f", errorType: "TypeError", title: "Cannot read x", normalizedMessage: "cannot read x",
  source: "web", route: "/v1/proposals", method: "POST", severity: "error", status: "unresolved",
  count: 3, firstSeen: "2026-06-19T00:00:00Z", lastSeen: "2026-06-20T00:00:00Z",
};

it("matches when all filters are 'all'/empty", () => {
  expect(matchesFilters(base as never, { status: "all", severity: "all", source: "all", errorType: "all", q: "", from: null, to: null })).toBe(true);
});

it("filters by status and severity", () => {
  expect(matchesFilters(base as never, { status: "resolved", severity: "all", source: "all", errorType: "all", q: "", from: null, to: null })).toBe(false);
  expect(matchesFilters(base as never, { status: "all", severity: "error", source: "all", errorType: "all", q: "", from: null, to: null })).toBe(true);
});

it("q matches title or route, case-insensitive", () => {
  expect(matchesFilters(base as never, { status: "all", severity: "all", source: "all", errorType: "all", q: "CANNOT", from: null, to: null })).toBe(true);
  expect(matchesFilters(base as never, { status: "all", severity: "all", source: "all", errorType: "all", q: "proposals", from: null, to: null })).toBe(true);
  expect(matchesFilters(base as never, { status: "all", severity: "all", source: "all", errorType: "all", q: "nope", from: null, to: null })).toBe(false);
});

it("filters by lastSeen time range", () => {
  expect(matchesFilters(base as never, { status: "all", severity: "all", source: "all", errorType: "all", q: "", from: "2026-06-20T12:00:00Z", to: null })).toBe(false);
  expect(matchesFilters(base as never, { status: "all", severity: "all", source: "all", errorType: "all", q: "", from: "2026-06-19T12:00:00Z", to: null })).toBe(true);
});

it("cursor round-trips", () => {
  const c = encodeCursor({ v: "2026-06-20T00:00:00Z", id: "f" });
  expect(decodeCursor(c)).toEqual({ v: "2026-06-20T00:00:00Z", id: "f" });
  expect(decodeCursor(null)).toBeNull();
  expect(decodeCursor("!!!not-base64-json")).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/functions && npx jest --config jest.config.js src/api/controllers/__tests__/observability-search.controller.test.ts`
Expected: FAIL — `matchesFilters`/`encodeCursor`/`decodeCursor` not exported.

- [ ] **Step 3: Append helpers + controller**

Add to the end of `apps/functions/src/api/controllers/observability-admin.controller.ts` (it already imports `db`, `isSuperAdminClaim`, `ERROR_ISSUES_COLLECTION`):

```typescript
interface SearchFilterCriteria {
  status: string;
  severity: string;
  source: string;
  errorType: string;
  q: string;
  from: string | null;
  to: string | null;
}

interface IssueRecord {
  title?: string;
  route?: string | null;
  status?: string;
  severity?: string;
  source?: string;
  errorType?: string;
  lastSeen?: string;
}

export function matchesFilters(issue: IssueRecord, f: SearchFilterCriteria): boolean {
  if (f.status !== "all" && issue.status !== f.status) return false;
  if (f.severity !== "all" && issue.severity !== f.severity) return false;
  if (f.source !== "all" && issue.source !== f.source) return false;
  if (f.errorType !== "all" && issue.errorType !== f.errorType) return false;
  if (f.from && (issue.lastSeen || "") < f.from) return false;
  if (f.to && (issue.lastSeen || "") > f.to) return false;
  if (f.q) {
    const needle = f.q.toLowerCase();
    const hay = `${issue.title || ""} ${issue.route || ""}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

export function encodeCursor(c: { v: string; id: string }): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64");
}

export function decodeCursor(c: string | null): { v: string; id: string } | null {
  if (!c) return null;
  try {
    const parsed = JSON.parse(Buffer.from(c, "base64").toString("utf8"));
    if (parsed && typeof parsed.v === "string" && typeof parsed.id === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

const SORT_FIELD: Record<string, string> = { recent: "lastSeen", frequent: "count", newest: "firstSeen" };
const SCAN_LIMIT = 300;

/**
 * GET /v1/admin/observability/issues
 * Query: status, severity, source, errorType, q, from, to, sort, limit, cursor
 * Orders by one auto-indexed field, then filters in-memory. Superadmin only.
 */
export async function searchIssues(req: Request, res: Response): Promise<Response> {
  try {
    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({ message: "Acesso negado." });
    }
    const qp = req.query as Record<string, string | undefined>;
    const sort = qp.sort || "recent";
    const orderField = SORT_FIELD[sort];
    if (!orderField) {
      return res.status(400).json({ message: "sort inválido" });
    }
    const limit = Math.min(Math.max(parseInt(qp.limit || "50", 10) || 50, 1), 200);
    const cursor = decodeCursor(qp.cursor || null);

    const criteria: SearchFilterCriteria = {
      status: qp.status || "all",
      severity: qp.severity || "all",
      source: qp.source || "all",
      errorType: qp.errorType || "all",
      q: qp.q || "",
      from: qp.from || null,
      to: qp.to || null,
    };

    let query = db
      .collection(ERROR_ISSUES_COLLECTION)
      .orderBy(orderField, "desc")
      .orderBy("__name__", "desc")
      .limit(SCAN_LIMIT);
    if (cursor) {
      query = query.startAfter(cursor.v, cursor.id);
    }

    const snap = await query.get();
    const matched: Array<Record<string, unknown>> = [];
    let lastScanned: { v: string; id: string } | null = null;

    for (const doc of snap.docs) {
      const data = doc.data() as IssueRecord & Record<string, unknown>;
      lastScanned = { v: String((data as Record<string, unknown>)[orderField] ?? ""), id: doc.id };
      if (matchesFilters(data, criteria)) {
        matched.push({ ...data, fingerprint: doc.id });
        if (matched.length >= limit) break;
      }
    }

    // More pages may exist if we consumed the full scan window.
    const nextCursor = snap.docs.length === SCAN_LIMIT && lastScanned ? encodeCursor(lastScanned) : null;
    return res.status(200).json({ issues: matched, nextCursor });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected";
    return res.status(mapTriageErrorStatus(message)).json({ message: "Erro ao buscar issues." });
  }
}
```

Ensure the import line at the top of the controller pulls `ERROR_ISSUES_COLLECTION` (it already does) — no change needed there.

- [ ] **Step 4: Add the route**

In `apps/functions/src/api/routes/observability-admin.routes.ts`:

```typescript
import { Router } from "express";
import { triageIssue, resolveIdentities, searchIssues } from "../controllers/observability-admin.controller";

const router = Router();

router.get("/issues", searchIssues);
router.put("/issues/:fingerprint/status", triageIssue);
router.post("/resolve-identities", resolveIdentities);

export const observabilityAdminRoutes = router;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/functions && npx jest --config jest.config.js src/api/controllers/__tests__/observability-search.controller.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Build to confirm no type errors**

Run: `cd apps/functions && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/functions/src/api/controllers/observability-admin.controller.ts apps/functions/src/api/routes/observability-admin.routes.ts apps/functions/src/api/controllers/__tests__/observability-search.controller.test.ts
git commit -m "feat(observability): add issue search endpoint with in-memory filtering"
```

---

### Task 5: Web service methods

**Files:**
- Modify: `apps/web/src/services/observability-service.ts`

**Interfaces:**
- Consumes: `callApi` from `@/lib/api-client`; types from `@/types/observability`.
- Produces: `ObservabilityService.resolveIdentities(uids, tenantIds)` → `Promise<ResolveIdentitiesResponse>`; `ObservabilityService.searchIssues(params)` → `Promise<IssueSearchResponse>`.

- [ ] **Step 1: Replace the service file**

```typescript
// apps/web/src/services/observability-service.ts
import { callApi } from "@/lib/api-client";
import type {
  ErrorIssueStatus,
  IssueFilters,
  IssueSearchResponse,
  ResolveIdentitiesResponse,
} from "@/types/observability";

export interface SearchIssuesParams extends IssueFilters {
  from?: string | null;
  to?: string | null;
  limit?: number;
  cursor?: string | null;
}

export const ObservabilityService = {
  triageIssue: async (fingerprint: string, status: ErrorIssueStatus): Promise<void> => {
    await callApi(`/v1/admin/observability/issues/${fingerprint}/status`, "PUT", { status });
  },

  resolveIdentities: async (
    uids: string[],
    tenantIds: string[],
  ): Promise<ResolveIdentitiesResponse> => {
    return callApi<ResolveIdentitiesResponse>(
      "/v1/admin/observability/resolve-identities",
      "POST",
      { uids, tenantIds },
    );
  },

  searchIssues: async (params: SearchIssuesParams): Promise<IssueSearchResponse> => {
    const qs = new URLSearchParams();
    qs.set("status", params.status);
    qs.set("severity", params.severity);
    qs.set("source", params.source);
    qs.set("errorType", params.errorType);
    qs.set("sort", params.sort);
    if (params.q) qs.set("q", params.q);
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.cursor) qs.set("cursor", params.cursor);
    return callApi<IssueSearchResponse>(`/v1/admin/observability/issues?${qs.toString()}`, "GET");
  },
};
```

- [ ] **Step 2: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors in `observability-service.ts` (remaining errors are in components fixed later).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/services/observability-service.ts
git commit -m "feat(observability): add resolve and search service methods"
```

---

### Task 6: Time-range helper + filter reducer

**Files:**
- Create: `apps/web/src/lib/observability/issue-filtering.ts`
- Test: `apps/web/src/lib/observability/__tests__/issue-filtering.test.ts`

**Interfaces:**
- Consumes: types from `@/types/observability`.
- Produces:
  - `rangeToFrom(range: IssueTimeRange, nowMs: number): string | null` — ISO lower bound for a range, `null` for `"all"`.
  - `isQueryMode(f: IssueFilters): boolean` — true when filters exceed what the live 200-issue snapshot can satisfy (any non-default `range`, `q`, or `sort !== "recent"`).
  - `applyClientFilters(issues: ErrorIssue[], f: IssueFilters): ErrorIssue[]` — status/severity/source/errorType/q/sort applied in-memory for live mode.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/observability/__tests__/issue-filtering.test.ts
import { describe, it, expect } from "vitest";
import { rangeToFrom, isQueryMode, applyClientFilters } from "../issue-filtering";
import { DEFAULT_ISSUE_FILTERS } from "@/types/observability";
import type { ErrorIssue } from "@/types/observability";

const NOW = Date.parse("2026-06-20T12:00:00Z");

describe("rangeToFrom", () => {
  it("returns null for all", () => {
    expect(rangeToFrom("all", NOW)).toBeNull();
  });
  it("returns now-24h for 24h", () => {
    expect(rangeToFrom("24h", NOW)).toBe("2026-06-19T12:00:00.000Z");
  });
});

describe("isQueryMode", () => {
  it("is false for defaults", () => {
    expect(isQueryMode(DEFAULT_ISSUE_FILTERS)).toBe(false);
  });
  it("is true when a range is set", () => {
    expect(isQueryMode({ ...DEFAULT_ISSUE_FILTERS, range: "7d" })).toBe(true);
  });
  it("is true when q is set", () => {
    expect(isQueryMode({ ...DEFAULT_ISSUE_FILTERS, q: "boom" })).toBe(true);
  });
  it("is true when sort is non-default", () => {
    expect(isQueryMode({ ...DEFAULT_ISSUE_FILTERS, sort: "frequent" })).toBe(true);
  });
  it("stays false for status/severity/source/errorType chips", () => {
    expect(isQueryMode({ ...DEFAULT_ISSUE_FILTERS, status: "unresolved", severity: "critical" })).toBe(false);
  });
});

describe("applyClientFilters", () => {
  const mk = (over: Partial<ErrorIssue>): ErrorIssue =>
    ({
      fingerprint: "f", errorType: "TypeError", title: "Boom happened", normalizedMessage: "boom",
      source: "web", route: "/x", method: "GET", severity: "error", status: "unresolved",
      count: 1, firstSeen: "", lastSeen: "", resolvedAt: null, affectedUsers: 0, affectedTenants: 0,
      tenantIds: [], sampleStack: "", why: null, fix: null, link: null, ...over,
    }) as ErrorIssue;

  it("filters by status and q", () => {
    const issues = [mk({ status: "resolved", title: "Boom" }), mk({ status: "unresolved", title: "Quiet" })];
    const out = applyClientFilters(issues, { ...DEFAULT_ISSUE_FILTERS, status: "unresolved" });
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Quiet");
    const byQ = applyClientFilters(issues, { ...DEFAULT_ISSUE_FILTERS, q: "boom" });
    expect(byQ).toHaveLength(1);
    expect(byQ[0].title).toBe("Boom");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/observability/__tests__/issue-filtering.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/lib/observability/issue-filtering.ts
import type { ErrorIssue, IssueFilters, IssueTimeRange } from "@/types/observability";

const RANGE_MS: Record<Exclude<IssueTimeRange, "all">, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export function rangeToFrom(range: IssueTimeRange, nowMs: number): string | null {
  if (range === "all") return null;
  return new Date(nowMs - RANGE_MS[range]).toISOString();
}

export function isQueryMode(f: IssueFilters): boolean {
  return f.range !== "all" || f.q.trim().length > 0 || f.sort !== "recent";
}

const SEVERITY_RANK: Record<string, number> = { critical: 0, error: 1, warning: 2 };

export function applyClientFilters(issues: ErrorIssue[], f: IssueFilters): ErrorIssue[] {
  const q = f.q.trim().toLowerCase();
  const filtered = issues.filter((i) => {
    if (f.status !== "all" && i.status !== f.status) return false;
    if (f.severity !== "all" && i.severity !== f.severity) return false;
    if (f.source !== "all" && i.source !== f.source) return false;
    if (f.errorType !== "all" && i.errorType !== f.errorType) return false;
    if (q) {
      const hay = `${i.title} ${i.route ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  return [...filtered].sort((a, b) => {
    if (f.sort === "frequent") return b.count - a.count;
    if (f.sort === "newest") return b.firstSeen.localeCompare(a.firstSeen);
    // recent: severity then lastSeen
    const s = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
    return s !== 0 ? s : b.lastSeen.localeCompare(a.lastSeen);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/observability/__tests__/issue-filtering.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/observability/issue-filtering.ts apps/web/src/lib/observability/__tests__/issue-filtering.test.ts
git commit -m "feat(observability): add time-range, query-mode and client filter helpers"
```

---

### Task 7: `useResolveIdentities` hook

**Files:**
- Create: `apps/web/src/app/admin/observability/_hooks/use-resolve-identities.ts`

**Interfaces:**
- Consumes: `ObservabilityService.resolveIdentities`; `ErrorOccurrence`, `ResolvedUser`, `ResolvedTenant`.
- Produces: `useResolveIdentities(occurrences: ErrorOccurrence[])` → `{ users: Record<string, ResolvedUser>; tenants: Record<string, ResolvedTenant> }`. Collects new unique ids from occurrences, resolves once per new batch, caches across renders in a ref.

- [ ] **Step 1: Write the hook**

```typescript
// apps/web/src/app/admin/observability/_hooks/use-resolve-identities.ts
"use client";

import * as React from "react";
import { ObservabilityService } from "@/services/observability-service";
import type { ErrorOccurrence, ResolvedTenant, ResolvedUser } from "@/types/observability";

export function useResolveIdentities(occurrences: ErrorOccurrence[]) {
  const usersRef = React.useRef<Record<string, ResolvedUser>>({});
  const tenantsRef = React.useRef<Record<string, ResolvedTenant>>({});
  const requestedRef = React.useRef<Set<string>>(new Set());
  const [, force] = React.useReducer((n: number) => n + 1, 0);

  React.useEffect(() => {
    const newUids = new Set<string>();
    const newTenantIds = new Set<string>();
    for (const o of occurrences) {
      if (o.uid && !(o.uid in usersRef.current) && !requestedRef.current.has(`u:${o.uid}`)) {
        newUids.add(o.uid);
      }
      if (o.tenantId && !(o.tenantId in tenantsRef.current) && !requestedRef.current.has(`t:${o.tenantId}`)) {
        newTenantIds.add(o.tenantId);
      }
    }
    if (newUids.size === 0 && newTenantIds.size === 0) return;

    newUids.forEach((u) => requestedRef.current.add(`u:${u}`));
    newTenantIds.forEach((t) => requestedRef.current.add(`t:${t}`));

    let cancelled = false;
    ObservabilityService.resolveIdentities([...newUids], [...newTenantIds])
      .then((res) => {
        if (cancelled) return;
        usersRef.current = { ...usersRef.current, ...res.users };
        tenantsRef.current = { ...tenantsRef.current, ...res.tenants };
        force();
      })
      .catch(() => {
        // degrade gracefully: rows fall back to raw ids
      });
    return () => {
      cancelled = true;
    };
  }, [occurrences]);

  return { users: usersRef.current, tenants: tenantsRef.current };
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors in this file.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/admin/observability/_hooks/use-resolve-identities.ts
git commit -m "feat(observability): add lazy identity-resolution hook"
```

---

### Task 8: Live-vs-query mode in `useErrorIssues`

**Files:**
- Modify: `apps/web/src/app/admin/observability/_hooks/use-error-issues.ts`

**Interfaces:**
- Consumes: `applyClientFilters`, `isQueryMode`, `rangeToFrom` from `@/lib/observability/issue-filtering`; `ObservabilityService.searchIssues`; `db`, firestore funcs.
- Produces: `useErrorIssues(filters)` → `{ issues: ErrorIssue[]; isLoading: boolean; triage(fp,status); errorTypes: string[]; nextCursor: string | null; loadMore(): void }`. Live mode (default) keeps the snapshot + `applyClientFilters`; query mode calls `searchIssues`. `errorTypes` is the sorted unique set from the live snapshot (for the dropdown).

- [ ] **Step 1: Rewrite the hook**

```typescript
// apps/web/src/app/admin/observability/_hooks/use-error-issues.ts
"use client";

import * as React from "react";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ObservabilityService } from "@/services/observability-service";
import { applyClientFilters, isQueryMode, rangeToFrom } from "@/lib/observability/issue-filtering";
import type { ErrorIssue, ErrorIssueStatus, IssueFilters } from "@/types/observability";

const MAX_ISSUES = 200;

export function useErrorIssues(filters: IssueFilters) {
  const [liveIssues, setLiveIssues] = React.useState<ErrorIssue[]>([]);
  const [queryIssues, setQueryIssues] = React.useState<ErrorIssue[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const queryMode = isQueryMode(filters);

  // Live snapshot — always running (also feeds errorTypes dropdown).
  React.useEffect(() => {
    const q = query(collection(db, "error_issues"), orderBy("lastSeen", "desc"), limit(MAX_ISSUES));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLiveIssues(snap.docs.map((d) => ({ ...(d.data() as ErrorIssue), fingerprint: d.id })));
        setIsLoading(false);
      },
      () => setIsLoading(false),
    );
    return () => unsub();
  }, []);

  // Query mode — server-backed search. Re-runs when filters change.
  const runSearch = React.useCallback(
    async (cursor: string | null, append: boolean) => {
      const from = rangeToFrom(filters.range, Date.now());
      setIsLoading(true);
      try {
        const res = await ObservabilityService.searchIssues({ ...filters, from, cursor, limit: 50 });
        setQueryIssues((prev) => (append ? [...prev, ...res.issues] : res.issues));
        setNextCursor(res.nextCursor);
      } finally {
        setIsLoading(false);
      }
    },
    [filters],
  );

  React.useEffect(() => {
    if (!queryMode) {
      setQueryIssues([]);
      setNextCursor(null);
      return;
    }
    void runSearch(null, false);
  }, [queryMode, runSearch]);

  const triage = React.useCallback(async (fp: string, status: ErrorIssueStatus) => {
    setLiveIssues((prev) => prev.map((i) => (i.fingerprint === fp ? { ...i, status } : i)));
    setQueryIssues((prev) => prev.map((i) => (i.fingerprint === fp ? { ...i, status } : i)));
    await ObservabilityService.triageIssue(fp, status);
  }, []);

  const issues = queryMode ? queryIssues : applyClientFilters(liveIssues, filters);

  const errorTypes = React.useMemo(
    () => [...new Set(liveIssues.map((i) => i.errorType).filter(Boolean))].sort(),
    [liveIssues],
  );

  const loadMore = React.useCallback(() => {
    if (queryMode && nextCursor) void runSearch(nextCursor, true);
  }, [queryMode, nextCursor, runSearch]);

  return { issues, isLoading, triage, errorTypes, nextCursor: queryMode ? nextCursor : null, loadMore };
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: errors only remain in `page.tsx`, `issue-list.tsx`, `filter-chips.tsx` (old filter shape), fixed next.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/admin/observability/_hooks/use-error-issues.ts
git commit -m "feat(observability): live-vs-query mode in useErrorIssues"
```

---

### Task 9: Filter bar component

**Files:**
- Create: `apps/web/src/app/admin/observability/_components/filter-bar.tsx`
- Delete: `apps/web/src/app/admin/observability/_components/filter-chips.tsx`

**Interfaces:**
- Consumes: `IssueFilters`, `DEFAULT_ISSUE_FILTERS`; shadcn `Input`, `Select`, `Button`.
- Produces: `<FilterBar filters errorTypes onChange />`. `onChange(next: IssueFilters)`.

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/app/admin/observability/_components/filter-bar.tsx
"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DEFAULT_ISSUE_FILTERS } from "@/types/observability";
import type { IssueFilters } from "@/types/observability";

interface FilterBarProps {
  filters: IssueFilters;
  errorTypes: string[];
  onChange: (next: IssueFilters) => void;
}

function countActive(f: IssueFilters): number {
  let n = 0;
  if (f.status !== "all") n++;
  if (f.severity !== "all") n++;
  if (f.source !== "all") n++;
  if (f.errorType !== "all") n++;
  if (f.q.trim()) n++;
  if (f.range !== "all") n++;
  if (f.sort !== "recent") n++;
  return n;
}

export function FilterBar({ filters, errorTypes, onChange }: FilterBarProps) {
  const set = (patch: Partial<IssueFilters>) => onChange({ ...filters, ...patch });
  const active = countActive(filters);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <Input
        value={filters.q}
        onChange={(e) => set({ q: e.target.value })}
        placeholder="Buscar por mensagem ou rota…"
        className="h-9 w-full sm:w-64"
      />

      <Select value={filters.range} onValueChange={(v) => set({ range: v as IssueFilters["range"] })}>
        <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todo período</SelectItem>
          <SelectItem value="1h">Última 1h</SelectItem>
          <SelectItem value="24h">Últimas 24h</SelectItem>
          <SelectItem value="7d">Últimos 7d</SelectItem>
          <SelectItem value="30d">Últimos 30d</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.sort} onValueChange={(v) => set({ sort: v as IssueFilters["sort"] })}>
        <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="recent">Mais recentes</SelectItem>
          <SelectItem value="frequent">Mais frequentes</SelectItem>
          <SelectItem value="newest">Mais novos</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.status} onValueChange={(v) => set({ status: v as IssueFilters["status"] })}>
        <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos status</SelectItem>
          <SelectItem value="unresolved">Abertos</SelectItem>
          <SelectItem value="resolved">Resolvidos</SelectItem>
          <SelectItem value="ignored">Ignorados</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.severity} onValueChange={(v) => set({ severity: v as IssueFilters["severity"] })}>
        <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toda severidade</SelectItem>
          <SelectItem value="critical">Crítico</SelectItem>
          <SelectItem value="error">Erro</SelectItem>
          <SelectItem value="warning">Alerta</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.source} onValueChange={(v) => set({ source: v as IssueFilters["source"] })}>
        <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toda origem</SelectItem>
          <SelectItem value="web">Web</SelectItem>
          <SelectItem value="functions">Backend</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.errorType} onValueChange={(v) => set({ errorType: v })}>
        <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todo tipo</SelectItem>
          {errorTypes.map((t) => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {active > 0 && (
        <Button variant="ghost" size="sm" className="h-9" onClick={() => onChange({ ...DEFAULT_ISSUE_FILTERS })}>
          Limpar ({active})
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Delete the old filter-chips file**

```bash
git rm apps/web/src/app/admin/observability/_components/filter-chips.tsx
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/admin/observability/_components/filter-bar.tsx
git commit -m "feat(observability): add filter bar with search, range, sort and errorType"
```

---

### Task 10: Occurrence table component

**Files:**
- Create: `apps/web/src/app/admin/observability/_components/occurrence-table.tsx`

**Interfaces:**
- Consumes: `ErrorOccurrence`, `ResolvedUser`, `ResolvedTenant`; `parseUserAgent`; `relativeTime` from `@/lib/observability/issue-format`; shadcn `Table`, `Button`.
- Produces: `<OccurrenceTable occurrences users tenants />`. Self-contained expand state per row.

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/app/admin/observability/_components/occurrence-table.tsx
"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseUserAgent } from "@/lib/observability/parse-user-agent";
import { relativeTime } from "@/lib/observability/issue-format";
import type { ErrorOccurrence, ResolvedTenant, ResolvedUser } from "@/types/observability";

interface OccurrenceTableProps {
  occurrences: ErrorOccurrence[];
  users: Record<string, ResolvedUser>;
  tenants: Record<string, ResolvedTenant>;
}

function copy(text: string) {
  void navigator.clipboard.writeText(text);
}

export function OccurrenceTable({ occurrences, users, tenants }: OccurrenceTableProps) {
  const [expanded, setExpanded] = React.useState<string | null>(null);

  if (occurrences.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/50">Nenhuma ocorrência registrada.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Quando</TableHead>
          <TableHead>Usuário</TableHead>
          <TableHead>Tenant</TableHead>
          <TableHead>Rota</TableHead>
          <TableHead>HTTP</TableHead>
          <TableHead>Navegador</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {occurrences.map((o) => {
          const ua = parseUserAgent(o.userAgent);
          const user = o.uid ? users[o.uid] : undefined;
          const tenant = o.tenantId ? tenants[o.tenantId] : undefined;
          const open = expanded === o.id;
          return (
            <React.Fragment key={o.id}>
              <TableRow className="cursor-pointer" onClick={() => setExpanded(open ? null : o.id)}>
                <TableCell className="whitespace-nowrap text-xs">{relativeTime(o.createdAt)}</TableCell>
                <TableCell className="text-xs">
                  {user ? (
                    <span title={user.email}>{user.name}<br /><span className="text-black/40 dark:text-white/40">{user.email}</span></span>
                  ) : (
                    <span className="font-mono text-black/50 dark:text-white/50">{o.uid ?? "anônimo"}</span>
                  )}
                </TableCell>
                <TableCell className="text-xs">{tenant?.name ?? (o.tenantId ? <span className="font-mono">{o.tenantId}</span> : "—")}</TableCell>
                <TableCell className="font-mono text-[11px]">{`${o.method ?? ""} ${o.route ?? "—"}`.trim()}</TableCell>
                <TableCell className="text-xs">{o.status ?? "—"}</TableCell>
                <TableCell className="text-xs">{ua.browser} · {ua.os} · {ua.device}</TableCell>
              </TableRow>
              {open && (
                <TableRow>
                  <TableCell colSpan={6} className="bg-black/[0.02] dark:bg-white/[0.03]">
                    <div className="space-y-2 py-2">
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        {o.uid && <button onClick={() => copy(o.uid!)} className="rounded bg-black/10 px-2 py-1 dark:bg-white/10">Copiar uid</button>}
                        {o.tenantId && <button onClick={() => copy(o.tenantId!)} className="rounded bg-black/10 px-2 py-1 dark:bg-white/10">Copiar tenantId</button>}
                        <button onClick={() => copy(o.stack)} className="rounded bg-black/10 px-2 py-1 dark:bg-white/10">Copiar stack</button>
                      </div>
                      <p className="text-[11px] text-black/50 dark:text-white/50">{o.userAgent ?? "userAgent indisponível"}</p>
                      <pre className="max-h-72 overflow-auto rounded-lg bg-black/90 p-3 font-mono text-[11px] leading-relaxed text-white/90">
                        {o.stack || "—"}
                      </pre>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors in this file.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/admin/observability/_components/occurrence-table.tsx
git commit -m "feat(observability): add occurrence detail table with expandable stacks"
```

---

### Task 11: Drawer redesign + issue row chip

**Files:**
- Modify: `apps/web/src/app/admin/observability/_components/issue-drawer.tsx`
- Modify: `apps/web/src/app/admin/observability/_components/issue-row.tsx`

**Interfaces:**
- Consumes: `useIssueOccurrences`, `useResolveIdentities`, `OccurrenceTable`; existing `OccurrenceSparkline`.
- Produces: redesigned drawer that renders the occurrence table; issue row that shows an `errorType` chip and a copy-fingerprint button.

- [ ] **Step 1: Update the drawer to render the occurrence table**

In `issue-drawer.tsx`, add imports near the top:

```tsx
import { OccurrenceTable } from "./occurrence-table";
import { useResolveIdentities } from "../_hooks/use-resolve-identities";
```

Replace the existing occurrences block (the `<OccurrenceSparkline>` section, lines 69-74) with:

```tsx
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wider text-black/40 dark:text-white/40">
                    Ocorrências recentes ({occurrences.length})
                  </p>
                  <button
                    onClick={() => navigator.clipboard.writeText(issue.fingerprint)}
                    className="text-[11px] text-black/40 underline dark:text-white/40"
                  >
                    Copiar fingerprint
                  </button>
                </div>
                <OccurrenceSparkline occurrences={occurrences} />
                <div className="mt-3">
                  <OccurrenceTable occurrences={occurrences} users={users} tenants={tenants} />
                </div>
              </div>
```

Add the resolve hook right after the existing `useIssueOccurrences` call (currently line 31):

```tsx
  const { occurrences } = useIssueOccurrences(issue?.fingerprint ?? null);
  const { users, tenants } = useResolveIdentities(occurrences);
```

The old standalone `Stack` section (the `<pre>` showing `issue.sampleStack`, lines 76-81) is now redundant with per-occurrence stacks — keep it as a labelled "Stack representativo" fallback for issues with zero sampled occurrences. Leave it unchanged.

- [ ] **Step 2: Add errorType chip to issue row**

In `issue-row.tsx`, locate the line rendering the route/method (monospace text) and add an errorType chip immediately before it. Insert:

```tsx
            <span className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] text-black/60 dark:bg-white/10 dark:text-white/60">
              {issue.errorType}
            </span>
```

(Place it inside the same flex container that holds the route/method text. If unsure of exact structure, open the file and add the chip adjacent to the existing `{issue.method} {issue.route}` element.)

- [ ] **Step 3: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: errors only in `page.tsx` / `issue-list.tsx` (filter shape + filter-chips import), fixed in Task 12.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/admin/observability/_components/issue-drawer.tsx apps/web/src/app/admin/observability/_components/issue-row.tsx
git commit -m "feat(observability): render occurrence table and errorType chip"
```

---

### Task 12: Wire page + issue-list to the new filter bar

**Files:**
- Modify: `apps/web/src/app/admin/observability/page.tsx`
- Modify: `apps/web/src/app/admin/observability/_components/issue-list.tsx`

**Interfaces:**
- Consumes: `DEFAULT_ISSUE_FILTERS`, `FilterBar`, expanded `useErrorIssues` return (`errorTypes`, `nextCursor`, `loadMore`).
- Produces: page using the new default filters and passing `errorTypes`; issue list rendering `FilterBar` instead of `FilterChips` plus an optional "Carregar mais" button.

- [ ] **Step 1: Update page.tsx**

Change the filters initializer and pass new props. Replace line 14 import and line 17 initializer:

```tsx
import type { ErrorIssue, ErrorIssueStatus, IssueFilters } from "@/types/observability";
import { DEFAULT_ISSUE_FILTERS } from "@/types/observability";
```

```tsx
  const [filters, setFilters] = React.useState<IssueFilters>(DEFAULT_ISSUE_FILTERS);
  const { issues, isLoading, triage, errorTypes, nextCursor, loadMore } = useErrorIssues(filters);
```

Update the `<IssueList>` usage (line 58) to forward the new props:

```tsx
          <IssueList
            issues={issues}
            filters={filters}
            errorTypes={errorTypes}
            onChange={setFilters}
            onSelect={setSelected}
            nextCursor={nextCursor}
            onLoadMore={loadMore}
          />
```

- [ ] **Step 2: Update issue-list.tsx**

Replace the `FilterChips` import and usage with `FilterBar`, accept the new props, and add a "Carregar mais" button when `nextCursor` is set.

```tsx
// apps/web/src/app/admin/observability/_components/issue-list.tsx
"use client";

import { FilterBar } from "./filter-bar";
import { IssueRow } from "./issue-row";
import { Button } from "@/components/ui/button";
import type { ErrorIssue, IssueFilters } from "@/types/observability";

interface IssueListProps {
  issues: ErrorIssue[];
  filters: IssueFilters;
  errorTypes: string[];
  onChange: (next: IssueFilters) => void;
  onSelect: (issue: ErrorIssue) => void;
  nextCursor: string | null;
  onLoadMore: () => void;
}

export function IssueList({
  issues,
  filters,
  errorTypes,
  onChange,
  onSelect,
  nextCursor,
  onLoadMore,
}: IssueListProps) {
  return (
    <div className="space-y-3">
      <FilterBar filters={filters} errorTypes={errorTypes} onChange={onChange} />
      <div className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/10 dark:divide-white/5 dark:border-white/10">
        {issues.length === 0 ? (
          <p className="p-6 text-center text-sm text-black/50 dark:text-white/50">Nenhuma issue encontrada.</p>
        ) : (
          issues.map((issue) => <IssueRow key={issue.fingerprint} issue={issue} onSelect={onSelect} />)
        )}
      </div>
      {nextCursor && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={onLoadMore}>Carregar mais</Button>
        </div>
      )}
    </div>
  );
}
```

> Note: if the existing `issue-list.tsx` passes different props to `IssueRow` (e.g. a different handler name), preserve that call signature — only swap `FilterChips`→`FilterBar` and add the load-more block. Open the file first to confirm the `IssueRow` prop name.

- [ ] **Step 3: Full web type-check + lint**

Run: `cd apps/web && npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Run the full web unit suite**

Run: `npm run test:web`
Expected: PASS (includes new parser + filtering tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/admin/observability/page.tsx apps/web/src/app/admin/observability/_components/issue-list.tsx
git commit -m "feat(observability): wire filter bar and pagination into dashboard"
```

---

### Task 13: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Functions build + tests**

Run: `cd apps/functions && npm run build && npx jest --config jest.config.js src/api/controllers/__tests__`
Expected: build OK; all observability controller tests pass.

- [ ] **Step 2: Functions lint**

Run: `cd apps/functions && npm run lint`
Expected: no errors.

- [ ] **Step 3: Web build**

Run: `cd apps/web && npm run build`
Expected: production build succeeds.

- [ ] **Step 4: Manual smoke (optional, requires emulators + a superadmin session)**

Start emulators, sign in as superadmin, open `/admin/observability`:
- Filter bar: type in search, change range/sort/errorType — list updates (query mode for range/sort/q).
- Open an issue: occurrences table shows user names/emails, tenant names, route, HTTP, browser/OS.
- Click a row: expands full stack + userAgent + copy buttons work.

- [ ] **Step 5: No commit** — verification only. If any step fails, fix in the relevant task's file and amend that task's commit or add a fixup commit.

---

## Self-Review Notes

- **Spec coverage:** A1 resolve → Task 3; A2 search → Task 4; live-vs-query → Tasks 6,8; filter bar → Task 9; drawer occurrences table → Tasks 10,11; errorType chip → Task 11; types → Task 2; UA parser → Task 1; tests → Tasks 1,3,4,6 + suite runs in 12,13.
- **Deviation from spec (documented):** No new Firestore composite indexes — the search endpoint orders by a single auto-indexed field and filters in-memory, eliminating the index-explosion the spec anticipated. Simpler and honest; `q`/secondary filters are post-filtered as the spec already allowed.
- **Hybrid identity resolution** (decision 4): occurrences stay live via `useIssueOccurrences` `onSnapshot`; names resolved lazily by `useResolveIdentities` (Task 7), exactly the chosen approach.
