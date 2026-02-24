import { Timestamp } from "firebase-admin/firestore";
import { db } from "../init";
import { getPriceConfig } from "../stripe/stripeConfig";
import {
  incrementSecurityCounter,
  logSecurityEvent,
  type SecurityCounterName,
  writeSecurityAuditEvent,
} from "./security-observability";

export type TenantPlanTier = "free" | "starter" | "pro" | "enterprise";
export type PlanEnforcementMode = "off" | "monitor" | "enforce";

export type PlanLimitFeature =
  | "maxProposalsPerMonth"
  | "maxWallets"
  | "maxUsers"
  | "storageQuotaMB"
  | "maxSpreadsheets";

export type TenantPlanLimits = Record<PlanLimitFeature, number>;

export type TenantPlanProfile = {
  tenantId: string;
  tier: TenantPlanTier;
  limits: TenantPlanLimits;
  subscriptionStatus: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  pastDueSince?: string;
  source: string;
};

type CachedPlan = {
  expiresAt: number;
  profile: TenantPlanProfile;
};

export type PlanEnforcementInput = {
  tenantId: string;
  feature: PlanLimitFeature;
  currentUsage?: number;
  usageKnown?: boolean;
  usageUnavailableCode?: string;
  incrementBy?: number;
  uid?: string;
  requestId?: string;
  route?: string;
  isSuperAdmin?: boolean;
  periodStart?: string;
  periodEnd?: string;
  resetAt?: string;
};

export type PlanEnforcementDecision = {
  allowed: boolean;
  mode: PlanEnforcementMode;
  profile: TenantPlanProfile;
  currentUsage: number;
  projectedUsage: number;
  limit: number;
  statusCode?: 402 | 403;
  code?: string;
  message?: string;
  bypassed?: boolean;
  wouldBlock?: boolean;
  periodStart?: string;
  periodEnd?: string;
  resetAt?: string;
};

export type MonthlyPeriodWindow = {
  startDate: Date;
  endDate: Date;
  periodStart: string;
  periodEnd: string;
  resetAt: string;
};

export type MonthlyUsageResult = {
  count: number | null;
  reliable: boolean;
  code?: "MONTHLY_USAGE_UNAVAILABLE";
  periodStart: string;
  periodEnd: string;
  resetAt: string;
};

export type SubscriptionStatusAccessDecision = {
  allowWrite: boolean;
  reasonCode:
    | "SUBSCRIPTION_OK"
    | "PAST_DUE_WITHIN_GRACE"
    | "PAST_DUE_MISSING_TIMESTAMP"
    | "PAST_DUE_GRACE_EXPIRED"
    | "SUBSCRIPTION_STATUS_BLOCKED";
};

type TelemetryHooks = {
  incrementCounter: typeof incrementSecurityCounter;
  logEvent: typeof logSecurityEvent;
  writeAudit: typeof writeSecurityAuditEvent;
};

const defaultTelemetryHooks: TelemetryHooks = {
  incrementCounter: incrementSecurityCounter,
  logEvent: logSecurityEvent,
  writeAudit: writeSecurityAuditEvent,
};

let telemetryHooks: TelemetryHooks = defaultTelemetryHooks;

const PLAN_CACHE = new Map<string, CachedPlan>();

const PLAN_LIMITS_BY_TIER: Record<TenantPlanTier, TenantPlanLimits> = {
  free: {
    maxProposalsPerMonth: 5,
    maxWallets: 2,
    maxUsers: 1,
    storageQuotaMB: 100,
    maxSpreadsheets: 5,
  },
  starter: {
    maxProposalsPerMonth: 80,
    maxWallets: 5,
    maxUsers: 2,
    storageQuotaMB: 200,
    maxSpreadsheets: 25,
  },
  pro: {
    maxProposalsPerMonth: -1,
    maxWallets: 30,
    maxUsers: 10,
    storageQuotaMB: 2560,
    maxSpreadsheets: 250,
  },
  enterprise: {
    maxProposalsPerMonth: -1,
    maxWallets: -1,
    maxUsers: -1,
    storageQuotaMB: -1,
    maxSpreadsheets: -1,
  },
};

function normalizePlanTier(value: unknown): TenantPlanTier | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    normalized === "free" ||
    normalized === "starter" ||
    normalized === "pro" ||
    normalized === "enterprise"
  ) {
    return normalized;
  }
  return null;
}

