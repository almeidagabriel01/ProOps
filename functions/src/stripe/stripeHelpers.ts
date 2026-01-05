import { db } from "../init";
import { FieldValue } from "firebase-admin/firestore";

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
  interval?: string
): Promise<void> {
  const planId = await getPlanIdByTier(planTier);
  const billingInterval = interval === "year" ? "yearly" : "monthly";

  if (planId) {
    const userRef = db.collection("users").doc(userId);
    await userRef.update({
      planId: planId,
      billingInterval: billingInterval,
      stripeSubscriptionId: stripeSubscriptionId,
      planUpdatedAt: FieldValue.serverTimestamp(),
      role: "admin",
      "subscription.status": "ACTIVE",
      "subscription.updatedAt": FieldValue.serverTimestamp(),
    });
    console.log(
      `Updated user ${userId} to plan ${planTier} (${planId}) - ${billingInterval}`
    );
  } else {
    console.error(`Plan not found for tier: ${planTier}`);
  }
}

export type SubscriptionStatus =
  | "ACTIVE"
  | "TRIALING"
  | "PAST_DUE"
  | "CANCELED"
  | "PAYMENT_FAILED"
  | "INACTIVE";

export async function updateSubscriptionStatus(
  userId: string,
  status: SubscriptionStatus,
  reason?: string
): Promise<void> {
  const userRef = db.collection("users").doc(userId);
  await userRef.update({
    "subscription.status": status,
    "subscription.updatedAt": FieldValue.serverTimestamp(),
    ...(reason && { "subscription.reason": reason }),
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
