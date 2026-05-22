import { onRequest } from "firebase-functions/v2/https";
import { getStripe, getWebhookSecret } from "./stripeConfig";
import {
  updateUserPlan,
  saveAddon,
  cancelAddon,
  getPlanIdByTier,
  updateSubscriptionStatus,
  updateAddonStatus,
  AddonType,
  addWhatsAppOverageToSubscription,
  upsertTenantStripeBillingData,
  WHATSAPP_OVERAGE_PRICE_ID,
} from "./stripeHelpers";
import {
  mapStripeStatusToBilling,
  findAndCancelDuplicateSubscriptions,
  clearCheckoutReservation,
  classifySubscription,
} from "../billing";
import { db } from "../init";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import Stripe from "stripe";
import {
  attachRequestId,
  buildSecurityLogContext,
  incrementSecurityCounter,
  logSecurityEvent,
  writeSecurityAuditEvent,
} from "../lib/security-observability";
import {
  clearTenantPlanCache,
  compareTiers,
  normalizePlanTier,
  resolvePriceToTier,
  TenantPlanTier,
} from "../lib/tenant-plan-policy";
import { tenantPlanAllowsWhatsApp } from "../lib/whatsapp-eligibility";
import { runSecretRotationGuard } from "../lib/secret-rotation-guard";
import { logger } from "../lib/logger";
import { applyBillingClaimsToTenantUsers } from "../lib/billing-claims";
import { invalidateBillingCache } from "../api/middleware/require-active-subscription";
import type {
  SyncTenantPlanBillingSnapshotParams,
  SubscriptionSnapshot,
} from "../shared/billing-types";

const WEBHOOK_RATE_LIMIT_WINDOW_MS = 60_000;
const WEBHOOK_RATE_LIMIT_MAX_REQUESTS = 240;
const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;
const DEFAULT_STRIPE_EVENT_RETENTION_DAYS = 30;
const WEBHOOK_RATE_LIMIT_STATE = new Map<
  string,
  { count: number; windowStart: number }
>();
let lastStripeEventCleanupAtMs = 0;

runSecretRotationGuard({ source: "stripe_webhook" });

export function invalidateTenantPlanCacheAfterWebhookUpdate(
  tenantId: string | undefined,
): void {
  const normalizedTenantId = String(tenantId || "").trim();
  if (!normalizedTenantId) return;
  clearTenantPlanCache(normalizedTenantId);
}

function mapStripeStatusToTenantSubscriptionStatus(status: unknown): string {
  return mapStripeStatusToBilling(String(status || "").trim().toLowerCase());
}

function extractPrimaryPriceId(
  subscription: Stripe.Subscription,
): string | undefined {
  const items = subscription.items?.data ?? [];
  // Prefer items whose price maps to a known plan tier (deterministic).
  const tierItem = items.find((item) => {
    const pid = String(item.price?.id || "").trim();
    return pid && pid !== WHATSAPP_OVERAGE_PRICE_ID && resolvePriceToTier(pid) != null;
  });
  if (tierItem) {
    return String(tierItem.price?.id || "").trim() || undefined;
  }
  // Fallback: first non-overage item, then first item.
  const fallback =
    items.find((item) => item.price?.id !== WHATSAPP_OVERAGE_PRICE_ID) ??
    items[0];
  const priceId = String(fallback?.price?.id || "").trim();
  return priceId || undefined;
}

function isSupportedAddonType(value: unknown): value is AddonType {
  const normalized = String(value || "").trim();
  return [
    "financial",
    "pdf_editor_partial",
    "pdf_editor_full",
    "crm",
  ].includes(normalized);
}

export function buildTenantSubscriptionLifecyclePatch(input: {
  subscriptionStatus: string;
  stripePriceId?: string;
  existingPastDueSince?: unknown;
  nowIso?: string;
}): {
  subscriptionStatus: string;
  stripePriceId: string | null;
  priceId: string | null;
  pastDueSince: string | null;
} {
  const normalizedStatus = mapStripeStatusToTenantSubscriptionStatus(
    input.subscriptionStatus,
  );
  const normalizedPriceId = String(input.stripePriceId || "").trim() || null;
  const existingPastDueSince = String(input.existingPastDueSince || "").trim();

  let pastDueSince = existingPastDueSince || null;
  if (normalizedStatus === "past_due") {
    if (!pastDueSince) {
      pastDueSince = input.nowIso || new Date().toISOString();
    }
  } else if (normalizedStatus === "active" || normalizedStatus === "trialing") {
    pastDueSince = null;
  }

  return {
    subscriptionStatus: normalizedStatus,
    stripePriceId: normalizedPriceId,
    priceId: normalizedPriceId,
    pastDueSince,
  };
}

