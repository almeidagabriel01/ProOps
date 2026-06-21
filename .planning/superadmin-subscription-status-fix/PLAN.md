# Plan v2 — Fix SuperAdmin subscription status flip (Cancelado → Ativo)

> v2 incorporates two adversarial reviews (architecture+correctness, security+regression).

## Confirmed root cause
The flip is **single-sourced in the realtime hook**.
- Backend `getAllTenantsBilling` returns root `subscriptionStatus = effectiveStatus`
  (`admin.controller.ts:1086`), normalized from the **user** doc via `deriveTenantStatus`
  (only ever `free|past_due|inactive|active`). Card reads this root value → **first paint correct**
  (cancelled sub → `inactive` → "Conta inativa" banner).
- Because `isBillingStale===true`, the hook attaches `onSnapshot(tenants/{id})`
  (`useTenantManagement.ts:102-136`) and overwrites root `subscriptionStatus` with the **raw**
  tenant-doc field (`:116-118`) — un-normalized, applied on the *first* snapshot before the
  background sync completes. Raw `"active"` → card flips to green "Ativo".

Secondary defect: status derivation is duplicated in 4 places; root (user-doc) and
`admin.subscriptionStatus` (raw tenant-doc, `:1080`) can disagree; the card re-derives a 5th time
(`tenant-card.tsx:60-64`).

## Goal
One canonical, time-aware derivation used by every display path. Realtime updates must never show a
less-normalized value than the initial API and must not flip before the sync that triggered them
actually lands. No change to **stored** values or **write-gating** middleware.

---

## Changes

### 1. Shared pure module (display derivation)
Mirror in `apps/functions/src/shared/subscription-status.ts` and
`apps/web/src/lib/subscription-status.ts`. Rationale corrected: `apps/functions` is **not** an npm
workspace (root `package.json` workspaces = `["apps/web"]` only) and has its own Jest runner, so a
single shared import is awkward; we mirror the file and guard against drift with a **shared JSON
test-vector file** at `apps/shared-test-vectors/subscription-status.vectors.json`, consumed by both
the Vitest (web) and Jest (functions) suites (configure `roots`/import path in each runner).

```ts
export type SubscriptionDisplayStatus =
  | "free" | "active" | "canceling" | "past_due" | "inactive" | "canceled";
export function deriveSubscriptionDisplayStatus(i: {
  planId?: string|null; storedStatus?: string|null;
  cancelAtPeriodEnd?: boolean|null; currentPeriodEnd?: string|null; nowMs?: number;
}): SubscriptionDisplayStatus;
```
Rule order (first match wins):
1. `planId==="free"` → `free`
2. normalize `storedStatus` (lowercase/trim, `cancelled`→`canceled`)
3. `past_due` → `past_due`
4. `unpaid|inactive|payment_failed` → `inactive`
5. `canceled` → `canceled`  *(strictly above rule 6)*
6. (`active|trialing|empty`) **and** `cancelAtPeriodEnd`:
   period present and `<= now` → `canceled`; else → `canceling`
7. empty `storedStatus` **and** period `<= now` → `inactive`
8. `trialing` → `active`; otherwise → `active`
- `nowMs` injectable (tests). Backend uses server time. Frontend client time only fills the gap
  between sync-completion and re-render (display-only, middleware fail-open) — accepted minor skew.

### 2. Card + badge consume the shared fn (remove the 4th/5th copies)
- `tenant-card.tsx`: compute `status = deriveSubscriptionDisplayStatus({planId, storedStatus:
  subscriptionStatus, cancelAtPeriodEnd: admin.subscription?.cancelAtPeriodEnd, currentPeriodEnd})`,
  one switch for label/color/icon/banner. Keep `cancelAtPeriodEnd`/`currentPeriodEnd` flowing for
  the date label. Preserves existing UX (`Encerrando`/`Cancelado`/`Inativo`/`Atrasado`/`Ativo`).
- `status-badge.tsx`: switch extended to full enum so the overview table matches cards.

### 3. Harden the realtime hook (`useTenantManagement.ts`) — the actual flip fix
- Read `subscriptionStatus`, `cancelAtPeriodEnd`, `currentPeriodEnd`, **and `plan`** from the doc.
- **Gate:** capture each stale tenant's `billingSyncedAt` baseline on attach; apply the snapshot
  **only** when `data.billingSyncedAt` is a string that advanced past the baseline (or `plan`/status
  resolves to `free`). `undefined` baseline → any string counts as advance. ISO strings from
  `new Date().toISOString()` are lexicographically safe to compare. This prevents the premature
  flip — the correct initial value holds until the triggering sync truly lands.
