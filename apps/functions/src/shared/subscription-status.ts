/**
 * Canonical, time-aware derivation of a tenant's *display* subscription status.
 *
 * This is the single source of truth for how a raw stored billing status (plus
 * the cancel-at-period-end flag and period end) maps to a user-facing status in
 * the SuperAdmin dashboard. It exists to stop the historical bug where each read
 * path (backend list endpoint, the realtime onSnapshot listener, the card, the
 * overview badge) re-derived status differently — most importantly the listener
 * showing a raw `active` for a subscription whose period had already lapsed.
 *
 * IMPORTANT: this file is intentionally MIRRORED at
 * `apps/web/src/lib/subscription-status.ts`. The two implementations MUST stay
 * byte-for-byte equivalent in behavior. They are kept honest by a shared set of
 * test vectors at `apps/shared-test-vectors/subscription-status.vectors.json`,
 * exercised by both the Jest (functions) and Vitest (web) suites.
 *
 * This derives DISPLAY status only. It does NOT change stored values and is not
 * used for write/read access gating — that remains in
 * `require-active-subscription` / `tenant-plan-policy`, which read raw values.
 */

export type SubscriptionDisplayStatus =
  | "free"
  | "active"
  | "canceling"
  | "past_due"
  | "inactive"
  | "canceled";

export interface DeriveSubscriptionStatusInput {
  /** Tenant/user plan tier. `free` short-circuits to a free display status. */
  planId?: string | null;
  /** Raw `subscriptionStatus` as stored in Firestore / returned by Stripe. */
  storedStatus?: string | null;
  /** Stripe `cancel_at_period_end` flag. */
  cancelAtPeriodEnd?: boolean | null;
  /** ISO 8601 period end. Used to resolve cancel-at-period-end into canceled. */
  currentPeriodEnd?: string | null;
  /** Injectable clock for deterministic tests. Defaults to `Date.now()`. */
  nowMs?: number;
}

function normalizeStatus(value?: string | null): string {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "cancelled" ? "canceled" : v;
}

function isPeriodLapsed(currentPeriodEnd?: string | null, nowMs?: number): boolean {
  if (!currentPeriodEnd) return false;
  const endMs = Date.parse(currentPeriodEnd);
  if (!Number.isFinite(endMs)) return false;
  const now = Number.isFinite(nowMs as number) ? (nowMs as number) : Date.now();
  return endMs <= now;
}

/**
 * Map a raw billing state to a display status. Rule order (first match wins):
 *
 * Lifecycle/terminal statuses are evaluated BEFORE the free tier, on purpose:
 * when a paid subscription is cancelled, billing sync downgrades the tenant's
 * `plan` to `free` while `subscriptionStatus` becomes `canceled`. The plan tier
 * must NOT mask that — a cancelled Pro must read "Cancelado", never "Gratuito".
 *
 *  1. `past_due` -> `past_due`
 *  2. `unpaid` | `inactive` | `payment_failed` -> `inactive`
 *  3. `canceled` -> `canceled`  (strictly above cancel-at-period-end handling)
 *  4. (`active` | `trialing` | empty) + cancelAtPeriodEnd:
 *        period lapsed -> `canceled`, else -> `canceling`
 *  5. explicit `free` status OR plan tier `free` -> `free` (genuine free tier;
 *        reached only when the status above is benign)
 *  6. empty status + period lapsed -> `inactive`
 *  7. otherwise (active / trialing / unknown-non-blocking) -> `active`
 */
export function deriveSubscriptionDisplayStatus(
  input: DeriveSubscriptionStatusInput,
): SubscriptionDisplayStatus {
  const status = normalizeStatus(input.storedStatus);
  const cancelAtPeriodEnd = Boolean(input.cancelAtPeriodEnd);
  const lapsed = isPeriodLapsed(input.currentPeriodEnd, input.nowMs);

  if (status === "past_due") return "past_due";
  if (status === "unpaid" || status === "inactive" || status === "payment_failed") {
    return "inactive";
  }
  if (status === "canceled") return "canceled";

  if ((status === "active" || status === "trialing" || status === "") && cancelAtPeriodEnd) {
    return lapsed ? "canceled" : "canceling";
  }

  const planId = String(input.planId ?? "").trim().toLowerCase();
  if (status === "free" || planId === "free") return "free";

  if (status === "" && lapsed) return "inactive";

  return "active";
}
