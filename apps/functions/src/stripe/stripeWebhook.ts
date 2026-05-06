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
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "active") return "active";
  if (normalized === "trialing") return "trialing";
  if (normalized === "past_due") return "past_due";
  if (normalized === "canceled" || normalized === "unpaid") return "canceled";
  return "inactive";
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

async function syncTenantPlanBillingSnapshot(params: {
  tenantId: string;
  subscriptionStatus: string;
  stripePriceId?: string;
  /** When true, clears scheduledPlan/At/Reason (use for upgrades and fresh checkouts only). */
  clearScheduled?: boolean;
}): Promise<void> {
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

  await db.runTransaction(async (transaction) => {
    const tenantSnap = await transaction.get(tenantRef);
    const tenantData = tenantSnap.exists
      ? (tenantSnap.data() as Record<string, unknown> | undefined)
      : undefined;

    const lifecyclePatch = buildTenantSubscriptionLifecyclePatch({
      subscriptionStatus: params.subscriptionStatus,
      stripePriceId: params.stripePriceId,
      existingPastDueSince: tenantData?.pastDueSince,
      nowIso,
    });

    const patch: Record<string, unknown> = {
      ...lifecyclePatch,
      updatedAt: nowIso,
    };
    if (derivedTier) {
      patch.plan = derivedTier;
      // Only clear scheduled fields when there is a resolved tier AND the caller
      // explicitly requests it (upgrades, fresh checkouts). Routine invoice
      // payments must NOT clear a pending downgrade deferral.
      if (params.clearScheduled) {
        patch.scheduledPlan = null;
        patch.scheduledPlanAt = null;
        patch.scheduledPlanReason = null;
      }
    }

    transaction.set(tenantRef, patch, { merge: true });
  });

  // Re-evaluate WhatsApp eligibility against the freshly-written plan.
  // Done outside the transaction because tenantPlanAllowsWhatsApp issues
  // additional reads (plan cache + addons doc) incompatible with a transaction.
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

async function beginStripeEventProcessing(
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

    // Mark trial as used on tenant when subscription starts in trialing state
    if (subscription.status === "trialing" || metadata.trial === "true") {
      const tenantRef = db.collection("tenants").doc(tenantId);
      const tenantSnap = await tenantRef.get();
      const tenantData = tenantSnap.exists
        ? (tenantSnap.data() as Record<string, unknown> | undefined)
        : undefined;
      if (!tenantData?.trialUsedAt) {
        const trialEnd = (subscription as any).trial_end
          ? new Date((subscription as any).trial_end * 1000).toISOString()
          : undefined;
        await tenantRef.set(
          {
            trialUsedAt: new Date().toISOString(),
            trialPlanTier: planTier,
            ...(trialEnd && { trialEndsAt: trialEnd }),
          },
          { merge: true },
        );
        console.log(`Trial marked as used for tenant ${tenantId}`);
      }
    }

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
    });
    invalidateTenantPlanCacheAfterWebhookUpdate(tenantId);
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
    await tenantRef.set(
      {
        scheduledPlan: newTier,
        scheduledPlanAt,
        scheduledPlanReason: "downgrade",
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    clearTenantPlanCache(tenantId);
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
      await tenantRef.set(
        {
          scheduledPlan: "free",
          scheduledPlanAt: cancelAt,
          scheduledPlanReason: "cancel_at_period_end",
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      clearTenantPlanCache(tenantId);
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
      await tenantRef.set(
        {
          scheduledPlan: null,
          scheduledPlanAt: null,
          scheduledPlanReason: null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      clearTenantPlanCache(tenantId);
      console.log(
        `[StripeWebhook] cancel_at_period_end rescinded for tenant ${tenantId}, cleared scheduled plan`,
      );
    }
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

  // Propagate past_due status to tenant doc. Only set pastDueSince if not
  // already set (preserves the original failure timestamp on retries).
  const tenantRef = db.collection("tenants").doc(tenantId);
  const tenantSnap = await tenantRef.get();
  const tenantData = tenantSnap.exists
    ? (tenantSnap.data() as Record<string, unknown> | undefined)
    : undefined;
  const nowIso = new Date().toISOString();
  const existingPastDueSince = String(tenantData?.pastDueSince || "").trim();
  await tenantRef.set(
    {
      subscriptionStatus: "past_due",
      pastDueSince: existingPastDueSince || nowIso,
      updatedAt: nowIso,
    },
    { merge: true },
  );
  clearTenantPlanCache(tenantId);
  console.log(`[StripeWebhook] Tenant ${tenantId} marked past_due after invoice payment failure`);
}

async function handleSubscriptionCreated(
  subscription: Stripe.Subscription,
): Promise<void> {
  // Stripe always sends customer.subscription.created before
  // checkout.session.completed. We keep this handler cheap and idempotent:
  // sync billing IDs and the initial subscription status snapshot only.
  // updateUserPlan and trial-marking are handled in handleCheckoutCompleted.
  const metadata = subscription.metadata || {};
  if (metadata.type === "addon") {
    // Addon created events are fully handled by checkout.session.completed.
    return;
  }

  const subscriptionCustomerId = extractStripeCustomerId(subscription.customer);
  const tenantId = await resolveTenantIdForBillingEvent({
    eventType: "customer.subscription.created",
    metadataTenantId: metadata.tenantId,
    customerId: subscriptionCustomerId,
    subscriptionId: subscription.id,
  });

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

  await syncTenantPlanBillingSnapshot({
    tenantId,
    subscriptionStatus: subscription.status,
    stripePriceId: extractPrimaryPriceId(subscription),
    clearScheduled: true, // new subscription supersedes any pending transition
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
    await syncTenantPlanBillingSnapshot({
      tenantId,
      subscriptionStatus: subscription.status,
      stripePriceId: extractPrimaryPriceId(subscription),
      // Do NOT pass clearScheduled: routine invoice payment must NOT wipe pending deferral
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

  if (metadata.type === "addon") {
    const addonTypeRaw = metadata.addonType;
    // Legacy whatsapp_addon subscriptions are no longer managed — skip gracefully.
    if (String(addonTypeRaw || "").trim() === "whatsapp_addon") {
      console.log(
        `[StripeWebhook] Skipping legacy whatsapp_addon subscription deleted ${subscription.id}`,
      );
      return;
    }
    if (!isSupportedAddonType(addonTypeRaw)) {
      throw new Error("TENANT_METADATA_MISMATCH");
    }
    const addonType = addonTypeRaw;
    await cancelAddon(tenantId, addonType);
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
  const tenantRef = db.collection("tenants").doc(tenantId);
  await tenantRef.set(
    {
      plan: "free",
      stripeSubscriptionId: null,
      subscriptionStatus: "canceled",
      pastDueSince: null,
      scheduledPlan: null,
      scheduledPlanAt: null,
      scheduledPlanReason: null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
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

  // Recompute WhatsApp eligibility now that the plan has been reset to free.
  // Note: user doc is downgraded to "starter" above (pre-existing behaviour) while
  // tenant is reset to "free" — these intentionally differ; the tenant tier is
  // the authoritative source for feature gating.
  clearTenantPlanCache(tenantId);
  const allowsWhatsApp = await tenantPlanAllowsWhatsApp(tenantId);
  await tenantRef.update({ whatsappEnabled: allowsWhatsApp });
  console.log(
    `[StripeWebhook] Tenant ${tenantId} subscription deleted, reset to free, whatsappEnabled=${allowsWhatsApp}`,
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