export async function syncTenantPlanBillingSnapshot(
  params: SyncTenantPlanBillingSnapshotParams,
): Promise<void> {
  const tenantId = String(params.tenantId || "").trim();
  if (!tenantId) return;

  const tenantRef = db.collection("tenants").doc(tenantId);
  const nowIso = new Date().toISOString();
  const derivedTier = params.stripePriceId
    ? resolvePriceToTier(params.stripePriceId)
    : null;

  // If we can't resolve a tier from the price, skip the plan write entirely.
  // This prevents routine invoices (invoice.paid with no price change) from
  // wiping a pending downgrade deferral without updating the plan field.
  if (!derivedTier && params.clearScheduled) {
    console.warn(
      `[syncTenantPlanBillingSnapshot] No tier resolved for priceId=${params.stripePriceId}, skipping scheduled-field clear for tenant ${tenantId}`,
    );
  }

  // Auto-fetch unit_amount from Stripe when stripePriceId is present but unitAmount not explicitly set
  let resolvedUnitAmount = params.unitAmount;
  let resolvedCurrency = params.currency;
  if (params.stripePriceId && resolvedUnitAmount === undefined) {
    try {
      const stripe = getStripe();
      const price = await stripe.prices.retrieve(params.stripePriceId);
      resolvedUnitAmount = price.unit_amount;
      resolvedCurrency = price.currency ?? null;
    } catch (err) {
      logger.error("[syncTenantPlanBillingSnapshot] failed to retrieve price amount", {
        priceId: params.stripePriceId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Non-fatal: continue without unitAmount
    }
  }

  await db.runTransaction(async (transaction) => {
    const tenantSnap = await transaction.get(tenantRef);
    const tenantData = tenantSnap.exists
      ? (tenantSnap.data() as Record<string, unknown> | undefined)
      : undefined;

    const lifecyclePatch = buildTenantSubscriptionLifecyclePatch({
      subscriptionStatus: params.subscriptionStatus,
      stripePriceId: params.stripePriceId ?? undefined,
      existingPastDueSince: tenantData?.pastDueSince,
      nowIso,
    });

    // ---- Top-level patch (all fields kept for backward-compat per reader audit) ----
    const patch: Record<string, unknown> = {
      ...lifecyclePatch,
      updatedAt: nowIso,
      billingSyncedAt: nowIso,
      ...(params.currentPeriodEnd != null && {
        currentPeriodEnd: params.currentPeriodEnd.toISOString(),
      }),
      // Passthrough fields from parallel writers (Plan 03 consolidation targets)
      ...("cancelAtPeriodEnd" in params && {
        cancelAtPeriodEnd: params.cancelAtPeriodEnd,
      }),
      ...("cancelScheduledAt" in params && {
        cancelScheduledAt: params.cancelScheduledAt,
      }),
      ...("stripeSubscriptionId" in params && {
        stripeSubscriptionId: params.stripeSubscriptionId,
      }),
      ...("stripeCustomerId" in params && {
        stripeCustomerId: params.stripeCustomerId,
      }),
      // billing-sync.service.ts writes both priceId and stripePriceId; preserve mirror
      ...(params.stripePriceId != null && {
        priceId: params.stripePriceId,
        stripePriceId: params.stripePriceId,
      }),
      ...("billingInterval" in params && {
        billingInterval: params.billingInterval,
      }),
      ...(resolvedUnitAmount !== undefined && { unitAmount: resolvedUnitAmount }),
      ...(resolvedCurrency !== undefined && { currency: resolvedCurrency }),
    };

    const resolvedPlan = derivedTier ?? params.plan ?? null;
    if (resolvedPlan) {
      patch.plan = resolvedPlan;
      // Only clear scheduled fields when there is a resolved tier AND the caller
      // explicitly requests it (upgrades, fresh checkouts). Routine invoice
      // payments must NOT clear a pending downgrade deferral.
      if (params.clearScheduled) {
        patch.scheduledPlan = null;
        patch.scheduledPlanAt = null;
        patch.scheduledPlanReason = null;
      }
    }
    // When caller explicitly provides scheduled-plan fields (and clearScheduled is false),
    // persist them so scheduled-plan writes (deferral, cancel_at_period_end) route through here.
    if (!params.clearScheduled || !resolvedPlan) {
      if ("scheduledPlan" in params) patch.scheduledPlan = params.scheduledPlan;
      if ("scheduledPlanAt" in params) patch.scheduledPlanAt = params.scheduledPlanAt;
      if ("scheduledPlanReason" in params) patch.scheduledPlanReason = params.scheduledPlanReason;
    }

    // ---- subscription.* nested map (new in Plan 02; written atomically with top-level) ----
    const existingSubscription =
      (tenantData?.subscription as Record<string, unknown> | undefined) ?? {};

    const subscriptionPatch: SubscriptionSnapshot = {
      status: lifecyclePatch.subscriptionStatus,
      syncedAt: nowIso,
      // Preserve pastDueSince from lifecycle logic
      pastDueSince: lifecyclePatch.pastDueSince,
      ...(params.eventId != null && { lastEventId: params.eventId }),
      ...(params.cancelAtPeriodEnd != null && {
        cancelAtPeriodEnd: params.cancelAtPeriodEnd,
      }),
      ...("cancelAt" in params && {
        cancelAt: params.cancelAt != null ? params.cancelAt.toISOString() : null,
      }),
      ...(params.stripeSubscriptionId !== undefined && {
        stripeSubscriptionId: params.stripeSubscriptionId,
      }),
      ...(params.stripePriceId != null && {
        stripePriceId: params.stripePriceId,
      }),
      ...(params.stripeCustomerId != null && {
        stripeCustomerId: params.stripeCustomerId,
      }),
      ...(params.currentPeriodEnd != null && {
        currentPeriodEnd: params.currentPeriodEnd.toISOString(),
      }),
      // Plan resolution
      ...(resolvedPlan != null && { plan: resolvedPlan }),
      ...(resolvedUnitAmount !== undefined && { unitAmount: resolvedUnitAmount }),
      ...(resolvedCurrency !== undefined && { currency: resolvedCurrency }),
    };

    // Apply scheduled-plan clears or explicit values to nested map
    if (resolvedPlan && params.clearScheduled) {
      subscriptionPatch.scheduledPlan = null;
      subscriptionPatch.scheduledPlanAt = null;
      subscriptionPatch.scheduledPlanReason = null;
    } else if (!params.clearScheduled || !resolvedPlan) {
      if ("scheduledPlan" in params) subscriptionPatch.scheduledPlan = params.scheduledPlan;
      if ("scheduledPlanAt" in params) {
        subscriptionPatch.scheduledPlanAt =
          params.scheduledPlanAt instanceof Date
            ? Timestamp.fromDate(params.scheduledPlanAt)
            : (params.scheduledPlanAt ?? null);
      }
      if ("scheduledPlanReason" in params) subscriptionPatch.scheduledPlanReason = params.scheduledPlanReason;
    }

    // Merge existing subscription fields with the new patch (preserves fields not updated this call)
    patch.subscription = { ...existingSubscription, ...subscriptionPatch };

    transaction.set(tenantRef, patch, { merge: true });
  });

  // Re-evaluate WhatsApp eligibility against the freshly-written plan.
  // CRITICAL (Pitfall 2): tenantPlanAllowsWhatsApp reads addon docs and the plan
  // cache — moving it inside the transaction causes lock contention and
  // disallowed external reads. MUST remain outside the transaction.
  clearTenantPlanCache(tenantId);
  const allowsWhatsApp = await tenantPlanAllowsWhatsApp(tenantId);
  await tenantRef.update({ whatsappEnabled: allowsWhatsApp });
}

function getWebhookClientIp(req: any): string {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return String(forwardedFor[0] || "").trim();
  }
  return req.ip || "unknown";
}

function isWebhookRateLimited(req: any, res: any): boolean {
  const now = Date.now();
  if (WEBHOOK_RATE_LIMIT_STATE.size > 5000) {
    WEBHOOK_RATE_LIMIT_STATE.forEach((entry, key) => {
      if (now - entry.windowStart > WEBHOOK_RATE_LIMIT_WINDOW_MS * 2) {
        WEBHOOK_RATE_LIMIT_STATE.delete(key);
      }
    });
  }

  const rateKey = getWebhookClientIp(req);
  const current = WEBHOOK_RATE_LIMIT_STATE.get(rateKey);

  if (!current || now - current.windowStart >= WEBHOOK_RATE_LIMIT_WINDOW_MS) {
    WEBHOOK_RATE_LIMIT_STATE.set(rateKey, { count: 1, windowStart: now });
    return false;
  }

  current.count += 1;
  WEBHOOK_RATE_LIMIT_STATE.set(rateKey, current);
  if (current.count <= WEBHOOK_RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  const retryAfterSeconds = Math.ceil(
    (WEBHOOK_RATE_LIMIT_WINDOW_MS - (now - current.windowStart)) / 1000,
  );
  res.set("Retry-After", String(Math.max(retryAfterSeconds, 1)));
  return true;
}

function extractStripeCustomerId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id?: string }).id || "").trim();
  }
  return "";
}

