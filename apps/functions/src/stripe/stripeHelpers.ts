import { auth, db } from "../init";
import { FieldValue } from "firebase-admin/firestore";
import { getStripe } from "./stripeConfig";
import { syncTenantPlanBillingSnapshot } from "./stripeWebhook";
import type { TenantPlanTier } from "../lib/tenant-plan-policy";

export const WHATSAPP_OVERAGE_PRICE_ID = "price_1T20T7GrkF9UfsqcEtdBX9fY";

export async function getPlanIdByTier(tier: string): Promise<string | null> {
  const plansRef = db.collection("plans");
  const snapshot = await plansRef.where("tier", "==", tier).get();

  if (!snapshot.empty) {
    return snapshot.docs[0].id;
  }
  return null;
}

export async function updateUserPlan(
  userId: string,
  planTier: string,
  stripeSubscriptionId: string,
  interval?: string,
  currentPeriodEnd?: Date,
  cancelAtPeriodEnd?: boolean,
  stripeSubscriptionStatus?: string,
): Promise<void> {
  const planId = await getPlanIdByTier(planTier);
  const billingInterval = interval === "year" ? "yearly" : "monthly";
  const userRef = db.collection("users").doc(userId);
  const existingUserSnap = await userRef.get();
  const existingUserData = existingUserSnap.exists
    ? (existingUserSnap.data() as Record<string, unknown> | undefined)
    : undefined;

  const currentRole = String(existingUserData?.role || "")
    .trim()
    .toLowerCase();
  const hasMasterId = Boolean(String(existingUserData?.masterId || "").trim());
  const tenantIdForClaims = String(
    existingUserData?.tenantId || existingUserData?.companyId || "",
  ).trim();
  const stripeIdForClaims = String(existingUserData?.stripeId || "").trim();
  const shouldPromoteFreeOwner = currentRole === "free" && !hasMasterId;

  const resolvedStatus = mapStripeSubscriptionStatus(
    stripeSubscriptionStatus || "active",
  );
  const clientStatus = toClientSubscriptionStatus(resolvedStatus);

  const updatePayload: Record<string, unknown> = {
    billingInterval: billingInterval,
    stripeSubscriptionId: stripeSubscriptionId,
    planUpdatedAt: FieldValue.serverTimestamp(),
    subscriptionStatus: clientStatus,
    cancelAtPeriodEnd: cancelAtPeriodEnd ?? false,
    "subscription.status": resolvedStatus,
    "subscription.cancelAtPeriodEnd": cancelAtPeriodEnd ?? false,
    "subscription.updatedAt": FieldValue.serverTimestamp(),
  };

  if (planId) {
    updatePayload.planId = planId;
  }

  if (currentPeriodEnd) {
    updatePayload.currentPeriodEnd = currentPeriodEnd.toISOString();
    updatePayload["subscription.currentPeriodEnd"] = currentPeriodEnd;
  }

  if (shouldPromoteFreeOwner) {
    updatePayload.role = "admin";
  }

  await userRef.update(updatePayload);

  if (shouldPromoteFreeOwner && tenantIdForClaims) {
    try {
      const userRecord = await auth.getUser(userId);
      const previousClaims = (userRecord.customClaims || {}) as Record<
        string,
        unknown
      >;

      const nextClaims: Record<string, unknown> = {
        ...previousClaims,
        role: "ADMIN",
        tenantId: tenantIdForClaims,
      };

      if (stripeIdForClaims) {
        nextClaims.stripeId = stripeIdForClaims;
      }

      await auth.setCustomUserClaims(userId, nextClaims);
    } catch (claimsError) {
      console.error(
        `[updateUserPlan] Failed to set custom claims for user ${userId}`,
        claimsError,
      );
    }
  }

  try {
    const userSnap = await userRef.get();
    const userData = userSnap.data();
    if (userData) {
      const tenantId = String(userData.tenantId || userData.companyId || "").trim();
      if (!tenantId) {
        console.warn(
          `[updateUserPlan] Missing tenantId for user ${userId}. Skipping tenant billing sync.`,
        );
        return;
      }
      const normalizedTier = String(planTier || "").trim().toLowerCase();

      const tenantRef = db.collection("tenants").doc(tenantId);
      const tenantSnap = await tenantRef.get();
      if (tenantSnap.exists) {
        await syncTenantPlanBillingSnapshot({
          tenantId,
          subscriptionStatus: clientStatus,
          plan: normalizedTier as TenantPlanTier,
          stripeSubscriptionId,
          currentPeriodEnd,
          cancelAtPeriodEnd: cancelAtPeriodEnd ?? false,
          billingInterval,
          source: "helpers.updateUserPlan",
        });
      }
    }
  } catch (err) {
    console.error(
      `Failed to sync whatsappEnabled for user ${userId} during plan update`,
      err,
    );
  }

  if (planId) {
    console.log(
      `Updated user ${userId} to plan ${planTier} (${planId}) - ${billingInterval}`,
    );
  } else {
    console.warn(
      `Plan not found for tier: ${planTier}. Core subscription fields were still updated for user ${userId}.`,
    );
  }
}

