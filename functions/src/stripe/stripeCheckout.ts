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

      let userData: FirebaseFirestore.DocumentData;
      let customerId: string | undefined;
      let existingSubscriptionId: string | undefined;

      if (!userSnap.exists) {
        // User document doesn't exist - create a basic one
        // This can happen if auth account exists but Firestore doc was never created
        console.log(
          `User document not found for ${userId}, creating basic document`
        );

        const newUserData = {
          email: userEmail || "",
          role: "free",
          createdAt: new Date().toISOString(),
          tenantId: `tenant_${userId}`,
        };

        await userRef.set(newUserData);
        userData = newUserData;
        customerId = undefined;
        existingSubscriptionId = undefined;
      } else {
        userData = userSnap.data()!;
        customerId = userData.stripeCustomerId;
        existingSubscriptionId = userData.stripeSubscriptionId;
      }

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
              // Parallel: Update Stripe Subscription & Fetch Plan ID
              const [, planId] = await Promise.all([
                stripe.subscriptions.update(existingSubscriptionId, {
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
                }),
                getPlanIdByTier(planTier),
              ]);

              // Update user's plan in Firestore
              if (planId) {
                await userRef.update({
                  planId: planId,
                  billingInterval: validInterval,
                  planUpdatedAt: new Date().toISOString(),
                  "subscription.status": "ACTIVE",
                  "subscription.updatedAt": new Date().toISOString(),
                });
              }

              return {
                success: true,
                message: "Subscription updated successfully",
              };
            }
          }
        } catch (subError) {
          console.log(
            "Error updating subscription, proceeding to checkout",
            subError
          );
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
      // Detailed error logging for debugging
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      const stripeError = (
        error as { type?: string; code?: string; param?: string }
      )?.type;

      console.error("Error creating checkout session:", {
        message: errorMessage,
        stack: errorStack,
        stripeErrorType: stripeError,
        userId,
        planTier,
        hasUserEmail: !!userEmail,
        billingInterval: validInterval,
      });

      throw new functions.https.HttpsError(
        "internal",
        `Failed to create checkout session: ${errorMessage}`
      );
    }
  });
