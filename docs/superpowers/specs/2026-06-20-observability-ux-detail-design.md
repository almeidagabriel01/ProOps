# Observability UX & Error Detail — Design

**Date:** 2026-06-20
**Status:** Approved (pending spec review)
**Scope:** Super admin error observability (evlog) — `/admin/observability`

## Problem

The super admin observability dashboard shows grouped error issues but exposes almost
none of the rich per-occurrence data already captured in Firestore. When debugging, you
cannot see **who** hit an error, **where** (page/route, HTTP status), in **which
browser/OS**, or each occurrence's **own** stack trace. Filters are limited to
status/severity/source with no search, time range, errorType, or sort. The goal: surface
the maximum debugging detail so post-incident investigation is fast.

## Current state (grounding)

- `error_issues/{fingerprint}` — grouped issue doc (title, severity, status, count,
  first/lastSeen, affectedUsers/Tenants, sampleStack, why/fix/link).
- `error_issues/{fingerprint}/occurrences/{id}` — per-event sample (capped 50, 30d TTL),
  with fields: `uid, tenantId, route, method, status, stack, userAgent, createdAt`.
  **All captured, none rendered** beyond a density sparkline.
- Frontend reads issues and occurrences via Firestore `onSnapshot` (real-time). Occurrence
  detail hook: `apps/web/src/app/admin/observability/_hooks/use-issue-occurrences.ts`.
- Filters: `IssueFilters { status, severity, source }`, client-side over ~200 live issues.
- Triage endpoint exists: `PUT /v1/admin/observability/issues/:fingerprint/status`
  (`observability-admin.controller.ts`, gated by `isSuperAdminClaim`).

## Decisions (from brainstorming)

1. Surface all four: who hit it, where/context, full stack per event, better filters/search.
2. Identities resolved to **name + email** (user) and tenant **name**.
3. Search is **server-backed** — scans all history, not just the live 200.
4. Drawer occurrences are **hybrid**: keep the live `onSnapshot` stream, resolve identity
   names **lazily** via a batch endpoint, cache client-side.

## Architecture

### A. Backend — two new superadmin-gated endpoints

Both validate `isSuperAdminClaim(req)` (return 403 otherwise) and live under
`observability-admin.controller.ts` / `observability-admin.routes.ts`.

**A1. Batch identity resolve** — `POST /v1/admin/observability/resolve-identities`

- Body: `{ uids: string[], tenantIds: string[] }` (each capped at 100; dedup server-side).
- Reads `users/{uid}` → `{ name, email }`, `tenants/{tenantId}` → `{ name }` via Admin SDK,
  deduped per request (a `Map` prevents repeat reads for repeated ids).
- Missing docs → entry omitted (frontend falls back to raw id).
- Response: `{ users: Record<uid, {name, email}>, tenants: Record<tenantId, {name}> }`.
- No PII beyond name/email; never returns phone/CPF. Not logged.

**A2. Issue search/query** — `GET /v1/admin/observability/issues`

- Query params: `status, severity, source, errorType, q, from, to, sort, limit, cursor`.
- Firestore query on `error_issues`:
  - `where` on provided `status` / `severity` / `source` / `errorType` (omit when `all`).
  - `lastSeen` range from `from`/`to` (ISO) when provided.
  - `orderBy`: `recent` → `lastSeen desc` (default); `frequent` → `count desc`;
    `newest` → `firstSeen desc`.
  - `limit` (default 50, max 200) + cursor pagination (`startAfter` on the order field;
    cursor is the last doc's order value + fingerprint tiebreak).
- `q` (substring on `title` + `route`): Firestore has no full-text. Applied **server-side**
  in-memory over each paginated page during the scan. Documented limitation; route/errorType
  exact+prefix filtering is index-backed. `q` matching is case-insensitive.
- Response: `{ issues: ErrorIssue[], nextCursor: string | null }`.
- New composite indexes added to `firestore.indexes.json` for the filter+orderBy combos
  actually used (status/severity/source × lastSeen|count|firstSeen). Listed in deploy notes.

### B. Frontend

**B1. Live vs. query mode (implicit).** Default view stays the current live `onSnapshot`
list (recent 200) with client-side status/severity/source/errorType/sort/`q` filtering.
The moment a time-range is set, results paginate, or `q`/sort exceed the live window, the
list switches to **query mode** (calls A2, paginated). Encapsulated in `useErrorIssues`
so `page.tsx` stays thin.

**B2. Filter bar** (replaces `filter-chips.tsx` with `filter-bar.tsx`):
- Search input (`q`) · time-range select (1h / 24h / 7d / 30d / tudo) · errorType dropdown
  (options derived from loaded issues) · sort select (Recentes / Mais frequentes / Mais
  novos) · existing status/severity/source chips · active-filter count + "Limpar filtros".

**B3. Issue drawer redesign** (`issue-drawer.tsx`) — the payoff:
- Keep header (severity/status/title), aggregate metrics grid, why/fix/link, sparkline.
- **New occurrences table** (`occurrence-table.tsx`): one row per live occurrence —
  `time (relative) · user (name+email | raw uid) · tenant name · method+route ·
  HTTP status · browser+OS`. Click a row to expand: that occurrence's **own** full stack,
  full userAgent, and copy buttons.
- Identity names: `useResolveIdentities` collects unique `uid`/`tenantId` from the live
  occurrences, calls A1 once per new batch, caches in a `Map` ref; rows render resolved
  names or fall back to raw id.
- userAgent parsed client-side: `apps/web/src/lib/observability/parse-user-agent.ts`
  → `{ browser, os, device }` (small regex util, no new dependency).
- Copy buttons: fingerprint, uid, tenantId, full stack.
- Deep link: tenant name → `/admin` (so superadmin can open/impersonate that tenant).

**B4. Issue row** (`issue-row.tsx`): add an `errorType` chip alongside route/method.

### C. Types (`apps/web/src/types/observability.ts`)

```typescript
export interface ResolvedUser { name: string; email: string }
export interface ResolvedTenant { name: string }
export interface ParsedUserAgent { browser: string; os: string; device: string }

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
```
`ErrorOccurrence` unchanged (resolution + UA parse are derived view-side, not stored).

## Error handling

- Resolve endpoint: invalid body (non-array / over cap) → 400; partial failures omit the
  id, never 500 the whole batch.
- Query endpoint: invalid `sort`/`range`/`limit`/`cursor` → 400 with message; empty result
  → `{ issues: [], nextCursor: null }`.
- Frontend: resolve/query failures degrade gracefully (raw ids, toast on query error) — the
  drawer and live list never blank out.

## Testing

- **Functions (Jest)**: identity-resolve dedup + cap + superadmin gate; query endpoint
  filter/sort/range/pagination + `q` substring + superadmin gate.
- **Web (Vitest)**: `parse-user-agent.ts` (common UA strings → browser/os/device); live-vs-
  query mode selection in the filter reducer.

## Deploy notes

- New composite indexes → `firestore.indexes.json`, deploy before/with the feature.
- No change to error-write path; occurrence schema unchanged. No TTL change.
- Frontend-only + two read-only backend endpoints → **low/medium risk**.

## Out of scope (YAGNI)

- Full-text search engine, geo/IP enrichment, session replay, alerting/notifications,
  CSV export. Not requested.