export type SubscriptionStatus =
  | "ACTIVE"
  | "TRIALING"
  | "PAST_DUE"
  | "CANCELED"
  | "PAYMENT_FAILED"
  | "INACTIVE";

export type StripeSyncStatus =
  | "ACTIVE"
  | "TRIALING"
  | "PAST_DUE"
  | "CANCELED"
  | "INACTIVE";

export function mapStripeSubscriptionStatus(status: string): StripeSyncStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
    case "unpaid":
      return "CANCELED";
    default:
      return "INACTIVE";
  }
}

function toClientSubscriptionStatus(
  status: SubscriptionStatus,
):
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "payment_failed"
  | "inactive" {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "TRIALING":
      return "trialing";
    case "PAST_DUE":
      return "past_due";
    case "CANCELED":
      return "canceled";
    case "PAYMENT_FAILED":
      return "payment_failed";
    case "INACTIVE":
    default:
      return "inactive";
  }
}

export async function updateSubscriptionStatus(
  userId: string,
  status: SubscriptionStatus,
  reason?: string,
  currentPeriodEnd?: Date,
  cancelAtPeriodEnd?: boolean,
): Promise<void> {
  const userRef = db.collection("users").doc(userId);
  await userRef.update({
    subscriptionStatus: toClientSubscriptionStatus(status),
    cancelAtPeriodEnd: cancelAtPeriodEnd ?? false,
    "subscription.status": status,
    "subscription.updatedAt": FieldValue.serverTimestamp(),
    "subscription.cancelAtPeriodEnd": cancelAtPeriodEnd ?? false,
    ...(reason && { "subscription.reason": reason }),
    ...(currentPeriodEnd && {
      "subscription.currentPeriodEnd": currentPeriodEnd,
      currentPeriodEnd: currentPeriodEnd.toISOString(),
    }),
  });
  console.log(`Updated subscription status for user ${userId} to ${status}`);
}

export type AddonType =
  | "financial"
  | "pdf_editor_partial"
  | "pdf_editor_full"
  | "crm";

export async function saveAddon(
  tenantId: string,
  addonType: AddonType,
  stripeSubscriptionId: string,
): Promise<void> {
  const addonId = `${tenantId}_${addonType}`;

  await db.collection("addons").doc(addonId).set({
    tenantId,
    addonType,
    stripeSubscriptionId,
    status: "active",
    purchasedAt: FieldValue.serverTimestamp(),
  });

  console.log(`Saved add-on ${addonType} for tenant ${tenantId}`);
}

export async function cancelAddon(
  tenantId: string,
  addonType: AddonType,
): Promise<void> {
  const addonId = `${tenantId}_${addonType}`;

  await db.collection("addons").doc(addonId).update({
    status: "cancelled",
    expiresAt: FieldValue.serverTimestamp(),
  });

  console.log(`Cancelled add-on ${addonType} for tenant ${tenantId}`);
}

