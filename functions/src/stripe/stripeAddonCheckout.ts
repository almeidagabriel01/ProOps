/**
 * Stripe Add-on Checkout Cloud Function
 *
 * Creates a Stripe checkout session for add-on subscriptions.
 * Migrated from: src/app/api/stripe/addon-checkout/route.ts
 */

import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { getStripe, getPriceIdForAddon, getAppUrl } from "./stripeConfig";

const db = getFirestore();

interface AddonCheckoutRequest {
  userId: string;
  tenantId: string;
  addonType: string;
  userEmail?: string;
  origin?: string;
}

interface AddonCheckoutResponse {
  url?: string;
  error?: string;
}

export const stripeAddonCheckout = functions
  .region("southamerica-east1")
  .https.onCall(
    async (data: AddonCheckoutRequest): Promise<AddonCheckoutResponse> => {
      const { userId, tenantId, addonType, userEmail } = data || {};

      // Validate input
      if (!userId || !tenantId || !addonType) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "userId, tenantId and addonType are required"
        );
      }

      // Get the price ID for the selected add-on (always monthly)
      const priceId = getPriceIdForAddon(addonType);
      if (!priceId) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Invalid add-on type or price not configured"
        );
      }

      try {
        const stripe = getStripe();

        // Get user data
        const userRef = db.collection("users").doc(userId);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
          throw new functions.https.HttpsError("not-found", "User not found");
        }

        const userData = userSnap.data()!;
        let customerId = userData.stripeCustomerId;

        // Create customer if doesn't exist
        if (!customerId && userEmail) {
          const customer = await stripe.customers.create({
            email: userEmail,
            metadata: {
              userId: userId,
              tenantId: tenantId,
            },
          });
          customerId = customer.id;

          // Save customer ID to user
          await userRef.update({
            stripeCustomerId: customerId,
          });
        }

        const appUrl = data?.origin || getAppUrl();

        // Create checkout session for add-on subscription (always monthly)
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          customer_email: customerId ? undefined : userEmail,
          mode: "subscription",
          payment_method_types: ["card"],
          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],
          success_url: `${appUrl}/addon-success?session_id={CHECKOUT_SESSION_ID}&addon=${addonType}`,
          cancel_url: `${appUrl}/profile/addons?canceled=true`,
          metadata: {
            userId: userId,
            tenantId: tenantId,
            addonType: addonType,
            billingInterval: "monthly",
            type: "addon",
          },
          subscription_data: {
            metadata: {
              userId: userId,
              tenantId: tenantId,
              addonType: addonType,
              billingInterval: "monthly",
              type: "addon",
            },
          },
        });

        return { url: session.url || undefined };
      } catch (error) {
        console.error("Error creating addon checkout session:", error);
        throw new functions.https.HttpsError(
          "internal",
          "Failed to create checkout session"
        );
      }
    }
  );
