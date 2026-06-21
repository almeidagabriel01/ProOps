# Total Error Capture — Design

**Date:** 2026-06-21
**Status:** Approved (pending spec review)
**Scope:** Error observability (evlog) capture coverage — frontend + backend

## Problem

The observability pipeline (`error_issues` → `/admin/observability`) currently captures only:
uncaught React render errors (error boundary), unhandled promise rejections + `window.onerror`
(frontend), and **thrown** Express route errors (backend). Everything else is invisible:
silently-caught `callApi` failures, error-status responses that don't throw, server actions,
cron failures, and Stripe webhook handler errors. The user wants **maximum** capture — every
error, every page, every action — accepting extra noise.

## Decisions (from brainstorming)

1. Auto-report every `callApi`/`callPublicApi` failure (including 4xx) from the client.
2. Patch `console.error` globally — but **only report when the first arg is an `Error`** (or has
   a `.stack`); plain-string React/lib dev warnings are skipped to cut noise.
3. Capture cron failures and Stripe webhook handler errors into the pipeline.
4. Capture server-action / server-component errors.
5. Backend: capture **all** responses with `status >= 400` that didn't throw (incl. expected
   401/403/404/validation) — user accepts the volume.

## Grounding (real signatures)

- `reportClientError(err: unknown, ctx?: { route?: string }): void` — buffers + dedupes
  (`errorType|message|route`), sends via `sendBeacon`/raw `fetch`. Does **not** use `callApi`
  (no recursion). `apps/web/src/lib/observability/client-error-reporter.ts`.
- `buildClientErrorPayload(err, ctx?: { route?})` → `{errorType,message,stack,route,status}`;
  `status` is currently always `null`. `apps/web/src/lib/observability/report-error.ts`.
- `installClientErrorReporter()` installs the global listeners; mounted app-wide via
  `<ErrorReporterInstaller/>` in `apps/web/src/app/layout.tsx`.
- `callApi`/`callPublicApi` throw `ApiError(status,message,data)` on `!ok`; both currently
  `console.error` on failure (except 402). `apps/web/src/lib/api-client.ts`.
- `captureError(err, ctx: { source, route?, method?, status?, uid?, tenantId?, userAgent?,
  handled })` — never throws; the ingest path self-excludes from re-capture.
  `apps/functions/src/lib/observability/error-logger.ts`.
- Global Express error handler sets nothing on `res` today; lives in
  `apps/functions/src/api/index.ts` (~553-591), calls `captureError(...handled:false)`.

## Architecture

### A. Frontend

**A1. `report-error.ts` — payload accepts status.**
Extend `buildClientErrorPayload(err, ctx?: { route?; status? })`: set `status` from
`ctx.status ?? null`. Extend `dedupeKey` to include status
(`errorType|message|route|status`). The client-error ingest endpoint already accepts `status`.
HTTP method is **not** a separate payload field — callers fold it into the `route` string
(`"<METHOD> <path>"`), so no backend contract change.

**A2. `client-error-reporter.ts` — accept rich ctx + console.error patch.**
- `reportClientError(err, ctx?: { route?; status? })` — forward the new field to
  `buildClientErrorPayload`.
- In `installClientErrorReporter()`, wrap `console.error`: save the original, replace with a
  function that (a) always calls the original, then (b) if the **first argument is an `Error`**
  (or an object with a string `.stack`), calls `reportClientError(firstArg)`. A module-level
  `reentrant` boolean guards against a report path that itself calls `console.error`. The
  uninstall closure restores the original `console.error`.

**A3. `api-client.ts` — auto-report on failure.**
In both `callApi` and `callPublicApi`, replace the existing `console.error("API Call Failed…")`
block with a `reportClientError(error, { route: "<METHOD> <path>", status, method })` call,
then rethrow (unchanged control flow). Skip reporting when `path` starts with
`/v1/observability` (prevents a failing report from looping). Keep the existing 402 exclusion
(402 is the plan-limit signal, not an error). `status` = `error instanceof ApiError ? error.status
: null`. Includes 4xx per decision 1.

**A4. Server actions — `withServerErrorReporting`.**
New `apps/web/src/lib/observability/report-server-error.ts`:
- `reportServerError(err, ctx: { route?; status?; method? }): Promise<void>` — resolves the
  backend upstream base URL the same way the proxy route does (read the existing resolution
  helper used by `apps/web/src/app/api/backend/[...path]/route.ts`), then `fetch`es
  `POST <base>/v1/observability/client-error` with the JSON payload built from the error.
  Never throws.