function normalizeSubscriptionStatus(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function resolvePlanCacheTtlMs(): number {
  const configured = Number(process.env.TENANT_PLAN_CACHE_TTL_MS || "");
  if (!Number.isFinite(configured)) return 30_000;
  return Math.min(Math.max(Math.floor(configured), 5_000), 300_000);
}

function resolvePlanEnforcementMode(): PlanEnforcementMode {
  const raw = String(process.env.TENANT_PLAN_ENFORCEMENT_MODE || "monitor")
    .trim()
    .toLowerCase();
  if (raw === "off" || raw === "monitor" || raw === "enforce") {
    return raw;
  }
  return "monitor";
}

function shouldAllowSuperAdminBypass(): boolean {
  return (
    String(process.env.TENANT_PLAN_SUPERADMIN_BYPASS || "true")
      .trim()
      .toLowerCase() !== "false"
  );
}

function shouldEnforceSubscriptionStatus(): boolean {
  return (
    String(process.env.TENANT_PLAN_ENFORCE_SUBSCRIPTION_STATUS || "false")
      .trim()
      .toLowerCase() === "true"
  );
}

function resolvePastDueGraceDays(): number {
  const configured = Number(process.env.TENANT_PLAN_PAST_DUE_GRACE_DAYS || "");
  if (!Number.isFinite(configured)) return 7;
  return Math.min(Math.max(Math.floor(configured), 0), 90);
}

function normalizeOptionalString(value: unknown): string | undefined {
  const normalized = String(value || "").trim();
  return normalized || undefined;
}

function toIsoStringOrUndefined(value: unknown): string | undefined {
  if (!value) return undefined;

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    const parsedDate = (value as { toDate: () => Date }).toDate();
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString();
    }
  }

  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) {
      return value.toISOString();
    }
    return undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsedDate = new Date(value);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString();
    }
    return undefined;
  }

  const parsedDate = new Date(String(value));
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString();
  }
  return undefined;
}