export async function updateAddonStatus(
  tenantId: string,
  addonType: AddonType,
  status: "active" | "past_due" | "cancelled",
  currentPeriodEnd?: Date,
): Promise<void> {
  const addonId = `${tenantId}_${addonType}`;

  const updateData: Record<string, unknown> = {
    status,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (currentPeriodEnd) {
    updateData.currentPeriodEnd = currentPeriodEnd.toISOString();
  }

  if (status === "cancelled") {
    updateData.expiresAt = FieldValue.serverTimestamp();
  }

  await db.collection("addons").doc(addonId).update(updateData);

  console.log(
    `Updated add-on ${addonType} for tenant ${tenantId} to ${status}`,
  );
}

export interface SyncResult {
  scanned: number;
  eligible: number;
  synced: number;
  failed: number;
  nextStartAfterId: string | null;
  hasMore: boolean;
  errors: Array<{ userId: string; error: string }>;
  changes?: Array<{ userId: string; oldStatus: string; newStatus: string }>;
}

export async function runStripeSync(
  limit: number,
  startAfterId?: string,
  dryRun: boolean = false,
): Promise<SyncResult> {
  let usersQuery: FirebaseFirestore.Query = db
    .collection("users")
    .orderBy("__name__")
    .limit(limit);

  if (startAfterId) {
    const cursorDoc = await db.collection("users").doc(startAfterId).get();
    if (cursorDoc.exists) {
      usersQuery = usersQuery.startAfter(cursorDoc);
    }
  }

  const usersSnapshot = await usersQuery.get();
  const stripe = getStripe();

  let scanned = 0;
  let eligible = 0;
  let synced = 0;
  let failed = 0;
  const errors: Array<{ userId: string; error: string }> = [];
  const changes: Array<{
    userId: string;
    oldStatus: string;
    newStatus: string;
  }> = [];

  for (const userDoc of usersSnapshot.docs) {
    scanned += 1;
    const userData = userDoc.data();
    const stripeSubscriptionId =
      userData?.stripeSubscriptionId || userData?.subscription?.id;

    if (!stripeSubscriptionId || typeof stripeSubscriptionId !== "string") {
      continue;
    }

    eligible += 1;

    try {
      const subscription =
        await stripe.subscriptions.retrieve(stripeSubscriptionId);

      const status = mapStripeSubscriptionStatus(subscription.status);
      const currentPeriodEnd = new Date(
        (subscription as any).current_period_end * 1000,
      );

      const oldStatus = userData.subscription?.status || "UNKNOWN";

      if (status !== oldStatus) {
        changes.push({
          userId: userDoc.id,
          oldStatus,
          newStatus: status,
        });
      }

      if (!dryRun) {
        await updateSubscriptionStatus(
          userDoc.id,
          status,
          "Batch sync",
          currentPeriodEnd,
          subscription.cancel_at_period_end,
        );
        const tenantId = userData.tenantId;
        if (tenantId) {
          await syncTenantPlanBillingSnapshot({
            tenantId,
            subscriptionStatus: mapStripeSubscriptionStatus(subscription.status).toLowerCase(),
            currentPeriodEnd,
            source: "helpers.runStripeSync",
          });
        }
      }

      synced += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push({ userId: userDoc.id, error: message });
    }
  }

  const lastDoc = usersSnapshot.docs[usersSnapshot.docs.length - 1];
  const nextStartAfterId = lastDoc ? lastDoc.id : null;

  return {
    scanned,
    eligible,
    synced,
    failed,
    nextStartAfterId,
    hasMore: usersSnapshot.size === limit,
    errors,
    changes,
  };
}

export async function addWhatsAppOverageToSubscription(
  subscriptionId: string,
): Promise<string | null> {
  const stripe = getStripe();

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Check if already exists
    const existingItem = subscription.items.data.find(
      (item) => item.price.id === WHATSAPP_OVERAGE_PRICE_ID,
    );

    if (existingItem) {
      console.log(
        `[addWhatsAppOverage] Item already exists in subscription ${subscriptionId}`,
      );
      return existingItem.id;
    }

    const primaryItem =
      subscription.items.data.find(
        (item) => item.price.id !== WHATSAPP_OVERAGE_PRICE_ID,
      ) || subscription.items.data[0];
    const baseRecurring = primaryItem?.price?.recurring;
    const overagePrice = await stripe.prices.retrieve(WHATSAPP_OVERAGE_PRICE_ID);
    const overageRecurring = overagePrice.recurring;

    if (
      baseRecurring &&
      overageRecurring &&
      (
        baseRecurring.interval !== overageRecurring.interval ||
        (baseRecurring.interval_count || 1) !==
          (overageRecurring.interval_count || 1)
      )
    ) {
      console.warn(
        `[addWhatsAppOverage] Skipping overage item for subscription ${subscriptionId} due to recurring interval mismatch (${baseRecurring.interval}/${baseRecurring.interval_count || 1} vs ${overageRecurring.interval}/${overageRecurring.interval_count || 1}).`,
      );
      return null;
    }

    // Add item
    const updatedSubscription = await stripe.subscriptions.update(
      subscriptionId,
      {
        items: [
          ...subscription.items.data.map((item) => ({ id: item.id })), // Keep existing items
          { price: WHATSAPP_OVERAGE_PRICE_ID },
        ],
      },
    );

    const newItem = updatedSubscription.items.data.find(
      (item) => item.price.id === WHATSAPP_OVERAGE_PRICE_ID,
    );

    if (newItem) {
      console.log(
        `[addWhatsAppOverage] Added item ${newItem.id} to subscription ${subscriptionId}`,
      );
      return newItem.id;
    }

    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("All prices on a subscription must have the same `recurring.interval`")
    ) {
      console.warn(
        `[addWhatsAppOverage] Skipping overage item for subscription ${subscriptionId} due to Stripe interval restriction.`,
      );
      return null;
    }

    console.error(
      `[addWhatsAppOverage] Error adding item to subscription ${subscriptionId}:`,
      error,
    );
    throw error;
  }
}