- `withServerErrorReporting<T extends (...a:any[])=>Promise<any>>(fn, ctx?): T` — wraps a server
  action: `try { return await fn(...) } catch (e) { await reportServerError(e, ctx); throw e }`.
Apply the wrapper to existing `"use server"` actions (e.g. `apps/web/src/app/actions/auth.ts`).

### B. Backend

**B1. Response-finalizer middleware — capture non-throw error responses.**
New `apps/functions/src/api/middleware/error-response-capture.ts`: an Express middleware
registered early (after `requestId`/auth context attach, before routes) that attaches
`res.on("finish", ...)`. On finish, if `res.statusCode >= 400` **and** `res.locals.__obsCaptured`
is not `true` **and** the path is not excluded → `captureError({...synthetic}, { source:
"functions", route: req.path, method: req.method, status: res.statusCode, uid:
req.user?.uid ?? null, tenantId: req.user?.tenantId ?? null, handled: true })`. The synthetic
error: `{ name: "HttpError", message: \`HTTP ${status} ${method} ${path}\` }`.
- The global error handler sets `res.locals.__obsCaptured = true` before/after its
  `captureError` call so thrown 5xx are not double-captured here.
- Excluded path prefixes: `/v1/observability`, `/internal`, `/api/health` (and `/health`).
- Captures all `>= 400` per decision 5.

**B2. Crons — capture in top-level catch.**
In each of the 5 scheduled functions (`checkDueDates`, `checkManualSubscriptions`,
`checkStripeSubscriptions`, `reportWhatsappOverage`, `cleanupStorageAndSharedLinks`), inside the
existing top-level `catch (error) { … }`, add
`await captureError(error, { source: "functions", route: "cron/<name>", handled: false })` next
to the existing `console.error`/`logger`. No change to cron business logic or idempotency.

**B3. Stripe webhook — capture handler + outer-catch errors.**
In `apps/functions/src/stripe/stripeWebhook.ts`, at the handler-error site and the outer generic
catch, add `await captureError(error, { source: "functions", route:
"stripeWebhook/<eventType-or-unknown>", handled: false })` alongside the existing security-event
logging. Signature verification (400) and event processing/idempotency are unchanged.

### C. Anti-loop / anti-flood guards (must hold)

- Reporter dedupes by `errorType|message|route|status` within the buffer window.
- Backend ingest rate-guard (30/fingerprint/10s) caps storms.
- A2 reentrancy flag; A3 skips `/v1/observability`; B1 skips `/v1/observability` + `/internal`
  + health; `reportServerError` (A4) and the client reporter never call `callApi`.

## Error handling

Every new capture call is best-effort and must never break the host flow:
`reportClientError` already swallows; `captureError` already swallows; `reportServerError`
swallows. The `console.error` patch and the api-client report are wrapped so a reporting failure
never masks the original error (original `console.error` runs first; rethrow always happens).

## Testing

- **Web (Vitest):**
  - `api-client`: reports on 4xx and 5xx with `{route,status,method}`; rethrows; skips reporting
    for `/v1/observability` paths; still excludes 402 from reporting.
  - `client-error-reporter`: `console.error(new Error(...))` triggers one report; `console.error
    ("string warning")` triggers none; reentrancy guard prevents recursion; uninstall restores
    original `console.error`.
  - `report-error`: payload carries `status`/`method`; `dedupeKey` includes status.
- **Functions (Jest):**
  - `error-response-capture`: 404/422/500 non-throw responses → one `captureError` with right
    status; thrown response with `res.locals.__obsCaptured=true` → skipped; `/v1/observability`,
    `/internal`, health → skipped.
  - one cron catch path → `captureError` called (mock the cron body to throw).

## Deploy notes

- Stripe webhook + crons are billing-adjacent → **medium/high risk**. Changes are capture-only
  inside existing catch blocks; no billing/idempotency logic touched. Deploy to **dev first**,
  validate, then prod.
- No Firestore schema/index change; no new collections. Observability writes unchanged.
- Expect high dashboard volume (all 4xx + Error-level console.error). Intended.

## Out of scope (YAGNI)

- Reporting plain-string `console.error` warnings (A2 limited to Error objects).
- console.error patch on the backend (backend uses structured logger already; B1+B2+B3 cover it).
- Sampling/quota controls, per-route mute lists, alerting — not requested.
