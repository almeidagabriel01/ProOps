import { db } from "../init";
import { FieldValue } from "firebase-admin/firestore";
import { getStripe } from "./stripeConfig";

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
): Promise<void> {
  const planId = await getPlanIdByTier(planTier);
  const billingInterval = interval === "year" ? "yearly" : "monthly";
  const userRef = db.collection("users").doc(userId);

  const updatePayload: Record<string, unknown> = {
    billingInterval: billingInterval,
    stripeSubscriptionId: stripeSubscriptionId,
    planUpdatedAt: FieldValue.serverTimestamp(),
    role: "admin",
    subscriptionStatus: "active",
    cancelAtPeriodEnd: cancelAtPeriodEnd ?? false,
    "subscription.status": "ACTIVE",
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

  await userRef.update(updatePayload);

  if (planId) {
    console.log(
      `Updated user ${userId} to plan ${planTier} (${planId}) - ${billingInterval}`
    );
  } else {
    console.warn(
      `Plan not found for tier: ${planTier}. Core subscription fields were still updated for user ${userId}.`
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
  status: SubscriptionStatus
): "active" | "trialing" | "past_due" | "canceled" | "payment_failed" | "inactive" {
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
  cancelAtPeriodEnd?: boolean
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

export type AddonType = "financial" | "pdf_editor_partial" | "pdf_editor_full";

export async function saveAddon(
  tenantId: string,
  addonType: AddonType,
  stripeSubscriptionId: string
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
  addonType: AddonType
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
  currentPeriodEnd?: Date
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
    `Updated add-on ${addonType} for tenant ${tenantId} to ${status}`
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
  dryRun: boolean = false
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
      const subscription = await stripe.subscriptions.retrieve(
        stripeSubscriptionId
      );

      const status = mapStripeSubscriptionStatus(subscription.status);
      const currentPeriodEnd = new Date(
        (subscription as any).current_period_end * 1000
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
          subscription.cancel_at_period_end
        );
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