export async function upsertTenantStripeBillingData(input: {
  tenantId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  whatsappOveragePriceId?: string;
  whatsappOverageSubscriptionItemId?: string;
}): Promise<void> {
  const tenantId = String(input.tenantId || "").trim();
  if (!tenantId) return;

  const tenantRef = db.collection("tenants").doc(tenantId);

  // Route billing-state fields (stripeCustomerId, stripeSubscriptionId) through the
  // single writer. Read existing subscriptionStatus to preserve it — this function's
  // callers do not mutate status, so the read-back value is intentionally non-authoritative
  // for status (T-19-03-05: concurrent writer may change status between this read and the
  // writer's own transaction, but that is acceptable since upsertTenantStripeBillingData
  // is not responsible for status transitions).
  if (input.stripeCustomerId || input.stripeSubscriptionId) {
    const existingSnap = await tenantRef.get();
    const existingData = existingSnap.exists
      ? (existingSnap.data() as Record<string, unknown>)
      : undefined;
    const existingStatus = String(
      (existingData?.subscription as Record<string, unknown> | undefined)?.status ??
        existingData?.subscriptionStatus ??
        "",
    )
      .trim()
      .toLowerCase();

    await syncTenantPlanBillingSnapshot({
      tenantId,
      subscriptionStatus: existingStatus || "inactive",
      ...(input.stripeCustomerId ? { stripeCustomerId: input.stripeCustomerId } : {}),
      ...(input.stripeSubscriptionId ? { stripeSubscriptionId: input.stripeSubscriptionId } : {}),
      source: "helpers.upsertTenantStripeBillingData",
    });
  }

  // EXEMPT: addon-item identifiers, not subscription state (CONTEXT.md `subscription.*` schema does not contain these fields)
  if (input.whatsappOveragePriceId || input.whatsappOverageSubscriptionItemId) {
    const addonPayload: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (input.whatsappOveragePriceId) {
      addonPayload.whatsappOveragePriceId = input.whatsappOveragePriceId;
    }
    if (input.whatsappOverageSubscriptionItemId) {
      addonPayload.whatsappOverageSubscriptionItemId = input.whatsappOverageSubscriptionItemId;
    }
    await tenantRef.set(addonPayload, { merge: true });
  }
}