function extractStripeSubscriptionId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id?: string }).id || "").trim();
  }
  return "";
}

function getStripeEventRetentionDays(): number {
  const configured = Number(process.env.STRIPE_EVENT_RETENTION_DAYS || "");
  if (!Number.isFinite(configured)) return DEFAULT_STRIPE_EVENT_RETENTION_DAYS;
  return Math.min(Math.max(Math.floor(configured), 7), 365);
}

function getStripeEventExpiresAtTimestamp(): FirebaseFirestore.Timestamp {
  const retentionDays = getStripeEventRetentionDays();
  const expiresAtMs = Date.now() + retentionDays * 24 * 60 * 60 * 1000;
  return Timestamp.fromMillis(expiresAtMs);
}

async function cleanupExpiredStripeEventsBestEffort(): Promise<void> {
  const nowMs = Date.now();
  if (nowMs - lastStripeEventCleanupAtMs < 60 * 60 * 1000) {
    return;
  }
  lastStripeEventCleanupAtMs = nowMs;

  try {
    const expiredSnap = await db
      .collection("stripe_events")
      .where("expiresAt", "<=", Timestamp.now())
      .limit(200)
      .get();
    if (expiredSnap.empty) return;

    const batch = db.batch();
    expiredSnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  } catch (error) {
    console.warn("[StripeWebhook] cleanupExpiredStripeEventsBestEffort failed", error);
  }
}

function sanitizeStripeEventError(errorMessage: string | undefined): string {
  const normalized = String(errorMessage || "unknown")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "unknown";
  return normalized.slice(0, 160);
}

type StripeEventProcessingState = {
  status?: string;
  lastReceivedAt?: string;
};

export function shouldSkipStripeEventRecord(
  state: StripeEventProcessingState | undefined,
  nowMs: number = Date.now(),
): boolean {
  const status = String(state?.status || "").toLowerCase();
  if (status === "processed") {
    return true;
  }
  if (status === "processing") {
    const lastReceivedAtMs = Date.parse(String(state?.lastReceivedAt || ""));
    if (
      Number.isFinite(lastReceivedAtMs) &&
      nowMs - lastReceivedAtMs < 5 * 60 * 1000
    ) {
      return true;
    }
  }
  return false;
}

async function assertUserTenantConsistency(
  userId: string | undefined,
  expectedTenantId: string,
): Promise<void> {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return;

  const userSnap = await db.collection("users").doc(normalizedUserId).get();
  if (!userSnap.exists) {
    throw new Error("TENANT_USER_NOT_FOUND");
  }

  const userData = userSnap.data() as
    | { tenantId?: string; companyId?: string }
    | undefined;
  const userTenantId = String(
    userData?.tenantId || userData?.companyId || "",
  ).trim();
  if (userTenantId && userTenantId !== expectedTenantId) {
    throw new Error("TENANT_USER_MISMATCH");
  }
}

async function resolveTenantIdForBillingEvent(params: {
  eventType: string;
  metadataTenantId?: string;
  customerId?: string;
  subscriptionId?: string;
}): Promise<string> {
  const eventType = String(params.eventType || "").trim();
  const metadataTenantId = String(params.metadataTenantId || "").trim();
  const customerId = String(params.customerId || "").trim();
  const subscriptionId = String(params.subscriptionId || "").trim();

  const candidateTenantIds = new Set<string>();

  if (subscriptionId) {
    const tenantsBySubscription = await db
      .collection("tenants")
      .where("stripeSubscriptionId", "==", subscriptionId)
      .limit(3)
      .get();
    tenantsBySubscription.docs.forEach((doc) => {
      candidateTenantIds.add(doc.id);
    });

    const addonBySubscription = await db
      .collection("addons")
      .where("stripeSubscriptionId", "==", subscriptionId)
      .limit(3)
      .get();
    addonBySubscription.docs.forEach((doc) => {
      const tenantId = String(doc.data()?.tenantId || "").trim();
      if (tenantId) candidateTenantIds.add(tenantId);
    });
  }

  if (customerId) {
    const tenantsByCustomer = await db
      .collection("tenants")
      .where("stripeCustomerId", "==", customerId)
      .limit(3)
      .get();
    tenantsByCustomer.docs.forEach((doc) => {
      candidateTenantIds.add(doc.id);
    });

    const usersByCustomer = await db
      .collection("users")
      .where("stripeId", "==", customerId)
      .limit(5)
      .get();
    usersByCustomer.docs.forEach((doc) => {
      const userData = doc.data() as { tenantId?: string; companyId?: string };
      const tenantId = String(
        userData.tenantId || userData.companyId || "",
      ).trim();
      if (tenantId) candidateTenantIds.add(tenantId);
    });
  }

  const resolvedTenantIds = Array.from(candidateTenantIds).filter(Boolean);
  if (resolvedTenantIds.length === 0) {
    console.error("[StripeWebhook] tenant resolution failed", {
      eventType,
      customerId: customerId || undefined,
      subscriptionId: subscriptionId || undefined,
    });
    throw new Error("TENANT_RESOLUTION_FAILED");
  }

  if (resolvedTenantIds.length > 1) {
    console.error("[StripeWebhook] tenant resolution ambiguous", {
      eventType,
      customerId: customerId || undefined,
      subscriptionId: subscriptionId || undefined,
      tenantIds: resolvedTenantIds,
    });
    throw new Error("TENANT_RESOLUTION_AMBIGUOUS");
  }

  const resolvedTenantId = resolvedTenantIds[0];
  if (metadataTenantId && metadataTenantId !== resolvedTenantId) {
    console.error("[StripeWebhook] metadata tenant mismatch", {
      eventType,
      metadataTenantId,
      resolvedTenantId,
      customerId: customerId || undefined,
      subscriptionId: subscriptionId || undefined,
    });
    throw new Error("TENANT_METADATA_MISMATCH");
  }

  return resolvedTenantId;
}

