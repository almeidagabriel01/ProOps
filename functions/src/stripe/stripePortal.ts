/**
 * Stripe Portal Cloud Function
 *
 * Creates a Stripe Customer Portal session.
 * Migrated from: src/app/api/stripe/portal/route.ts
 */

import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { getStripe, getAppUrl } from "./stripeConfig";

const db = getFirestore();

interface PortalRequest {
  userId: string;
  origin?: string;
}

interface PortalResponse {
  url?: string;
  error?: string;
}

export const stripePortal = functions
  .region("southamerica-east1")
  .https.onCall(async (data: PortalRequest): Promise<PortalResponse> => {
    const { userId } = data || {};

    if (!userId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "userId is required"
      );
    }

    try {
      const stripe = getStripe();

      // Get user's Stripe customer ID
      const userRef = db.collection("users").doc(userId);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        throw new functions.https.HttpsError("not-found", "User not found");
      }

      const userData = userSnap.data()!;
      const customerId = userData.stripeCustomerId;

      if (!customerId) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "No payment method on file. Please subscribe to a plan first."
        );
      }

      const appUrl = data?.origin || getAppUrl();

      // Create a Customer Portal session
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appUrl}/profile`,
      });

      return { url: session.url };
    } catch (error) {
      console.error("Error creating portal session:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        "internal",
        "Failed to create portal session"
      );
    }
  });
