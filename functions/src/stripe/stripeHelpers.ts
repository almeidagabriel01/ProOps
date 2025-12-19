/**
 * Stripe Helper Functions for Cloud Functions
 *
 * Shared utilities for Stripe operations.
 */

import { getFirestore, FieldValue } from "firebase-admin/firestore";

const db = getFirestore();

/**
 * Get plan ID by tier from Firestore
 */
export async function getPlanIdByTier(tier: string): Promise<string | null> {
  const plansRef = db.collection("plans");
  const snapshot = await plansRef.where("tier", "==", tier).get();

  if (!snapshot.empty) {
    return snapshot.docs[0].id;
  }
  return null;
}

/**
 * Update user's plan in Firestore
 */
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
    });
    console.log(
      `Updated user ${userId} to plan ${planTier} (${planId}) - ${billingInterval}`
    );
  } else {
    console.error(`Plan not found for tier: ${planTier}`);
  }
}

/**
 * Add-on type (matches frontend types)
 */
export type AddonType = "financial" | "pdf_editor_partial" | "pdf_editor_full";

/**
 * Save add-on to Firestore
 */
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

/**
 * Cancel add-on in Firestore
 */
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
