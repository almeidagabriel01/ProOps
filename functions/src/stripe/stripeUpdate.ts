/**
 * Stripe Update Cloud Function
 *
 * Updates an existing subscription (upgrade/downgrade).
 * Migrated from: src/app/api/stripe/update/route.ts
 */

import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { getStripe, getPriceIdForTier } from "./stripeConfig";
import { getPlanIdByTier } from "./stripeHelpers";

const db = getFirestore();

interface UpdateRequest {
  userId: string;
  planTier: string;
}

interface UpdateResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export const stripeUpdate = functions
  .region("southamerica-east1")
  .https.onCall(async (data: UpdateRequest): Promise<UpdateResponse> => {
    const { userId, planTier } = data || {};

    if (!userId || !planTier) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "userId and planTier are required"
      );
    }

    // Get the price ID for the selected plan
    const priceId = getPriceIdForTier(planTier);
    if (!priceId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid plan tier or price not configured"
      );
    }

    try {
      const stripe = getStripe();

      // Get user's current subscription
      const userRef = db.collection("users").doc(userId);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        throw new functions.https.HttpsError("not-found", "User not found");
      }

      const userData = userSnap.data()!;
      const subscriptionId = userData.stripeSubscriptionId;

      if (!subscriptionId) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "No active subscription found"
        );
      }

      // Get current subscription
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const subscriptionItemId = subscription.items.data[0]?.id;

      if (!subscriptionItemId) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Subscription item not found"
        );
      }

      // Update subscription to new price (downgrade or upgrade)
      await stripe.subscriptions.update(subscriptionId, {
        items: [
          {
            id: subscriptionItemId,
            price: priceId,
          },
        ],
        proration_behavior: "create_prorations",
        metadata: {
          userId: userId,
          planTier: planTier,
        },
      });

      // Update user's plan in Firestore
      const planId = await getPlanIdByTier(planTier);
      if (planId) {
        await userRef.update({
          planId: planId,
          planUpdatedAt: new Date().toISOString(),
        });
      }

      return { success: true, message: "Subscription updated successfully" };
    } catch (error) {
      console.error("Error updating subscription:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        "internal",
        "Failed to update subscription"
      );
    }
  });
