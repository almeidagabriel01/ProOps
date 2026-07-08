import { Request, Response, NextFunction } from "express";
import {
  getTenantDocCached,
  invalidateTenantDoc,
} from "../../lib/tenant-doc-cache";
import { evaluateSubscriptionStatusAccess } from "../../lib/tenant-plan-policy";
import { logger } from "../../lib/logger";
import {
  buildSecurityLogContext,
  writeSecurityAuditEvent,
} from "../../lib/security-observability";

const WHITELISTED_PREFIXES = [
  "/v1/stripe/",
  "/v1/admin/",
  "/v1/users/me",
  "/v1/auth/",
  "/v1/billing/",
  "/v1/validation/",
  "/v1/ai/",            // AI routes carry their own tier/subscription checks (403 AI_FREE_TIER_BLOCKED)
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
  "/health",
  "/internal/",
  "/authenticated",
];

function isFreeTierAllowedPath(path: string): boolean {
  return FREE_TIER_ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

// ERP resource read endpoints a free-tier / demo account may GET (read-only
// demo mode, Feature B). Only GET is allowed; POST/PUT/DELETE stay blocked with
// 402 so the account can browse but never mutate. These handlers still scope
// every query to the caller's own tenantId, so this never leaks other tenants'
// data — the shared demo dataset is served via direct-Firestore reads gated by
// the `__demo__` Firestore rule, not through these endpoints.
const DEMO_READABLE_PREFIXES = [
  "/v1/proposals",
  "/v1/products",
  "/v1/services",
  "/v1/clients",
  "/v1/transactions",
  "/v1/wallets",
  "/v1/spreadsheets",
  "/v1/kanban",
  "/v1/calendar",
  "/v1/ambientes",
  "/v1/sistemas",
  "/v1/notifications",
  "/v1/custom-fields",
  "/v1/options",
  "/v1/proposal-templates",
];

function isDemoReadablePath(path: string): boolean {
  return DEMO_READABLE_PREFIXES.some((prefix) => path.startsWith(prefix));
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
  invalidateTenantDoc(tenantId);
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

  let subscriptionStatus = "";
  let pastDueSince: string | null = null;
  try {
    // Cache compartilhado (5s) do doc tenant — mesma fonte do tenant-plan-policy.
    const tenantState = await getTenantDocCached(tenantId);
    if (!tenantState.exists) {
      next();
      return;
    }
    subscriptionStatus = String(tenantState.data?.subscriptionStatus || "")
      .trim()
      .toLowerCase();
    pastDueSince = normalizePastDueSince(tenantState.data?.pastDueSince);
  } catch (err) {
    logger.warn("require_active_subscription: firestore_read_error", {
      tenantId,
      uid: user.uid,
      error: err instanceof Error ? err.message : String(err),
    });
    next();
    return;
  }

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
    // Read-only demo mode: allow GET on ERP resource endpoints so a free
    // account can browse the product, but block every mutation with 402.
    if (req.method === "GET" && isDemoReadablePath(req.path)) {
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

  // Allow empty status (legacy tenants), active, and "free" (free-tier tenants
  // seeded without a Stripe subscription). The plan-limit check inside each route
  // handler (e.g. PLAN_LIMIT_PROPOSALS_MONTHLY) is responsible for enforcing limits
  // on free tenants — blocking them here would shadow that error with BILLING_INACTIVE.
  if (
    subscriptionStatus === "" ||
    subscriptionStatus === "active" ||
    subscriptionStatus === "trialing" ||
    subscriptionStatus === "free"
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
