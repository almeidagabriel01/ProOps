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
  pastDueSince: string | null;
}

const BILLING_CACHE_MAX_SIZE = 500;
const billingStateCache = new LRUCache<string, CachedBillingState>({
  max: BILLING_CACHE_MAX_SIZE,
  ttl: 5_000, // hard-coded per CONTEXT.md decision (LRU cache replacement; no env override)
});

const WHITELISTED_PREFIXES = [
  "/v1/stripe/",
  "/v1/admin/",
  "/v1/users/me",
  "/v1/auth/",
  "/v1/billing/",
  "/v1/validation/",
  "/v1/aux/proxy-image", // proxy-image is public; other /v1/aux/* routes are authenticated mutations
  "/health",
  "/internal/",
  "/authenticated",
];

// Routes a free-tier account is explicitly allowed to call. Subset of the
// whitelist plus the endpoints needed to manage one's own profile and tenant
// metadata from the /profile page. Anything outside this list is blocked
// with HTTP 402 so a free user cannot reach ERP endpoints (proposals,
// transactions, wallets, contacts, calendar, kanban, etc.) via direct API
// hits even if a stale session cookie lets them past the Next.js middleware.
const FREE_TIER_ALLOWED_PREFIXES = [
  "/v1/stripe/",
  "/v1/users/me",
  "/v1/auth/",
  "/v1/billing/",
  "/v1/validation/",
  "/v1/profile",
  "/v1/tenants/", // GET own tenant (multi-tenant isolation is enforced separately)
  "/v1/aux/proxy-image",
  "/health",
  "/internal/",
  "/authenticated",
];

function isFreeTierAllowedPath(path: string): boolean {
  return FREE_TIER_ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

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
    // Auth middleware may have populated tenantId from users-doc fallback.
    // If tenantId is still absent, we cannot determine subscription — allow.
    if (!user.tenantId || !user.tenantId.trim()) {
      next();
      return;
    }
    // Fall through to billing check using the fallback tenantId.
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
      const pastDueSince = normalizePastDueSince(data?.pastDueSince);

      billingState = {
        subscriptionStatus,
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

  // Free tier guard. Uses the USER role from the JWT claim (authoritative)
  // rather than the tenant's `plan` field, which can be desynchronized
  // (legacy tenants with `plan: "free"` but `subscriptionStatus: "active"`
  // exist in prod from before the billing-sync was wired up). The user
  // role is what determines whether an account is on the free tier — if
  // role is admin/master/member/wk, the user pays, full stop.
  const isFreeUser = String(user.role || "").toLowerCase() === "free";
  if (isFreeUser) {
    if (isFreeTierAllowedPath(req.path)) {
      next();
      return;
    }
    logger.warn(
      "billing_free_tier_blocked",
      buildSecurityLogContext(req, {
        tenantId,
        uid: user.uid,
        reason: "FREE_TIER_FORBIDDEN_ROUTE",
        source: "require_active_subscription",
        status: 402,
      }),
    );
    void writeSecurityAuditEvent({
      eventType: "BILLING_SUBSCRIPTION_BLOCK",
      tenantId,
      uid: user.uid,
      source: "require_active_subscription",
      reason: "FREE_TIER_FORBIDDEN_ROUTE",
      route: req.path,
      status: 402,
    });
    res.status(402).json({
      message: "Recurso disponível apenas para planos pagos. Assine um plano para continuar.",
      code: "FREE_TIER_FORBIDDEN",
    });
    return;
  }

  if (subscriptionStatus === "" || subscriptionStatus === "active") {
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
