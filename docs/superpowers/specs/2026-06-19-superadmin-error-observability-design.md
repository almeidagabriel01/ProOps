# Super Admin Error Observability — Design Spec

**Date:** 2026-06-19
**Status:** Approved (brainstorm), pending implementation plan
**Author:** Gabriel Almeida

## Goal

Give the superadmin a single, real-time, beautiful surface to see every error happening across ProOps (web + Cloud Functions): which user, which tenant, which route, the stack, how often, and how to fix it. Errors are captured at the source, formatted/redacted by [evlog](https://www.evlog.dev/), grouped into deduplicated **issues**, persisted to Firestore, and visualized in an animated `/admin/observability` dashboard with status triage.

Today there is **no** error-monitoring service wired (no Sentry on web or functions, despite CLAUDE.md claiming otherwise — see "Codebase reality" below). Errors currently die in GCP Cloud Logging + `console`. This feature is the first real error-visibility tool for the product.

## Quality bar

Senior-engineer grade throughout: idempotent atomic writes, bounded reads, PII redaction at the boundary, no unbounded arrays/collections, self-protecting capture (logging an error must never throw into the request path nor recurse), write-amplification guards, defense-in-depth security (Firestore rules + middleware + UI), full automated test coverage, modular components (no monolith page or controller).

## Codebase reality (verified)

- **Superadmin gating:** `role === "superadmin"` Firebase custom claim. Frontend `AdminGuard` (`apps/web/src/app/admin/_components/admin-guard.tsx`) redirects non-superadmin → `/403`. Backend `isSuperAdminClaim(req)` (`apps/functions/src/api/middleware/auth.ts`).
- **Existing observability infra to mirror:** `apps/functions/src/lib/security-observability.ts` — `writeSecurityAuditEvent()`, `incrementSecurityCounter()`, collections `security_audit_events` (TTL via `expiresAt`), `security_metrics` / `security_metrics_tenants` (hourly window docs `YYYYMMDDhh`).
- **Backend global error handler:** `apps/functions/src/api/index.ts:532-559` — logs `{ error, stack, requestId, route, method, tenantId, uid }`, returns 500.
- **Logger:** `apps/functions/src/lib/logger.ts` (JSON + `severity` for GCP).
- **Frontend error surfaces:** `components/shared/error-boundary.tsx` (class boundary), `app/error.tsx` (route), `app/global-error.tsx` (root). None report anywhere but `console`.
- **Data-fetch pattern:** `services/admin-service.ts` → `app/admin/_hooks/useTenantManagement.ts` (uses `onSnapshot` for live billing) → `api/routes/admin.routes.ts` → `api/controllers/admin.controller.ts` (`isSuperAdminClaim` guard, cursor pagination, batch `getAll`, capped `.limit()`).
- **Animation stack available:** `gsap` ^3.14, `@gsap/react` ^2.1, `lenis` ^1.3, `motion` ^12.34 (Framer successor). Landing uses GSAP+ScrollTrigger+Lenis.
- **Palette constraint:** landing is strictly black/white mono (no brand color). Dashboard follows mono; **severity color (critical=red, warning=amber) is the only chromatic accent**, functionally justified.

## Decisions (from brainstorm)

1. **Capture scope:** full-stack (web + functions).
2. **Data model:** grouped issues (fingerprint dedup) + bounded recent-occurrence sample per issue.
3. **Triage:** status workflow — `unresolved` / `resolved` / `ignored`; resolved auto-reopens on recurrence.
4. **Aesthetic:** bento grid + glass depth, grounded in mono palette, aggressive-but-accessible motion.
5. **Read path:** live `onSnapshot` with superadmin-only Firestore **read** rules; client **write** denied entirely on all observability collections.

## Architecture

```
[web errors]   error-boundary + global-error + window.onerror + unhandledrejection
                         │  client-error-reporter (batch, dedup, sendBeacon)
                         │  POST /api/backend/v1/observability/client-error
                         ▼
[fn errors]    Express global handler (api/index.ts) + controller catches
                         │
                  evlog logger (format + PII redaction + why/fix/link)
                         │  custom Firestore adapter → error-ingest.service
                         ▼
   error_issues/{fingerprint}            grouped issue, status, counts (atomic upsert)
     └ occurrences/{autoId}              capped sample (last ~50), TTL
   error_metrics/{YYYYMMDDhh}            hourly severity/source counters
                         │  onSnapshot (live, superadmin read rules)
                         ▼
   /admin/observability                  bento + glass dashboard (AdminGuard)
```

### Phasing

- **Phase 1 — Capture pipeline** (backend + client reporter + Firestore model + rules + indexes). No UI. Verifiable by writing test errors and seeing issue docs.
- **Phase 2 — Dashboard** (animated `/admin/observability` reading the live data).

Each phase ships its own implementation plan, atomic commits, and tests. No dashboard work begins before Phase 1 produces data.

## Data model

### `error_issues/{fingerprint}`

`fingerprint = sha1(errorType | normalizedMessage | route | stackTopFrame)`, computed **server-side only**.
`normalizedMessage` strips volatile tokens (UUIDs, numbers, emails, hex ids) so `user abc not found` and `user xyz not found` collapse to one issue.

```ts
interface ErrorIssue {
  fingerprint: string;
  errorType: string;              // e.g. "TypeError", "FORBIDDEN_TENANT_MISMATCH"
  title: string;                  // human title, normalized
  normalizedMessage: string;
  source: "web" | "functions";
  route: string | null;           // sanitized path
  method: string | null;
  severity: "critical" | "error" | "warning";
  status: "unresolved" | "resolved" | "ignored";
  count: number;                  // total occurrences
  firstSeen: Timestamp;
  lastSeen: Timestamp;
  resolvedAt: Timestamp | null;
  affectedUsers: number;          // approximate distinct count (HLL-lite / capped set doc)
  affectedTenants: number;
  tenantIds: string[];            // capped at 20 for display; not authoritative count
  sampleStack: string;            // truncated
  why: string | null;             // evlog structured-error fields
  fix: string | null;
  link: string | null;
}
```

### `error_issues/{fingerprint}/occurrences/{autoId}`

Bounded sample; old docs expire via TTL `expiresAt`. Never the source of counts.

```ts
interface ErrorOccurrence {
  uid: string | null;
  tenantId: string | null;
  route: string | null;
  method: string | null;
  status: number | null;          // HTTP status if applicable
  stack: string;                  // truncated, untrusted if client-sourced
  userAgent: string | null;
  createdAt: Timestamp;
  expiresAt: Timestamp;           // Firestore TTL
}
```

### `error_metrics/{YYYYMMDDhh}`

Exact clone of `security_metrics` shape: `{ windowId, windowStart, updatedAt, counters: { [severity_source]: number } }`. Hourly granularity, no TTL.

### Distinct-affected counting

To avoid unbounded arrays, `affectedUsers`/`affectedTenants` are maintained on a sibling doc `error_issues/{fp}/_agg/affected` holding capped hashed-id sets (e.g. max 1000 hashed uids); beyond the cap the count becomes a documented lower-bound estimate. Display strings read "1000+". No raw uids stored in the issue doc.

## Capture pipeline

### evlog integration

One `createLogger` per runtime: `apps/functions/src/lib/observability/error-logger.ts` (functions) and `apps/web/src/lib/observability/error-logger.ts` (web, client-safe subset). A **single custom Firestore adapter** (functions side) is the only path that writes error docs — nothing hand-builds them. evlog handles PII redaction and `why`/`fix`/`link` before anything is persisted.

### Backend ingestion — `apps/functions/src/api/services/error-ingest.service.ts`

- Invoked from the Express global handler (`api/index.ts:532`) and controller catch blocks.
- Fingerprint + severity computed server-side. `severity`: 5xx/unhandled → `critical`; handled 4xx domain errors → `warning`; everything else → `error` (exact mapping table in plan).
- **Idempotent atomic upsert** in `db.runTransaction()`:
  1. read `error_issues/{fp}`;
  2. absent → create with `count: 1`, `firstSeen=lastSeen=now`, `status: unresolved`;
  3. present → `count++`, `lastSeen=now`; if `status === "resolved"` flip to `unresolved` and clear `resolvedAt` (regression).
- Occurrence write + affected-set update happen **after** the transaction commits (best-effort, never block the request).
- **Self-protection:** the whole ingest call is wrapped in try/catch that swallows to `console.error`; failure in logging never propagates to the user request. The ingest code path is explicitly excluded from capture to prevent recursion.
- **Write-amplification guard:** in-memory per-instance LRU keyed by fingerprint caps writes per fingerprint to N/10s (mirrors existing in-memory rate-limiter). A storm coalesces into `count` increments throttled at the instance level; dropped writes still increment an approximate counter where possible.

### Frontend reporter — `apps/web/src/lib/observability/client-error-reporter.ts`

- Subscribes: `error-boundary.tsx`, `global-error.tsx`, `window.onerror`, `window.unhandledrejection`.
- Batches + debounces, dedups within the batch, flushes on interval and via `navigator.sendBeacon` on `pagehide`/`visibilitychange`.
- POSTs to `/api/backend/v1/observability/client-error`. Pre-auth errors allowed with `uid: null`.
- Client never computes the authoritative fingerprint; server recomputes. Client stack is **untrusted**: length-capped, stored as text, never evaluated.

### Backend route — `observability`

- `apps/functions/src/api/routes/observability.routes.ts`, `controllers/observability.controller.ts`, helper `mapObservabilityErrorStatus()` (follows backend.md error-keyword→status convention).
- Registered after `validateFirebaseIdToken` with a **dedicated rate limiter** on the ingest endpoint (per uid + per IP, payload-size capped, zod/schema-validated).
- Endpoints:
  - `POST /v1/observability/client-error` — ingest (authenticated or anonymous-preauth, strict rate limit).
  - `GET /v1/observability/issues` — superadmin, cursor-paginated, filters (status/severity/source/route/tenant), capped `.limit()`.
  - `GET /v1/observability/issues/:fingerprint` — superadmin, issue + recent occurrences.
  - `GET /v1/observability/metrics` — superadmin, hourly windows for charts.
  - `PATCH /v1/observability/issues/:fingerprint` — superadmin, set `status`; emits `writeSecurityAuditEvent` (`eventType: "observability_issue_triaged"`).
- All read/triage endpoints guarded by `isSuperAdminClaim`.

## Dashboard — `/admin/observability`

Wrapped in existing `AdminGuard`. Bento grid; each cell is an isolated component (no monolith). Mono palette; severity color is the only accent. All motion respects `prefers-reduced-motion` (hard requirement).

- **Hero metrics strip** — GSAP count-up: open issues, events/24h, affected tenants; live via `onSnapshot`.
- **Severity heatmap cell** — hour × severity grid from `error_metrics`; glass depth; spring on hover.
- **Issue list cell** — ranked by severity × recency; virtualized; filter chips; status pills; parallax row lift on hover; optimistic triage with server fallback.
- **Drill-in panel** — `motion` v12 spring slide-over: full stack, evlog `why`/`fix`/`link`, occurrence sparkline timeline, affected users/tenants, resolve/ignore actions.
- **Live ticker** — new errors animate in (reduced-motion: instant).

Data flow: `apps/web/src/services/observability-service.ts` → `apps/web/src/hooks/useErrorObservability.ts` (onSnapshot + service) → cell components in `app/admin/observability/_components/`.

## Security & performance

- **Defense in depth:** superadmin enforced at Firestore rules + backend middleware + UI guard.
- **Firestore rules** (`firebase/firestore.rules`): `error_issues`, `error_issues/*/occurrences`, `error_issues/*/_agg`, `error_metrics` — client **read** allowed only when `request.auth.token.role == "superadmin"`; client **write** denied entirely (Admin SDK only). New-collection DENY-by-default satisfied with explicit rules. Rules tested with `@firebase/rules-unit-testing`.
- **Indexes** (`firebase/firestore.indexes.json`): `status + severity + lastSeen`, `source + lastSeen`, `severity + lastSeen` for the list/filters.
- **Payload hardening:** client ingest body size-capped, fields length-truncated, schema-validated; no PII forwarded (evlog redacts pre-write).
- **Cost control:** write-amplification guard + bounded occurrences + capped affected-sets keep Firestore writes/reads bounded under error storms.
- **Perf:** dashboard reads scoped + paginated; heavy cells virtualized; animations GPU-friendly and reduced-motion aware.

## Testing

- **Vitest (web):** fingerprint message-normalization; client-reporter batching/dedup/beacon; `mapObservabilityErrorStatus`.
- **Jest (functions):** ingest transaction idempotency; recurrence reopen (resolved→unresolved); write-amplification cap; self-protection swallow (logging failure never throws); severity mapping.
- **`@firebase/rules-unit-testing`:** superadmin can read / non-superadmin denied / any client write denied — on all observability collections.
- **Playwright (e2e):** superadmin reaches `/admin/observability`; non-superadmin → `/403`; triage resolve persists and survives reload; resolved issue reopens after a new occurrence.

Each test fails without the corresponding code and passes with it (per Bug Fix Policy / senior bar).

## Out of scope (YAGNI)

Assignment to people, comments/threads, external notifications (email/Slack), source-map symbolication, cross-service alerting rules. Can follow later; not in v1.
