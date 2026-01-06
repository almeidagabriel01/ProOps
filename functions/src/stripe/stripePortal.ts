/**
 * Stripe Portal Cloud Function
 *
 * Creates a Stripe Customer Portal session.
 * Migrated from: src/app/api/stripe/portal/route.ts
 */

import {
  onCall,
  HttpsError,
  CallableRequest,
} from "firebase-functions/v2/https";
import { CORS_OPTIONS } from "../deploymentConfig";

import { getStripe, getAppUrl } from "./stripeConfig";
import { db } from "../init";

interface PortalRequest {
  userId: string;
  origin?: string;
}

interface PortalResponse {
  url?: string;
  error?: string;
}

export const stripePortal = onCall(
  CORS_OPTIONS,
  async (request: CallableRequest<PortalRequest>): Promise<PortalResponse> => {
    const { data } = request;
    const { userId } = data || {};

    if (!userId) {
      throw new HttpsError("invalid-argument", "userId is required");
    }

    try {
      const stripe = getStripe();

      // Get user's Stripe customer ID
      const userRef = db.collection("users").doc(userId);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        throw new HttpsError("not-found", "User not found");
      }

      const userData = userSnap.data()!;
      const customerId = userData.stripeCustomerId;

      if (!customerId) {
        throw new HttpsError(
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
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Failed to create portal session");
    }
  }
);
