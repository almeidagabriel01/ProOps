import { Request, Response, NextFunction } from "express";
import { LRUCache } from "lru-cache";
import { db } from "../../init";
import { evaluateSubscriptionStatusAccess } from "../../lib/tenant-plan-policy";
import { logger } from "../../lib/logger";
import {
  buildSecurityLogContext,
  writeSecurityAuditEvent,
} from "../../lib/security-observability";

interface CachedBillingState {
  subscriptionStatus: string;
  plan: string;
  pastDueSince: string | null;
}

const BILLING_CACHE_MAX_SIZE = 500;
const billingStateCache = new LRUCache<string, CachedBillingState>({
  max: BILLING_CACHE_MAX_SIZE,
  ttl: 30_000, // hard-coded per CONTEXT.md decision (LRU cache replacement; no env override)
});

const WHITELISTED_PREFIXES = [
  "/v1/stripe/",
  "/v1/admin/",
  "/v1/users/me",
  "/v1/auth/",
  "/v1/billing/",
  "/v1/validation/",
  "/v1/notifications",
  "/v1/aux/",
  "/health",
  "/internal/",
  "/v1/ai/",
  "/authenticated",
];

function isWhitelistedPath(path: string): boolean {
  return WHITELISTED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function normalizePastDueSince(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value || null;
  return null;
}

export function invalidateBillingCache(tenantId: string): void {
  billingStateCache.delete(tenantId);
}

export async function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (isWhitelistedPath(req.path)) {
    next();
    return;
  }

  const user = req.user;

  if (!user) {
    next();
    return;
  }

  if (user.isSuperAdmin) {
    next();
    return;
  }

  if (!user.hasRequiredClaims) {
    next();
    return;
  }

  const tenantId = user.tenantId;
  if (!tenantId || !tenantId.trim()) {
    next();
    return;
  }

  let billingState: CachedBillingState | undefined = billingStateCache.get(tenantId);

  if (!billingState) {
    try {
      const tenantSnap = await db.collection("tenants").doc(tenantId).get();
      if (!tenantSnap.exists) {
        next();
        return;
      }

      const data = tenantSnap.data() as Record<string, unknown> | undefined;
      const subscriptionStatus = String(data?.subscriptionStatus || "").trim().toLowerCase();
      const plan = String(data?.plan || "").trim().toLowerCase();
      const pastDueSince = normalizePastDueSince(data?.pastDueSince);

      billingState = {
        subscriptionStatus,
        plan,
        pastDueSince,
      };
      billingStateCache.set(tenantId, billingState);
    } catch (err) {
      logger.warn("require_active_subscription: firestore_read_error", {
        tenantId,
        uid: user.uid,
        error: err instanceof Error ? err.message : String(err),
      });
      next();
      return;
    }
  }

  const { subscriptionStatus, pastDueSince } = billingState;

  if (
    subscriptionStatus === "free" ||
    subscriptionStatus === "" ||
    subscriptionStatus === "active" ||
    subscriptionStatus === "trialing"
  ) {
    next();
    return;
  }

  const graceDays = parseInt(
    process.env.TENANT_PLAN_PAST_DUE_GRACE_DAYS || "7",
    10,
  );

  const decision = evaluateSubscriptionStatusAccess({
    subscriptionStatus,
    pastDueSince: pastDueSince || undefined,
    graceDays,
  });

  if (decision.allowWrite) {
    next();
    return;
  }

  logger.warn(
    "billing_subscription_blocked",
    buildSecurityLogContext(req, {
      tenantId,
      uid: user.uid,
      reason: decision.reasonCode,
      source: "require_active_subscription",
      status: 402,
    }),
  );

  void writeSecurityAuditEvent({
    eventType: "BILLING_SUBSCRIPTION_BLOCK",
    tenantId,
    uid: user.uid,
    source: "require_active_subscription",
    reason: decision.reasonCode,
    route: req.path,
    status: 402,
  });

  res.status(402).json({
    message: "Acesso bloqueado. Regularize sua assinatura para continuar.",
    code: "BILLING_INACTIVE",
    reason: decision.reasonCode,
  });
}