export async function beginStripeEventProcessing(
  event: Stripe.Event,
): Promise<"skip" | "process"> {
  const eventRef = db.collection("stripe_events").doc(event.id);
  const nowIso = new Date().toISOString();
  const expiresAt = getStripeEventExpiresAtTimestamp();

  return db.runTransaction(async (transaction) => {
    const existingSnap = await transaction.get(eventRef);
    if (existingSnap.exists) {
      const data = existingSnap.data() as StripeEventProcessingState | undefined;
      if (shouldSkipStripeEventRecord(data)) {
        return "skip";
      }
    }

    transaction.set(
      eventRef,
      {
        eventId: event.id,
        eventType: event.type,
        livemode: event.livemode === true,
        status: "processing",
        lastReceivedAt: nowIso,
        createdAt: existingSnap.exists
          ? existingSnap.data()?.createdAt || nowIso
          : nowIso,
        expiresAt,
      },
      { merge: true },
    );

    return "process";
  });
}

async function finalizeStripeEventProcessing(
  event: Stripe.Event,
  status: "processed" | "failed",
  errorMessage?: string,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const expiresAt = getStripeEventExpiresAtTimestamp();
  await db
    .collection("stripe_events")
    .doc(event.id)
    .set(
      {
        status,
        lastProcessedAt: nowIso,
        lastError:
          status === "failed" ? sanitizeStripeEventError(errorMessage) : null,
        expiresAt,
      },
      { merge: true },
    );
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const subscriptionId = extractStripeSubscriptionId(session.subscription);
  const metadata = session.metadata || {};
  const sessionCustomerId = extractStripeCustomerId(session.customer);

  if (!subscriptionId) {
    throw new Error("TENANT_RESOLUTION_FAILED");
  }

  const tenantId = await resolveTenantIdForBillingEvent({
    eventType: "checkout.session.completed",
    metadataTenantId: metadata.tenantId,
    customerId: sessionCustomerId,
    subscriptionId,
  });

  console.log("=== CHECKOUT COMPLETED ===");
  console.log("Session ID:", session.id);
  console.log("Subscription ID:", subscriptionId);
  console.log("Metadata:", JSON.stringify(metadata, null, 2));

  if (metadata.type === "addon") {
    const addonTypeRaw = metadata.addonType;
    if (!isSupportedAddonType(addonTypeRaw)) {
      throw new Error("TENANT_METADATA_MISMATCH");
    }
    const addonType = addonTypeRaw;

    console.log("=== PROCESSING ADDON ===");
    console.log("Tenant ID:", tenantId);
    console.log("Addon Type:", addonType);

    await saveAddon(tenantId, addonType, subscriptionId);
    console.log("=== ADDON SAVED SUCCESSFULLY ===");
    return;
  }

  console.log("=== PROCESSING PLAN (not addon) ===");

  const userId = String(metadata.userId || "").trim();
  const planTier = String(metadata.planTier || "").trim();
  const billingInterval = String(metadata.billingInterval || "").trim();

  if (userId && planTier) {
    await assertUserTenantConsistency(userId, tenantId);
    const stripe = getStripe();

    // Cancel duplicate subscriptions before persisting
    const checkoutCustomerId = String(session.customer || "").trim();
    if (checkoutCustomerId) {
      try {
        await findAndCancelDuplicateSubscriptions(checkoutCustomerId, {
          keep: "oldest",
          prorate: true,
        });
      } catch (err) {
        logger.error("[handleCheckoutCompleted] duplicate cancel failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    let subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const overageItemId = await addWhatsAppOverageToSubscription(subscriptionId);
    if (overageItemId) {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
    }
    const currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);

    await updateUserPlan(
      userId,
      planTier,
      subscriptionId,
      billingInterval === "yearly" ? "year" : "month",
      currentPeriodEnd,
      subscription.cancel_at_period_end,
      subscription.status,
    );

    const whatsappItem = subscription.items.data.find(
      (item) => item.price.id === WHATSAPP_OVERAGE_PRICE_ID,
    );
    const subscriptionCustomerId = extractStripeCustomerId(subscription.customer);
    if (sessionCustomerId && subscriptionCustomerId) {
      if (sessionCustomerId !== subscriptionCustomerId) {
        throw new Error("TENANT_METADATA_MISMATCH");
      }
    }

    await upsertTenantStripeBillingData({
      tenantId,
      stripeCustomerId: subscriptionCustomerId,
      stripeSubscriptionId: subscription.id,
      whatsappOveragePriceId: WHATSAPP_OVERAGE_PRICE_ID,
      whatsappOverageSubscriptionItemId: whatsappItem?.id,
    });
    await syncTenantPlanBillingSnapshot({
      tenantId,
      subscriptionStatus: subscription.status,
      stripePriceId: extractPrimaryPriceId(subscription),
      clearScheduled: true, // fresh checkout supersedes any pending transition
      currentPeriodEnd,
    });
    invalidateTenantPlanCacheAfterWebhookUpdate(tenantId);
    await clearCheckoutReservation(tenantId).catch(() => {});
    return;
  }

  throw new Error("BAD_WEBHOOK_METADATA");
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
): Promise<void> {
  const metadata = subscription.metadata || {};
  const subscriptionCustomerId = extractStripeCustomerId(subscription.customer);
  const tenantId = await resolveTenantIdForBillingEvent({
    eventType: "customer.subscription.updated",
    metadataTenantId: metadata.tenantId,
    customerId: subscriptionCustomerId,
    subscriptionId: subscription.id,
  });

  // Handle add-on subscription updates
  if (metadata.type === "addon") {
    const addonTypeRaw = metadata.addonType;
    // Legacy whatsapp_addon subscriptions are no longer managed — skip gracefully.
    if (String(addonTypeRaw || "").trim() === "whatsapp_addon") {
      console.log(
        `[StripeWebhook] Skipping legacy whatsapp_addon subscription update ${subscription.id}`,
      );
      return;
    }
    if (!isSupportedAddonType(addonTypeRaw)) {
      throw new Error("TENANT_METADATA_MISMATCH");
    }
    const addonType = addonTypeRaw;

    const currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);

    let addonStatus: "active" | "past_due" | "cancelled";
    switch (subscription.status) {
      case "active":
        addonStatus = "active";
        break;
      case "past_due":
        addonStatus = "past_due";
        break;
      case "canceled":
      case "unpaid":
        addonStatus = "cancelled";
        break;
      default:
        console.log(
          `Add-on subscription ${subscription.id} has unhandled status: ${subscription.status}`
        );
        return;
    }

    await updateAddonStatus(tenantId, addonType, addonStatus, currentPeriodEnd);
    console.log(`Add-on ${addonType} for tenant ${tenantId} updated to ${addonStatus}`);
    invalidateBillingCache(tenantId);
    return;
  }

  const userId = String(metadata.userId || "").trim();
  const primaryPriceId = extractPrimaryPriceId(subscription);
  const primaryItem = subscription.items.data.find(
    (item) => item.price.id !== WHATSAPP_OVERAGE_PRICE_ID,
  ) ?? subscription.items.data[0];
  const interval = primaryItem?.price.recurring?.interval;

  // Resolve the new plan tier from metadata or price ID.
  const newTier: TenantPlanTier | null =
    normalizePlanTier(metadata.planTier) ??
    (primaryPriceId ? resolvePriceToTier(primaryPriceId) : null);

  const currentPeriodEndMs = (subscription as any).current_period_end
    ? (subscription as any).current_period_end * 1000
    : null;
  const currentPeriodEnd = currentPeriodEndMs ? new Date(currentPeriodEndMs) : undefined;

  // Read the tenant's current raw plan tier directly from Firestore (bypassing
  // the resolver so scheduled-plan overrides don't pollute the comparison).
  const tenantRef = db.collection("tenants").doc(tenantId);
  const tenantSnap = await tenantRef.get();
  const tenantData = tenantSnap.exists
    ? (tenantSnap.data() as Record<string, unknown> | undefined)
    : undefined;
  const storedTier: TenantPlanTier = normalizePlanTier(tenantData?.plan) ?? "free";

  // Determine upgrade vs downgrade when tier is resolvable.
  const deferDowngrade =
    String(process.env.WHATSAPP_DEFER_DOWNGRADE ?? "true").trim().toLowerCase() !== "false";

  const isDowngrade =
    newTier != null && compareTiers(newTier, storedTier) < 0;

  const shouldDefer =
    isDowngrade &&
    deferDowngrade &&
    currentPeriodEndMs != null;

  // Map Stripe status to internal status for user doc update.
  let status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "INACTIVE";
  switch (subscription.status) {
    case "active":   status = "ACTIVE"; break;
    case "trialing": status = "TRIALING"; break;
    case "past_due": status = "PAST_DUE"; break;
    case "canceled":
    case "unpaid":   status = "CANCELED"; break;
    default:         status = "INACTIVE";
  }

  if (userId) {
    await assertUserTenantConsistency(userId, tenantId);
    const overageItemId = await addWhatsAppOverageToSubscription(subscription.id);
    if (overageItemId) {
      subscription = await getStripe().subscriptions.retrieve(subscription.id);
    }

    // Always sync subscription status on the user doc regardless of tier direction.
    await updateSubscriptionStatus(
      userId,
      status,
      undefined,
      currentPeriodEnd,
      subscription.cancel_at_period_end,
    );
    console.log(`User ${userId} subscription status synced to ${status}`);

    const whatsappItem = subscription.items.data.find(
      (item) => item.price.id === WHATSAPP_OVERAGE_PRICE_ID,
    );
    const resolvedCustomerId = extractStripeCustomerId(subscription.customer);

    await upsertTenantStripeBillingData({
      tenantId,
      stripeCustomerId: resolvedCustomerId,
      stripeSubscriptionId: subscription.id,
      whatsappOveragePriceId: WHATSAPP_OVERAGE_PRICE_ID,
      whatsappOverageSubscriptionItemId: whatsappItem?.id,
    });

    if (!shouldDefer && newTier) {
      // Upgrade or same-tier: apply immediately.
      await updateUserPlan(
        userId,
        newTier,
        subscription.id,
        interval,
        currentPeriodEnd,
        subscription.cancel_at_period_end,
        subscription.status,
      );
    }
  }

  if (shouldDefer && newTier && currentPeriodEndMs != null) {
    // Downgrade deferral: schedule the tier change for the period-end date.
    // Both updateUserPlan and syncTenantPlanBillingSnapshot are intentionally
    // skipped here — the plan on the tenant stays at storedTier until the
    // applyScheduledPlanChanges cron fires.
    const scheduledPlanAt = Timestamp.fromMillis(currentPeriodEndMs);
    await syncTenantPlanBillingSnapshot({
      tenantId,
      subscriptionStatus: subscription.status,
      stripePriceId: primaryPriceId,
      scheduledPlan: newTier,
      scheduledPlanAt,
      scheduledPlanReason: "downgrade",
      eventId: undefined,
      source: "webhook.subscription.updated",
    });
    console.log(
      `[StripeWebhook] Downgrade deferred for tenant ${tenantId}: ` +
      `${storedTier} → ${newTier} at ${scheduledPlanAt.toDate().toISOString()}`,
    );
  } else {
    // Upgrade, same-tier, or deferral disabled: apply plan snapshot immediately.
    // clearScheduled=true because an upgrade supersedes any pending deferral.
    await syncTenantPlanBillingSnapshot({
      tenantId,
      subscriptionStatus: subscription.status,
      stripePriceId: primaryPriceId,
      clearScheduled: true,
      currentPeriodEnd,
      source: "webhook.subscription.updated",
    });
    invalidateTenantPlanCacheAfterWebhookUpdate(tenantId);
  }

  // Handle cancel_at_period_end: always schedule a "free" transition for period end.
  // Cancellation means the subscription will be deleted at period_end, so "free" is
  // always the correct final state — this overwrites any earlier downgrade deferral.
  if (subscription.cancel_at_period_end && currentPeriodEndMs != null) {
    const cancelAt = Timestamp.fromMillis(currentPeriodEndMs);
    const existingScheduled = normalizePlanTier(tenantData?.scheduledPlan);
    // Always schedule "free"; the condition is kept for idempotency (no-op if already "free").
    const shouldWriteCancel =
      !existingScheduled || compareTiers("free", existingScheduled) <= 0;
    if (shouldWriteCancel) {
      await syncTenantPlanBillingSnapshot({
        tenantId,
        subscriptionStatus: subscription.status,
        stripePriceId: primaryPriceId,
        scheduledPlan: "free",
        scheduledPlanAt: cancelAt,
        scheduledPlanReason: "cancel_at_period_end",
        // Phase 20: populate canonical subscription.cancelAt + flag for yellow banner.
        cancelAt: cancelAt.toDate(),
        cancelAtPeriodEnd: true,
        source: "webhook.subscription.updated",
      });
      console.log(
        `[StripeWebhook] Cancel-at-period-end scheduled for tenant ${tenantId} ` +
        `at ${cancelAt.toDate().toISOString()}`,
      );
    }
  } else if (!subscription.cancel_at_period_end) {
    // Cancellation was rescinded — clear the scheduled free-tier transition
    // only if it was set due to cancel_at_period_end (not an unrelated downgrade).
    const scheduledReason = String(tenantData?.scheduledPlanReason || "").trim();
    if (scheduledReason === "cancel_at_period_end") {
      await syncTenantPlanBillingSnapshot({
        tenantId,
        subscriptionStatus: subscription.status,
        stripePriceId: primaryPriceId,
        scheduledPlan: null,
        scheduledPlanAt: null,
        scheduledPlanReason: null,
        // Phase 20: clear cancel state on rescind so banner disappears.
        cancelAt: null,
        cancelAtPeriodEnd: false,
        source: "webhook.subscription.updated",
      });
      console.log(
        `[StripeWebhook] cancel_at_period_end rescinded for tenant ${tenantId}, cleared scheduled plan`,
      );
    }
  }

  // Propagate billing status into Auth claims for access-affecting status changes.
  const currentStripeStatus = subscription.status;
  if (
    currentStripeStatus === "past_due" ||
    currentStripeStatus === "canceled" ||
    currentStripeStatus === "unpaid"
  ) {
    invalidateBillingCache(tenantId);
    await applyBillingClaimsToTenantUsers(tenantId, {
      subscriptionStatus:
        currentStripeStatus === "unpaid" ? "canceled" : currentStripeStatus,
      ...(currentStripeStatus === "canceled" || currentStripeStatus === "unpaid"
        ? { subscriptionPlan: "free" }
        : {}),
    }).catch((err) =>
      logger.warn("billing_claims: subscription_updated_claims_error", {
        tenantId,
        stripeStatus: currentStripeStatus,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
): Promise<void> {
  const customerId = extractStripeCustomerId(invoice.customer);
  const subscriptionId = extractStripeSubscriptionId(
    (invoice as any).subscription,
  );

  console.log(`Invoice payment failed for customer ${customerId}`);

  if (!subscriptionId) return;

  const tenantId = await resolveTenantIdForBillingEvent({
    eventType: "invoice.payment_failed",
    metadataTenantId: undefined,
    customerId,
    subscriptionId,
  });
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = String(subscription.metadata?.userId || "").trim();
  await assertUserTenantConsistency(userId, tenantId);

  if (userId) {
    await updateSubscriptionStatus(
      userId,
      "PAYMENT_FAILED",
      `Invoice ${invoice.id} payment failed`,
      undefined,
      subscription.cancel_at_period_end,
    );
    console.log(`User ${userId} marked as PAYMENT_FAILED`);
  }

  // Propagate past_due status to tenant doc via the single writer.
  // pastDueSince preservation (only set if not already set) is handled
  // inside syncTenantPlanBillingSnapshot via buildTenantSubscriptionLifecyclePatch.
  await syncTenantPlanBillingSnapshot({
    tenantId,
    subscriptionStatus: "past_due",
    stripeSubscriptionId: subscriptionId || undefined,
    eventId: undefined,
    source: "webhook.invoice.payment_failed",
  });

  invalidateBillingCache(tenantId);
  await applyBillingClaimsToTenantUsers(tenantId, {
    subscriptionStatus: "past_due",
  }).catch((err) =>
    logger.warn("billing_claims: invoice_payment_failed_claims_error", {
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    }),
  );

  console.log(`[StripeWebhook] Tenant ${tenantId} marked past_due after invoice payment failure`);
}

async function handleSubscriptionCreated(
  subscription: Stripe.Subscription,
): Promise<void> {
  // Stripe always sends customer.subscription.created before
  // checkout.session.completed. We keep this handler cheap and idempotent:
  // sync billing IDs and the initial subscription status snapshot only.
  // updateUserPlan and trial-marking are handled in handleCheckoutCompleted.
  // Classify before any DB reads. Addon subscriptions are fully handled by
  // checkout.session.completed — returning early here also avoids the timing
  // issue where the addons doc doesn't exist yet at subscription.created time.
  if (classifySubscription(subscription) === "addon") {
    return;
  }

  const metadata = subscription.metadata || {};
  const subscriptionCustomerId = extractStripeCustomerId(subscription.customer);
  const tenantId = await resolveTenantIdForBillingEvent({
    eventType: "customer.subscription.created",
    metadataTenantId: metadata.tenantId,
    customerId: subscriptionCustomerId,
    subscriptionId: subscription.id,
  });

  // Cancel duplicate subscriptions before persisting
  if (subscriptionCustomerId) {
    try {
      await findAndCancelDuplicateSubscriptions(subscriptionCustomerId, {
        keep: "oldest",
        prorate: true,
      });
    } catch (err) {
      logger.error("[handleSubscriptionCreated] duplicate cancel failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const whatsappItem = subscription.items.data.find(
    (item) => item.price.id === WHATSAPP_OVERAGE_PRICE_ID,
  );

  await upsertTenantStripeBillingData({
    tenantId,
    stripeCustomerId: subscriptionCustomerId,
    stripeSubscriptionId: subscription.id,
    whatsappOveragePriceId: WHATSAPP_OVERAGE_PRICE_ID,
    whatsappOverageSubscriptionItemId: whatsappItem?.id,
  });

  const createdPeriodEnd = (subscription as any).current_period_end
    ? new Date((subscription as any).current_period_end * 1000)
    : undefined;
  await syncTenantPlanBillingSnapshot({
    tenantId,
    subscriptionStatus: subscription.status,
    stripePriceId: extractPrimaryPriceId(subscription),
    clearScheduled: true, // new subscription supersedes any pending transition
    currentPeriodEnd: createdPeriodEnd,
  });
  invalidateTenantPlanCacheAfterWebhookUpdate(tenantId);
  console.log(
    `[StripeWebhook] Subscription created for tenant ${tenantId}, status=${subscription.status}`,
  );
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const customerId = extractStripeCustomerId(invoice.customer);
  const subscriptionId = extractStripeSubscriptionId(
    (invoice as any).subscription,
  );

  if (!subscriptionId) return;

  const tenantId = await resolveTenantIdForBillingEvent({
    eventType: "invoice.paid",
    metadataTenantId: undefined,
    customerId,
    subscriptionId,
  });

  // A successful payment clears any past_due state. Re-sync the billing
  // snapshot so subscriptionStatus and pastDueSince are corrected.
  try {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const invoicePeriodEnd = (subscription as any).current_period_end
      ? new Date((subscription as any).current_period_end * 1000)
      : undefined;
    await syncTenantPlanBillingSnapshot({
      tenantId,
      subscriptionStatus: subscription.status,
      stripePriceId: extractPrimaryPriceId(subscription),
      // Do NOT pass clearScheduled: routine invoice payment must NOT wipe pending deferral
      currentPeriodEnd: invoicePeriodEnd,
    });
    invalidateTenantPlanCacheAfterWebhookUpdate(tenantId);
    console.log(
      `[StripeWebhook] Invoice paid for tenant ${tenantId}, subscription status synced`,
    );
  } catch (err) {
    console.warn(
      `[StripeWebhook] handleInvoicePaid: failed to sync billing snapshot for tenant ${tenantId}`,
      (err as Error).message,
    );
    // Non-fatal — return 200 so Stripe does not retry on subscription-not-found errors
  }
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<void> {
  const metadata = subscription.metadata || {};
  const subscriptionCustomerId = extractStripeCustomerId(subscription.customer);
  const tenantId = await resolveTenantIdForBillingEvent({
    eventType: "customer.subscription.deleted",
    metadataTenantId: metadata.tenantId,
    customerId: subscriptionCustomerId,
    subscriptionId: subscription.id,
  });

  if (classifySubscription(subscription) === "addon") {
    const addonTypeRaw = metadata.addonType;
    if (String(addonTypeRaw || "").trim() === "whatsapp_addon") {
      logger.info("[handleSubscriptionDeleted] Skipping legacy whatsapp_addon subscription", {
        subscriptionId: subscription.id,
      });
      return;
    }
    if (!isSupportedAddonType(addonTypeRaw)) {
      // Classified as addon via price-ID fallback but addonType missing in metadata
      // (pre-fix subscription). Skip rather than throw to prevent Stripe retry loop.
      logger.warn("[handleSubscriptionDeleted] addon without valid addonType, skipping", {
        subscriptionId: subscription.id,
        addonTypeRaw: addonTypeRaw ?? "(missing)",
      });
      return;
    }
    await cancelAddon(tenantId, addonTypeRaw);
    return;
  }

  // Identity guard: only mark tenant as canceled if this subscription IS the
  // tenant's current main plan. An orphaned or mis-classified subscription deletion
  // must never corrupt the tenant billing state.
  const tenantDocSnap = await db.collection("tenants").doc(tenantId).get();
  const tenantDocData = tenantDocSnap.data() as Record<string, unknown> | undefined;
  const currentMainSubId = String(tenantDocData?.stripeSubscriptionId || "").trim();
  if (currentMainSubId && currentMainSubId !== subscription.id) {
    logger.warn("[handleSubscriptionDeleted] ignoring deletion of non-current subscription", {
      tenantId,
      deletedSubId: subscription.id,
      currentSubId: currentMainSubId,
    });
    return;
  }

  const userId = String(metadata.userId || "").trim();

  if (userId) {
    await assertUserTenantConsistency(userId, tenantId);
    await updateSubscriptionStatus(userId, "CANCELED", undefined, undefined, false);
    const starterPlanId = await getPlanIdByTier("starter");

    if (starterPlanId) {
      const userRef = db.collection("users").doc(userId);
      await userRef.update({
        planId: starterPlanId,
        stripeSubscriptionId: null,
        planUpdatedAt: new Date().toISOString(),
      });
      console.log(
        `User ${userId} subscription canceled, downgraded to starter`
      );
    }
  }
  // Reset tenant to free plan via the single writer.
  // syncTenantPlanBillingSnapshot handles clearTenantPlanCache and whatsappEnabled
  // update internally (outside the transaction per Pitfall 2).
  await syncTenantPlanBillingSnapshot({
    tenantId,
    subscriptionStatus: "canceled",
    plan: "free",
    stripeSubscriptionId: null,
    pastDueSince: null,
    scheduledPlan: null,
    scheduledPlanAt: null,
    scheduledPlanReason: null,
    eventId: subscription.id,
    source: "webhook.subscription.deleted",
  });

  invalidateBillingCache(tenantId);
  await applyBillingClaimsToTenantUsers(tenantId, {
    subscriptionStatus: "canceled",
    subscriptionPlan: "free",
  }).catch((err) =>
    logger.warn("billing_claims: subscription_deleted_claims_error", {
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    }),
  );

  // Legacy cleanup: mark any residual whatsapp_addon doc as cancelled so the
  // Firestore state stays consistent after the base subscription is deleted.
  // Remove after 2026-06-15 once all legacy addon docs have been migrated.
  const addonRef = db.collection("addons").doc(`${tenantId}_whatsapp_addon`);
  const addonSnap = await addonRef.get();
  if (addonSnap.exists && addonSnap.data()?.status === "active") {
    await addonRef.update({
      status: "cancelled",
      expiresAt: FieldValue.serverTimestamp(),
    });
  }
  console.log(
    `[StripeWebhook] Tenant ${tenantId} subscription deleted, reset to free`,
  );
}

export const stripeWebhook = onRequest(
  { region: "southamerica-east1", invoker: "public" },
  async (req, res) => {
    const requestId = attachRequestId(req as any, res as any);
    const route = req.path || "/stripeWebhook";
    const baseContext = buildSecurityLogContext(req as any, {
      requestId,
      route,
      source: "stripe_webhook",
      ip: getWebhookClientIp(req),
    });

    logSecurityEvent("stripe_webhook_received", baseContext);

    if (req.method !== "POST") {
      logSecurityEvent(
        "stripe_webhook_method_not_allowed",
        {
          ...baseContext,
          status: 405,
          reason: "method_not_allowed",
        },
        "WARN",
      );
      res.status(405).send("Method Not Allowed");
      return;
    }

    if (isWebhookRateLimited(req, res)) {
      const rateLimitedContext = {
        ...baseContext,
        status: 429,
        reason: "webhook_rate_limit_exceeded",
      };
      logSecurityEvent("ratelimit_triggered", rateLimitedContext, "WARN");
      void incrementSecurityCounter("ratelimit_triggered", rateLimitedContext);
      res.status(429).json({ error: "Too many requests" });
      return;
    }

    const signatureHeader = req.headers["stripe-signature"];
    const signature = Array.isArray(signatureHeader)
      ? signatureHeader[0]
      : signatureHeader;

    if (!signature) {
      logSecurityEvent(
        "stripe_webhook_missing_signature",
        {
          ...baseContext,
          status: 400,
          reason: "missing_signature",
        },
        "WARN",
      );
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    try {
      const stripe = getStripe();
      const webhookSecret = getWebhookSecret();
      void cleanupExpiredStripeEventsBestEffort();

      const rawBody = req.rawBody;
      if (!rawBody || !(rawBody instanceof Buffer)) {
        logSecurityEvent(
          "stripe_webhook_missing_raw_body",
          {
            ...baseContext,
            status: 400,
            reason: "missing_raw_body",
          },
          "WARN",
        );
        res.status(400).json({ error: "Missing raw request body" });
        return;
      }
      if (rawBody.length > MAX_WEBHOOK_BODY_BYTES) {
        logSecurityEvent(
          "stripe_webhook_payload_too_large",
          {
            ...baseContext,
            status: 413,
            reason: "payload_too_large",
          },
          "WARN",
        );
        res.status(413).json({ error: "Payload too large" });
        return;
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          rawBody,
          signature,
          webhookSecret
        );
      } catch (err) {
        const signatureContext = {
          ...baseContext,
          status: 400,
          reason: "invalid_signature",
        };
        logSecurityEvent("stripe_webhook_signature_verification_failed", signatureContext, "WARN");
        res.status(400).json({ error: "Invalid signature" });
        return;
      }

      const eventContext = {
        ...baseContext,
        eventId: event.id,
      };

      const processDecision = await beginStripeEventProcessing(event);
      if (processDecision === "skip") {
        logSecurityEvent("stripe_webhook_duplicate_event_skipped", {
          ...eventContext,
          status: 200,
          reason: "duplicate_event",
        });
        res.json({ received: true, duplicate: true });
        return;
      }

      try {
        switch (event.type) {
          case "checkout.session.completed":
            await handleCheckoutCompleted(
              event.data.object as Stripe.Checkout.Session
            );
            break;

          case "customer.subscription.created":
            await handleSubscriptionCreated(
              event.data.object as Stripe.Subscription
            );
            break;

          case "customer.subscription.updated":
            await handleSubscriptionUpdated(
              event.data.object as Stripe.Subscription
            );
            break;

          case "customer.subscription.deleted":
            await handleSubscriptionDeleted(
              event.data.object as Stripe.Subscription
            );
            break;

          case "invoice.paid":
          case "invoice.payment_succeeded":
            await handleInvoicePaid(event.data.object as Stripe.Invoice);
            break;

          case "invoice.payment_failed":
            await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
            break;

          default:
            console.log(`Unhandled event type: ${event.type}`);
        }

        await finalizeStripeEventProcessing(event, "processed");
        logSecurityEvent("stripe_webhook_processed", {
          ...eventContext,
          status: 200,
        });
        res.json({ received: true });
      } catch (handlerError) {
        const message =
          handlerError instanceof Error ? handlerError.message : "unknown";
        await finalizeStripeEventProcessing(
          event,
          "failed",
          sanitizeStripeEventError(message),
        );
        const failedContext = {
          ...eventContext,
          status: 500,
          reason: sanitizeStripeEventError(message),
        };
        logSecurityEvent("webhook_failed", failedContext, "ERROR");
        void incrementSecurityCounter("webhook_failed", failedContext);
        void writeSecurityAuditEvent({
          eventType: "webhook_failed",
          requestId: failedContext.requestId,
          route: failedContext.route,
          status: failedContext.status,
          tenantId: failedContext.tenantId,
          uid: failedContext.uid,
          eventId: failedContext.eventId,
          reason: failedContext.reason,
          source: failedContext.source,
        });
        throw handlerError;
      }
    } catch (error) {
      const genericErrorContext = {
        ...baseContext,
        status: 500,
        reason:
          error instanceof Error
            ? sanitizeStripeEventError(error.message)
            : "webhook_handler_failed",
      };
      logSecurityEvent("webhook_failed", genericErrorContext, "ERROR");
      void incrementSecurityCounter("webhook_failed", genericErrorContext);
      void writeSecurityAuditEvent({
        eventType: "webhook_failed",
        requestId: genericErrorContext.requestId,
        route: genericErrorContext.route,
        status: genericErrorContext.status,
        tenantId: genericErrorContext.tenantId,
        uid: genericErrorContext.uid,
        reason: genericErrorContext.reason,
        source: genericErrorContext.source,
      });
      res.status(500).json({ error: "Webhook handler failed" });
    }
  }
);