- On apply, set the card fields from the doc (raw inputs); the **card** derives display via the
  shared fn — so even a raw `"active"` with `cancelAtPeriodEnd`+lapsed renders `canceled`, never a
  green flip.
- **Safety timeout (15s):** if no advancing snapshot arrives (sync no-op/failure, or non-MFA
  superadmin hitting `permission-denied` on the listener), clear `isBillingStale` and keep the last
  value (no worse than today; skeleton never sticks). Add an `onSnapshot` error callback feeding the
  same path. Clear timers in the effect cleanup to avoid leaks across `loadTenants` re-runs
  (pagination/save/recompute re-attach the effect).

### 4. Backend read-path consistency (`admin.controller.ts` getAllTenantsBilling)
- Make root `subscriptionStatus` authoritative from the **tenant doc** through the shared fn:
  `deriveSubscriptionDisplayStatus({planId, storedStatus: tenantData.subscriptionStatus,
  cancelAtPeriodEnd: tenantData.cancelAtPeriodEnd, currentPeriodEnd: tenantData.currentPeriodEnd})`,
  falling back to user-doc-derived input only when the tenant doc has no billing fields (legacy).
  This aligns first paint with the post-sync snapshot and resolves the root-vs-admin divergence.
- No `TenantBillingInfo` shape change; keep `admin.subscription`/`currentPeriodEnd` as the card reads.

### 5. Overview regression handling (NEW — flagged by review H2)
The enum now yields `canceling`/`canceled`, which the overview never saw.
- `useTenantsData.ts` metrics: count `active` **and** `canceling` as the "active" headline
  (canceling = still paying through period end).
- Overview status filter: add `canceling`/`canceled` options (or a bucket map) so those tenants
  remain filterable; today the filter only has `all|active|inactive|free`.
- `status-badge.tsx` already updated in change 2.

### 6. DROPPED: billing-sync canonical-selection tweak
Both reviews: changing **stored** status in `billing-sync.service.ts` crosses into write/read
gating (`require-active-subscription.ts:184`, `firestore.rules:213,225`) and could lock out a
paying customer Stripe still considers active; also risks divergence with `runStripeSync`. The
display-layer rule 6 already handles the lapsed cancel-at-period-end case. **Stored semantics stay
exactly as today.** On-demand sync already writes `canceled` correctly when Stripe has no active
subs — combined with the gating fix (change 3), the snapshot then shows the correct value.

---

## Existing-data reconciliation
- Display+gating fixes correct the UI for all lapsed cancel-at-period-end docs immediately.
- For docs genuinely stale-active in Firestore while Stripe is canceled, the existing on-demand sync
  (already firing via `enqueueTenantSync`) reconciles them; the **SubscriptionSyncCard** (dry-run →
  live) is the manual backfill. We verify the affected tenants via Stripe MCP (needs env + customer
  id — see open questions).

## Tests (Bug Fix Policy — fails without fix, passes with)
- Shared vectors (web Vitest + functions Jest): free; active; trialing→active; active+CAPE future→
  canceling; active+CAPE lapsed→canceled; canceled; unpaid→inactive; past_due; empty+lapsed→inactive;
  active+lapsed+not-canceling→active.
- Backend: `getAllTenantsBilling` root status normalized (tenant active+past period, canceled,
  legacy fallback to user doc, free).
- Frontend hook: no apply until `billingSyncedAt` advances; applies normalized; 15s timeout clears
  stale; timer cleanup; error callback.
- Card render: each enum → correct label/banner.

## Safety / rollout
- No Firestore schema/rules/index change. No write-gating change. No stored-value change.
- Read/display + pure functions = low risk. Commit per unit. Deploy dev, validate the 6 cards,
  then prod (user-controlled, never auto-merge to main).

## Files
- NEW `apps/functions/src/shared/subscription-status.ts` (+ Jest test)
- NEW `apps/web/src/lib/subscription-status.ts` (+ Vitest test)
- NEW `apps/shared-test-vectors/subscription-status.vectors.json`
- `apps/functions/src/api/controllers/admin.controller.ts`
- `apps/web/src/app/admin/_hooks/useTenantManagement.ts`
- `apps/web/src/app/admin/_components/tenant-card.tsx`
- `apps/web/src/app/admin/overview/_components/status-badge.tsx`
- `apps/web/src/app/admin/overview/_hooks/useTenantsData.ts`
