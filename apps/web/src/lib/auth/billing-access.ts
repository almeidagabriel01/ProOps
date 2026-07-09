import { isFreeTierAllowedPath } from "@/lib/auth/resolve-user-home";

// Grace period matches TENANT_PLAN_PAST_DUE_GRACE_DAYS on the backend (default: 7 days).
// Keep in sync with apps/functions/src/api/middleware/require-active-subscription.ts
export const PAST_DUE_GRACE_DAYS = 7;

const BLOCKED_STATUSES = new Set([
  "canceled",
  "cancelled",
  "unpaid",
  "inactive",
  "payment_failed",
]);

export function isGracePeriodActive(
  pastDueSince: string | null,
  nowMs: number = Date.now(),
): boolean {
  if (!pastDueSince) return false;
  const referenceMs = Date.parse(pastDueSince);
  if (!Number.isFinite(referenceMs)) return false;
  const graceMs = PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000;
  return nowMs - referenceMs <= graceMs;
}

export function isBillingAllowed(
  subscriptionStatus: string,
  pastDueSince: string | null,
  nowMs: number = Date.now(),
): boolean {
  if (
    !subscriptionStatus ||
    subscriptionStatus === "active" ||
    subscriptionStatus === "trialing"
  ) {
    return true;
  }
  if (subscriptionStatus === "past_due") {
    return isGracePeriodActive(pastDueSince, nowMs);
  }
  if (BLOCKED_STATUSES.has(subscriptionStatus)) {
    return false;
  }
  // Unknown status — fail-open. Firestore rules and backend middleware are the final gate.
  return true;
}

export interface BillingAccessDecision {
  allowed: boolean;
  status: string;
  reason?: string;
}

/**
 * Server-side access decision for the proxy billing gate.
 *
 * A `role === "free"` account is a DEMO account (Feature B): it may browse the
 * free-tier allowlist regardless of any leftover `subscriptionStatus` (e.g.
 * "canceled" from a churned trial). Only the allowlist gates it — NEVER the
 * billing status. Paying roles are gated by their subscription status.
 */
export function resolveBillingAccess(params: {
  role: string | null | undefined;
  subscriptionStatus: string;
  pastDueSince: string | null;
  requestedPath: string;
  nowMs?: number;
}): BillingAccessDecision {
  const isFreeUser = String(params.role || "").toLowerCase() === "free";
  if (isFreeUser) {
    if (params.requestedPath && !isFreeTierAllowedPath(params.requestedPath)) {
      return { allowed: false, status: "free", reason: "free_tier_forbidden" };
    }
    return { allowed: true, status: "free" };
  }

  const allowed = isBillingAllowed(
    params.subscriptionStatus,
    params.pastDueSince,
    params.nowMs,
  );
  return { allowed, status: params.subscriptionStatus };
}
