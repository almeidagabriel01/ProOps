/**
 * Stripe Webhook Cloud Function
 *
 * Handles Stripe webhook events.
 * Migrated from: src/app/api/webhooks/stripe/route.ts
 *
 * IMPORTANT: Update the webhook URL in Stripe Dashboard after deployment.
 */

import * as functions from "firebase-functions";
import { getStripe, getWebhookSecret } from "./stripeConfig";
import {
  updateUserPlan,
  saveAddon,
  cancelAddon,
  getPlanIdByTier,
  AddonType,
} from "./stripeHelpers";
import { getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";

const db = getFirestore();

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const subscriptionId = session.subscription as string;
  const metadata = session.metadata || {};

  console.log("=== CHECKOUT COMPLETED ===");
  console.log("Session ID:", session.id);
  console.log("Subscription ID:", subscriptionId);
  console.log("Metadata:", JSON.stringify(metadata, null, 2));

  // Check if this is an add-on purchase
  if (metadata.type === "addon") {
    const tenantId = metadata.tenantId;
    const addonType = metadata.addonType as AddonType;

    console.log("=== PROCESSING ADDON ===");
    console.log("Tenant ID:", tenantId);
    console.log("Addon Type:", addonType);

    if (tenantId && addonType && subscriptionId) {
      await saveAddon(tenantId, addonType, subscriptionId);
      console.log("=== ADDON SAVED SUCCESSFULLY ===");
    } else {
      console.error("Missing add-on metadata:", {
        tenantId,
        addonType,
        subscriptionId,
      });
    }
    return;
  }

  console.log("=== PROCESSING PLAN (not addon) ===");

  // Handle plan checkout
  const userId = metadata.userId;
  const planTier = metadata.planTier;
  const billingInterval = metadata.billingInterval;

  if (userId && planTier && subscriptionId) {
    await updateUserPlan(
      userId,
      planTier,
      subscriptionId,
      billingInterval === "yearly" ? "year" : "month"
    );
  } else {
    console.error("Missing metadata in checkout session:", {
      userId,
      planTier,
      subscriptionId,
    });
  }
}

/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const metadata = subscription.metadata || {};

  // Add-on subscription updated
  if (metadata.type === "addon") {
    console.log(
      `Add-on subscription ${subscription.id} updated ` +
        `for tenant ${metadata.tenantId}`
    );
    return;
  }

  // Plan subscription updated
  const userId = metadata.userId;
  const planTier = metadata.planTier;
  const interval = subscription.items.data[0]?.price.recurring?.interval;

  if (userId && planTier) {
    await updateUserPlan(userId, planTier, subscription.id, interval);
  }
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const metadata = subscription.metadata || {};

  // Check if this is an add-on subscription
  if (metadata.type === "addon") {
    const tenantId = metadata.tenantId;
    const addonType = metadata.addonType as AddonType;

    if (tenantId && addonType) {
      await cancelAddon(tenantId, addonType);
    }
    return;
  }

  // Plan subscription deleted
  const userId = metadata.userId;

  if (userId) {
    // Downgrade to starter plan when subscription is canceled
    const starterPlanId = await getPlanIdByTier("starter");

    if (starterPlanId) {
      const userRef = db.collection("users").doc(userId);
      await userRef.update({
        planId: starterPlanId,
        stripeSubscriptionId: null,
        planUpdatedAt: new Date().toISOString(),
      });
      console.log(
        `User ${userId} subscription canceled, downgraded to starter`
      );
    }
  }
}

/**
 * Stripe Webhook Handler
 *
 * This is an HTTP function (not callable) to handle Stripe webhooks.
 */
export const stripeWebhook = functions
  .region("southamerica-east1")
  .https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const signature = req.headers["stripe-signature"];

    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    try {
      const stripe = getStripe();
      const webhookSecret = getWebhookSecret();

      // Get raw body for signature verification
      const rawBody = req.rawBody;

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          rawBody,
          signature,
          webhookSecret
        );
      } catch (err) {
        console.error("Webhook signature verification failed:", err);
        res.status(400).json({ error: "Invalid signature" });
        return;
      }

      // Handle the event
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutCompleted(
            event.data.object as Stripe.Checkout.Session
          );
          break;

        case "customer.subscription.updated":
          await handleSubscriptionUpdated(
            event.data.object as Stripe.Subscription
          );
          break;

        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(
            event.data.object as Stripe.Subscription
          );
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  });
