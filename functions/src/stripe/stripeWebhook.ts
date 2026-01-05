import * as functions from "firebase-functions";
import { getStripe, getWebhookSecret } from "./stripeConfig";
import {
  updateUserPlan,
  saveAddon,
  cancelAddon,
  getPlanIdByTier,
  updateSubscriptionStatus,
  AddonType,
} from "./stripeHelpers";
import { db } from "../init";
import Stripe from "stripe";

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const subscriptionId = session.subscription as string;
  const metadata = session.metadata || {};

  console.log("=== CHECKOUT COMPLETED ===");
  console.log("Session ID:", session.id);
  console.log("Subscription ID:", subscriptionId);
  console.log("Metadata:", JSON.stringify(metadata, null, 2));

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

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const metadata = subscription.metadata || {};
  if (metadata.type === "addon") {
    console.log(
      `Add-on subscription ${subscription.id} updated ` +
        `for tenant ${metadata.tenantId}`
    );
    return;
  }

  const userId = metadata.userId;
  const planTier = metadata.planTier;
  const interval = subscription.items.data[0]?.price.recurring?.interval;

  if (userId) {
    let status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "INACTIVE";
    switch (subscription.status) {
      case "active":
        status = "ACTIVE";
        break;
      case "trialing":
        status = "TRIALING";
        break;
      case "past_due":
        status = "PAST_DUE";
        break;
      case "canceled":
      case "unpaid":
        status = "CANCELED";
        break;
      default:
        status = "INACTIVE";
    }

    await updateSubscriptionStatus(userId, status);
    console.log(`User ${userId} subscription status synced to ${status}`);

    if (planTier) {
      await updateUserPlan(userId, planTier, subscription.id, interval);
    }
  }
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const customerId = invoice.customer as string;
  const subscriptionId = invoice.subscription as string;

  console.log(`Invoice payment failed for customer ${customerId}`);

  if (subscriptionId) {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const userId = subscription.metadata?.userId;

    if (userId) {
      await updateSubscriptionStatus(
        userId,
        "PAYMENT_FAILED",
        `Invoice ${invoice.id} payment failed`
      );
      console.log(`User ${userId} marked as PAYMENT_FAILED`);
    }
  }
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const metadata = subscription.metadata || {};

  if (metadata.type === "addon") {
    const tenantId = metadata.tenantId;
    const addonType = metadata.addonType as AddonType;

    if (tenantId && addonType) {
      await cancelAddon(tenantId, addonType);
    }
    return;
  }

  const userId = metadata.userId;

  if (userId) {
    await updateSubscriptionStatus(userId, "CANCELED");
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

        case "invoice.payment_failed":
          await handleInvoicePaymentFailed(
            event.data.object as Stripe.Invoice
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