function parseIsoToMs(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function emitCounter(
  counter: SecurityCounterName,
  context: {
    requestId?: string;
    route?: string;
    tenantId?: string;
    uid?: string;
    reason?: string;
    source?: string;
    status?: number;
  },
): void {
  void Promise.resolve(telemetryHooks.incrementCounter(counter, context)).catch(
    () => undefined,
  );
}

function emitAudit(input: {
  eventType: string;
  requestId?: string;
  route?: string;
  status?: number;
  tenantId?: string;
  uid?: string;
  reason?: string;
  source?: string;
}): void {
  void Promise.resolve(
    telemetryHooks.writeAudit({
      eventType: input.eventType,
      requestId: input.requestId,
      route: input.route,
      status: input.status,
      tenantId: input.tenantId,
      uid: input.uid,
      reason: input.reason,
      source: input.source,
    }),
  ).catch(() => undefined);
}

function resolvePriceToTier(priceId: string): TenantPlanTier | null {
  if (!priceId) return null;
  const config = getPriceConfig();
  const normalizedPriceId = priceId.trim();
  const entries = Object.entries(config.plans) as Array<
    [string, { monthly: string; yearly: string }]
  >;
  for (const [tier, tierPrices] of entries) {
    if (
      tierPrices.monthly === normalizedPriceId ||
      tierPrices.yearly === normalizedPriceId
    ) {
      return normalizePlanTier(tier);
    }
  }
  return null;
}

async function resolveTierFromPlanId(planId: string): Promise<TenantPlanTier | null> {
  if (!planId) return null;
  const normalizedTier = normalizePlanTier(planId);
  if (normalizedTier) return normalizedTier;

  const planSnap = await db.collection("plans").doc(planId).get();
  if (!planSnap.exists) return null;
  return normalizePlanTier(planSnap.data()?.tier);
}

function buildProfileFromTier(input: {
  tenantId: string;
  tier: TenantPlanTier;
  subscriptionStatus: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  pastDueSince?: string;
  source: string;
}): TenantPlanProfile {
  return {
    tenantId: input.tenantId,
    tier: input.tier,
    limits: PLAN_LIMITS_BY_TIER[input.tier],
    subscriptionStatus: input.subscriptionStatus,
    stripeSubscriptionId: input.stripeSubscriptionId,
    stripePriceId: input.stripePriceId,
    pastDueSince: input.pastDueSince,
    source: input.source,
  };
}

export function buildCompatDefaultTenantPlanProfile(input: {
  tenantId: string;
  subscriptionStatus: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  pastDueSince?: string;
  requestId?: string;
  route?: string;
  uid?: string;
}): TenantPlanProfile {
  const profile = buildProfileFromTier({
    tenantId: input.tenantId,
    tier: "starter",
    subscriptionStatus: input.subscriptionStatus,
    stripeSubscriptionId: input.stripeSubscriptionId,
    stripePriceId: input.stripePriceId,
    pastDueSince: input.pastDueSince,
    source: "compat_default_starter",
  });

  telemetryHooks.logEvent(
    "tenant_plan_source_compat_default",
    {
      requestId: input.requestId,
      route: input.route,
      tenantId: input.tenantId,
      uid: input.uid,
      source: "tenant_plan_policy",
      reason: "compat_default_starter",
      status: 200,
    },
    "WARN",
  );
  emitCounter("plan_source_compat_default", {
    requestId: input.requestId,
    route: input.route,
    tenantId: input.tenantId,
    uid: input.uid,
    source: "tenant_plan_policy",
    reason: "compat_default_starter",
    status: 200,
  });
  return profile;
}

async function resolveTenantPlanProfileUncached(
  tenantId: string,
): Promise<TenantPlanProfile> {
  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  const tenantData = tenantSnap.exists
    ? (tenantSnap.data() as Record<string, unknown> | undefined)
    : undefined;

  const subscriptionStatus = normalizeSubscriptionStatus(
    tenantData?.subscriptionStatus,
  );
  const stripeSubscriptionId = normalizeOptionalString(
    tenantData?.stripeSubscriptionId,
  );
  const stripePriceId = normalizeOptionalString(
    tenantData?.priceId || tenantData?.stripePriceId,
  );
  const pastDueSince = toIsoStringOrUndefined(tenantData?.pastDueSince);

  const directTier =
    normalizePlanTier(tenantData?.plan) ||
    normalizePlanTier(tenantData?.planTier) ||
    normalizePlanTier(tenantData?.tier);
  if (directTier) {
    return buildProfileFromTier({
      tenantId,
      tier: directTier,
      subscriptionStatus,
      stripeSubscriptionId,
      stripePriceId,
      pastDueSince,
      source: "tenant.plan",
    });
  }

  const planId = String(tenantData?.planId || "").trim();
  const tierFromPlanId = await resolveTierFromPlanId(planId);
  if (tierFromPlanId) {
    return buildProfileFromTier({
      tenantId,
      tier: tierFromPlanId,
      subscriptionStatus,
      stripeSubscriptionId,
      stripePriceId,
      pastDueSince,
      source: "tenant.planId",
    });
  }

  const tierFromPrice = resolvePriceToTier(stripePriceId || "");
  if (tierFromPrice) {
    return buildProfileFromTier({
      tenantId,
      tier: tierFromPrice,
      subscriptionStatus,
      stripeSubscriptionId,
      stripePriceId,
      pastDueSince,
      source: "tenant.priceId",
    });
  }

  return buildCompatDefaultTenantPlanProfile({
    tenantId,
    subscriptionStatus,
    stripeSubscriptionId,
    stripePriceId,
    pastDueSince,
  });
}

function getFeatureLabel(feature: PlanLimitFeature): string {
  if (feature === "maxProposalsPerMonth") return "monthly proposals";
  if (feature === "maxWallets") return "wallets";
  if (feature === "maxUsers") return "users";
  if (feature === "storageQuotaMB") return "storage";
  return "spreadsheets";
}

export function buildMonthlyPeriodWindowUtc(baseDate: Date = new Date()): MonthlyPeriodWindow {
  const startDate = new Date(
    Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1),
  );
  const endDate = new Date(
    Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + 1, 1),
  );
  return {
    startDate,
    endDate,
    periodStart: startDate.toISOString(),
    periodEnd: endDate.toISOString(),
    resetAt: endDate.toISOString(),
  };
}

