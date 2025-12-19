/**
 * Stripe Checkout Cloud Function
 *
 * Creates a Stripe checkout session for plan subscriptions.
 * Migrated from: src/app/api/stripe/checkout/route.ts
 */

import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import {
  getStripe,
  getPriceIdForTier,
  BillingInterval,
  getAppUrl,
} from "./stripeConfig";
import { getPlanIdByTier } from "./stripeHelpers";

const db = getFirestore();

interface CheckoutRequest {
  userId: string;
  planTier: string;
  userEmail?: string;
  billingInterval?: BillingInterval;
}

interface CheckoutResponse {
  url?: string;
  success?: boolean;
  message?: string;
  error?: string;
}

export const stripeCheckout = functions
  .region("southamerica-east1")
  .https.onCall(async (data: CheckoutRequest): Promise<CheckoutResponse> => {
    const {
      userId,
      planTier,
      userEmail,
      billingInterval = "monthly",
    } = data || {};

    // Validate input
    if (!userId || !planTier) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "userId and planTier are required"
      );
    }

    // Validate billing interval
    const validInterval: BillingInterval =
      billingInterval === "yearly" ? "yearly" : "monthly";

    // Get the price ID for the selected plan and interval
    const priceId = getPriceIdForTier(planTier, validInterval);
    if (!priceId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid plan tier or price not configured"
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
      const existingSubscriptionId = userData.stripeSubscriptionId;

      // If user has existing subscription, update it with proration
      if (existingSubscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(
            existingSubscriptionId
          );

          // If subscription is active, update it with proration
          if (
            subscription.status === "active" ||
            subscription.status === "trialing"
          ) {
            const subscriptionItemId = subscription.items.data[0]?.id;

            if (subscriptionItemId) {
              // Update subscription with immediate billing
              await stripe.subscriptions.update(existingSubscriptionId, {
                items: [
                  {
                    id: subscriptionItemId,
                    price: priceId,
                  },
                ],
                proration_behavior: "always_invoice",
                billing_cycle_anchor: "now",
                payment_behavior: "error_if_incomplete",
                metadata: {
                  userId: userId,
                  planTier: planTier,
                  billingInterval: validInterval,
                },
              });

              // Update user's plan in Firestore
              const planId = await getPlanIdByTier(planTier);
              if (planId) {
                await userRef.update({
                  planId: planId,
                  billingInterval: validInterval,
                  planUpdatedAt: new Date().toISOString(),
                });
              }

              return {
                success: true,
                message: "Subscription updated successfully",
              };
            }
          }
        } catch (subError) {
          console.log("Error updating subscription, proceeding to checkout");
        }
      }

      // Create customer if doesn't exist
      if (!customerId && userEmail) {
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: {
            userId: userId,
          },
        });
        customerId = customer.id;

        // Save customer ID to user
        await userRef.update({
          stripeCustomerId: customerId,
        });
      }

      const appUrl = getAppUrl();

      // Create checkout session for new subscription
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
        success_url: `${appUrl}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/?canceled=true`,
        metadata: {
          userId: userId,
          planTier: planTier,
          billingInterval: validInterval,
        },
        subscription_data: {
          metadata: {
            userId: userId,
            planTier: planTier,
            billingInterval: validInterval,
          },
        },
      });

      return { url: session.url || undefined };
    } catch (error) {
      console.error("Error creating checkout session:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to create checkout session"
      );
    }
  });
