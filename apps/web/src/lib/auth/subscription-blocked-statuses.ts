// Statuses que tornam a assinatura efetivamente bloqueada (sem grace period)
export const HARD_BLOCKED_STATUSES: Set<string> = new Set([
  "canceled",
  "cancelled",
  "unpaid",
  "inactive",
  "payment_failed",
]);

// Grace period em dias (espelha TENANT_PLAN_PAST_DUE_GRACE_DAYS no backend e billing-status API)
export const PAST_DUE_GRACE_DAYS = 7;

// Verifica se o grace period de past_due ainda está ativo
export function isGracePeriodActive(pastDueSince: string | null | undefined): boolean {
  if (!pastDueSince) return false;
  const referenceMs = Date.parse(pastDueSince);
  if (!Number.isFinite(referenceMs)) return false;
  const graceMs = PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - referenceMs <= graceMs;
}

// Determina se o usuário está efetivamente bloqueado (mesma lógica da billing-status API)
export function isSubscriptionBlocked(
  subscriptionStatus: string | null | undefined,
  pastDueSince?: string | null,
): boolean {
  if (!subscriptionStatus || subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    return false;
  }
  if (subscriptionStatus === "past_due") {
    // fail-closed: sem pastDueSince → bloqueado
    if (!pastDueSince) return true;
    return !isGracePeriodActive(pastDueSince);
  }
  return HARD_BLOCKED_STATUSES.has(subscriptionStatus);
}