export function buildMonthlyPeriodKeyUtc(baseDate: Date = new Date()): string {
  const period = buildMonthlyPeriodWindowUtc(baseDate);
  const year = period.startDate.getUTCFullYear();
  const month = String(period.startDate.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function resolvePeriodContext(input: {
  feature: PlanLimitFeature;
  periodStart?: string;
  periodEnd?: string;
  resetAt?: string;
}): {
  periodStart?: string;
  periodEnd?: string;
  resetAt?: string;
} {
  if (input.feature !== "maxProposalsPerMonth") return {};
  const fallback = buildMonthlyPeriodWindowUtc();
  return {
    periodStart: input.periodStart || fallback.periodStart,
    periodEnd: input.periodEnd || fallback.periodEnd,
    resetAt: input.resetAt || fallback.resetAt,
  };
}

export function evaluatePlanLimitExceedance(input: {
  feature: PlanLimitFeature;
  limit: number;
  currentUsage: number;
  incrementBy?: number;
}): {
  exceeded: boolean;
  projectedUsage: number;
  statusCode: 402;
  code: "PLAN_LIMIT_PROPOSALS_MONTHLY" | "PLAN_LIMIT_EXCEEDED";
  message: string;
} {
  const limit = Math.max(-1, Math.floor(Number(input.limit)));
  const currentUsage = Math.max(0, Math.floor(Number(input.currentUsage || 0)));
  const incrementBy = Math.max(0, Math.floor(Number(input.incrementBy || 1)));
  const projectedUsage = currentUsage + incrementBy;
  const label = getFeatureLabel(input.feature);
  const code =
    input.feature === "maxProposalsPerMonth"
      ? "PLAN_LIMIT_PROPOSALS_MONTHLY"
      : "PLAN_LIMIT_EXCEEDED";
  const message =
    input.feature === "maxProposalsPerMonth"
      ? `Monthly ${label} limit reached (${currentUsage}/${limit}).`
      : `${label} limit reached (${currentUsage}/${limit}).`;
  const exceeded = limit >= 0 && projectedUsage > limit;

  return {
    exceeded,
    projectedUsage,
    statusCode: 402,
    code,
    message,
  };
}

export function evaluateSubscriptionStatusAccess(input: {
  subscriptionStatus: string;
  pastDueSince?: string;
  nowMs?: number;
  graceDays?: number;
}): SubscriptionStatusAccessDecision {
  const status = normalizeSubscriptionStatus(input.subscriptionStatus);
  if (!status || status === "active" || status === "trialing") {
    return { allowWrite: true, reasonCode: "SUBSCRIPTION_OK" };
  }

  if (status === "past_due") {
    const graceDays =
      input.graceDays !== undefined ? input.graceDays : resolvePastDueGraceDays();
    const nowMs = Number.isFinite(input.nowMs || NaN) ? Number(input.nowMs) : Date.now();
    const pastDueSinceMs = parseIsoToMs(input.pastDueSince);
    if (!pastDueSinceMs) {
      return { allowWrite: false, reasonCode: "PAST_DUE_MISSING_TIMESTAMP" };
    }
    const graceMs = Math.max(0, graceDays) * 24 * 60 * 60 * 1000;
    if (nowMs - pastDueSinceMs <= graceMs) {
      return { allowWrite: true, reasonCode: "PAST_DUE_WITHIN_GRACE" };
    }
    return { allowWrite: false, reasonCode: "PAST_DUE_GRACE_EXPIRED" };
  }

  return { allowWrite: false, reasonCode: "SUBSCRIPTION_STATUS_BLOCKED" };
}

function buildLimitExceededDecision(input: {
  mode: PlanEnforcementMode;
  profile: TenantPlanProfile;
  feature: PlanLimitFeature;
  currentUsage: number;
  projectedUsage: number;
  limit: number;
  isSuperAdmin: boolean;
  periodStart?: string;
  periodEnd?: string;
  resetAt?: string;
}): PlanEnforcementDecision {
  const exceedance = evaluatePlanLimitExceedance({
    feature: input.feature,
    limit: input.limit,
    currentUsage: input.currentUsage,
    incrementBy: input.projectedUsage - input.currentUsage,
  });
  const periodContext = resolvePeriodContext({
    feature: input.feature,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    resetAt: input.resetAt,
  });

  if (input.isSuperAdmin && shouldAllowSuperAdminBypass()) {
    return {
      allowed: true,
      mode: input.mode,
      profile: input.profile,
      currentUsage: input.currentUsage,
      projectedUsage: input.projectedUsage,
      limit: input.limit,
      bypassed: true,
      statusCode: exceedance.statusCode,
      code: exceedance.code,
      message: exceedance.message,
      ...periodContext,
    };
  }

  if (input.mode === "monitor" || input.mode === "off") {
    return {
      allowed: true,
      mode: input.mode,
      profile: input.profile,
      currentUsage: input.currentUsage,
      projectedUsage: input.projectedUsage,
      limit: input.limit,
      statusCode: exceedance.statusCode,
      code: exceedance.code,
      message: exceedance.message,
      wouldBlock: true,
      ...periodContext,
    };
  }

  return {
    allowed: false,
    mode: input.mode,
    profile: input.profile,
    currentUsage: input.currentUsage,
    projectedUsage: input.projectedUsage,
    limit: input.limit,
    statusCode: exceedance.statusCode,
    code: exceedance.code,
    message: exceedance.message,
    ...periodContext,
  };
}

function logPlanDecision(input: {
  decision: PlanEnforcementDecision;
  feature: PlanLimitFeature;
  tenantId: string;
  uid?: string;
  requestId?: string;
  route?: string;
}): void {
  const { decision } = input;
  if (!(decision.bypassed || decision.wouldBlock || !decision.allowed)) {
    return;
  }

  const level = decision.allowed ? "WARN" : "ERROR";
  const reason = `${input.feature}:${decision.code || "none"}`;
  telemetryHooks.logEvent(
    "tenant_plan_limit_decision",
    {
      requestId: input.requestId,
      route: input.route,
      tenantId: input.tenantId,
      uid: input.uid,
      source: "tenant_plan_policy",
      reason,
      status: decision.statusCode,
    },
    level,
  );

  if (!decision.allowed) {
    emitCounter("plan_limit_blocked", {
      requestId: input.requestId,
      route: input.route,
      tenantId: input.tenantId,
      uid: input.uid,
      source: "tenant_plan_policy",
      reason,
      status: decision.statusCode,
    });
  } else if (decision.wouldBlock) {
    emitCounter("plan_limit_would_block", {
      requestId: input.requestId,
      route: input.route,
      tenantId: input.tenantId,
      uid: input.uid,
      source: "tenant_plan_policy",
      reason,
      status: decision.statusCode,
    });
  }

  if (decision.bypassed) {
    emitAudit({
      eventType: "TENANT_PLAN_SUPERADMIN_BYPASS",
      requestId: input.requestId,
      route: input.route,
      status: decision.statusCode,
      tenantId: input.tenantId,
      uid: input.uid,
      reason,
      source: "tenant_plan_policy",
    });
    return;
  }

  if (!decision.allowed) {
    emitAudit({
      eventType: "TENANT_PLAN_LIMIT_BLOCKED",
      requestId: input.requestId,
      route: input.route,
      status: decision.statusCode,
      tenantId: input.tenantId,
      uid: input.uid,
      reason,
      source: "tenant_plan_policy",
    });
    return;
  }

  if (decision.wouldBlock) {
    emitAudit({
      eventType: "TENANT_PLAN_LIMIT_WOULD_BLOCK",
      requestId: input.requestId,
      route: input.route,
      status: decision.statusCode,
      tenantId: input.tenantId,
      uid: input.uid,
      reason,
      source: "tenant_plan_policy",
    });
  }
}

export function setTenantPlanTelemetryForTest(
  overrides?: Partial<TelemetryHooks>,
): void {
  telemetryHooks = {
    ...defaultTelemetryHooks,
    ...(overrides || {}),
  };
}

export function clearTenantPlanCache(tenantId?: string): void {
  if (tenantId) {
    PLAN_CACHE.delete(tenantId);
    return;
  }
  PLAN_CACHE.clear();
}

export function setTenantPlanCacheForTest(
  tenantId: string,
  profile: TenantPlanProfile,
  ttlMs: number = 60_000,
): void {
  PLAN_CACHE.set(tenantId, {
    profile,
    expiresAt: Date.now() + Math.max(1_000, ttlMs),
  });
}

export function hasTenantPlanCacheForTest(tenantId: string): boolean {
  const cached = PLAN_CACHE.get(tenantId);
  if (!cached) return false;
  return cached.expiresAt > Date.now();
}

export async function getTenantPlanProfile(
  tenantId: string,
): Promise<TenantPlanProfile> {
  const normalizedTenantId = String(tenantId || "").trim();
  if (!normalizedTenantId) {
    throw new Error("TENANT_ID_REQUIRED");
  }

  const now = Date.now();
  const cached = PLAN_CACHE.get(normalizedTenantId);
  if (cached && cached.expiresAt > now) {
    return cached.profile;
  }

  const profile = await resolveTenantPlanProfileUncached(normalizedTenantId);
  PLAN_CACHE.set(normalizedTenantId, {
    profile,
    expiresAt: now + resolvePlanCacheTtlMs(),
  });
  return profile;
}

function resolveUsageKnown(input: PlanEnforcementInput): boolean {
  if (input.usageKnown === false) return false;
  return Number.isFinite(Number(input.currentUsage));
}

export async function enforceTenantPlanLimit(
  input: PlanEnforcementInput,
): Promise<PlanEnforcementDecision> {
  const normalizedTenantId = String(input.tenantId || "").trim();
  if (!normalizedTenantId) {
    throw new Error("TENANT_ID_REQUIRED");
  }

  const mode = resolvePlanEnforcementMode();
  const profile = await getTenantPlanProfile(normalizedTenantId);
  const limit = profile.limits[input.feature];
  const periodContext = resolvePeriodContext({
    feature: input.feature,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    resetAt: input.resetAt,
  });

  if (shouldEnforceSubscriptionStatus()) {
    const subscriptionAccess = evaluateSubscriptionStatusAccess({
      subscriptionStatus: profile.subscriptionStatus,
      pastDueSince: profile.pastDueSince,
      graceDays: resolvePastDueGraceDays(),
    });
    if (!subscriptionAccess.allowWrite) {
      const blockedBySubscription: PlanEnforcementDecision = {
        allowed: mode !== "enforce",
        mode,
        profile,
        currentUsage: Math.max(0, Math.floor(Number(input.currentUsage || 0))),
        projectedUsage: Math.max(0, Math.floor(Number(input.currentUsage || 0))),
        limit,
        statusCode: 403,
        code: "BILLING_INACTIVE",
        message:
          "Billing status does not permit write operations for this tenant.",
        wouldBlock: mode !== "enforce",
        bypassed:
          input.isSuperAdmin === true &&
          shouldAllowSuperAdminBypass() &&
          mode === "enforce",
        ...periodContext,
      };
      if (blockedBySubscription.bypassed) {
        blockedBySubscription.allowed = true;
      }
      logPlanDecision({
        decision: blockedBySubscription,
        feature: input.feature,
        tenantId: normalizedTenantId,
        uid: input.uid,
        requestId: input.requestId,
        route: input.route,
      });
      return blockedBySubscription;
    }
  }

  const usageKnown = resolveUsageKnown(input);
  if (input.feature === "maxProposalsPerMonth" && !usageKnown) {
    const unavailableDecision: PlanEnforcementDecision = {
      allowed: true,
      mode,
      profile,
      currentUsage: 0,
      projectedUsage: 0,
      limit,
      code: input.usageUnavailableCode || "MONTHLY_USAGE_UNAVAILABLE",
      message:
        "Monthly usage is unavailable. Allowing write to avoid false lockout.",
      ...periodContext,
    };
    telemetryHooks.logEvent(
      "tenant_plan_monthly_usage_unavailable",
      {
        requestId: input.requestId,
        route: input.route,
        tenantId: normalizedTenantId,
        uid: input.uid,
        source: "tenant_plan_policy",
        reason: unavailableDecision.code,
        status: mode === "enforce" ? 402 : 200,
      },
      "WARN",
    );
    emitAudit({
      eventType: "TENANT_PLAN_MONTHLY_USAGE_UNAVAILABLE_FAIL_OPEN",
      requestId: input.requestId,
      route: input.route,
      status: mode === "enforce" ? 402 : 200,
      tenantId: normalizedTenantId,
      uid: input.uid,
      reason: unavailableDecision.code,
      source: "tenant_plan_policy",
    });
    return unavailableDecision;
  }

  const currentUsage = Math.max(0, Math.floor(Number(input.currentUsage || 0)));
  const incrementBy = Math.max(0, Math.floor(Number(input.incrementBy || 1)));
  const projectedUsage = currentUsage + incrementBy;

  if (!Number.isFinite(limit) || limit < 0) {
    return {
      allowed: true,
      mode,
      profile,
      currentUsage,
      projectedUsage,
      limit: -1,
      ...periodContext,
    };
  }

  if (projectedUsage <= limit) {
    return {
      allowed: true,
      mode,
      profile,
      currentUsage,
      projectedUsage,
      limit,
      ...periodContext,
    };
  }

  const decision = buildLimitExceededDecision({
    mode,
    profile,
    feature: input.feature,
    currentUsage,
    projectedUsage,
    limit,
    isSuperAdmin: input.isSuperAdmin === true,
    ...periodContext,
  });

  logPlanDecision({
    decision,
    feature: input.feature,
    tenantId: normalizedTenantId,
    uid: input.uid,
    requestId: input.requestId,
    route: input.route,
  });
  return decision;
}

export async function getTenantMonthlyProposalsUsage(
  tenantId: string,
  baseDate: Date = new Date(),
): Promise<MonthlyUsageResult> {
  const period = buildMonthlyPeriodWindowUtc(baseDate);
  const monthId = buildMonthlyPeriodKeyUtc(baseDate);

  try {
    const aggregateSnap = await db
      .collection("tenant_usage")
      .doc(tenantId)
      .collection("months")
      .doc(monthId)
      .get();

    if (aggregateSnap.exists) {
      const aggregateCount = Number(aggregateSnap.data()?.proposalsCreated);
      if (Number.isFinite(aggregateCount) && aggregateCount >= 0) {
        return {
          count: Math.floor(aggregateCount),
          reliable: true,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          resetAt: period.resetAt,
        };
      }
    }

    const snap = await db
      .collection("proposals")
      .where("tenantId", "==", tenantId)
      .where("createdAt", ">=", Timestamp.fromDate(period.startDate))
      .where("createdAt", "<", Timestamp.fromDate(period.endDate))
      .count()
      .get();
    return {
      count: Number(snap.data().count || 0),
      reliable: true,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      resetAt: period.resetAt,
    };
  } catch (error) {
    telemetryHooks.logEvent(
      "tenant_plan_monthly_usage_unavailable",
      {
        tenantId,
        source: "tenant_plan_policy",
        reason: "MONTHLY_USAGE_UNAVAILABLE",
        status: 200,
      },
      "WARN",
    );
    return {
      count: null,
      reliable: false,
      code: "MONTHLY_USAGE_UNAVAILABLE",
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      resetAt: period.resetAt,
    };
  }
}

export async function getTenantWalletsUsage(tenantId: string): Promise<number> {
  const snap = await db
    .collection("wallets")
    .where("tenantId", "==", tenantId)
    .count()
    .get();
  return Number(snap.data().count || 0);
}

export async function getTenantUsersUsage(tenantId: string): Promise<number> {
  const snap = await db
    .collection("users")
    .where("tenantId", "==", tenantId)
    .count()
    .get();
  return Number(snap.data().count || 0);
}

export async function getTenantSpreadsheetsUsage(
  tenantId: string,
): Promise<number> {
  const snap = await db
    .collection("spreadsheets")
    .where("tenantId", "==", tenantId)
    .count()
    .get();
  return Number(snap.data().count || 0);
}

export async function getTenantStorageUsageMb(tenantId: string): Promise<number> {
  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  const tenantData = tenantSnap.exists
    ? (tenantSnap.data() as Record<string, unknown> | undefined)
    : undefined;
  const tenantUsage = Number(
    (tenantData?.usage as { storageMB?: unknown } | undefined)?.storageMB || 0,
  );
  if (Number.isFinite(tenantUsage) && tenantUsage >= 0) {
    return tenantUsage;
  }

  const companySnap = await db.collection("companies").doc(tenantId).get();
  const companyData = companySnap.exists
    ? (companySnap.data() as Record<string, unknown> | undefined)
    : undefined;
  const companyUsage = Number(
    (companyData?.usage as { storageMB?: unknown } | undefined)?.storageMB || 0,
  );
  return Number.isFinite(companyUsage) && companyUsage >= 0 ? companyUsage : 0;
}
