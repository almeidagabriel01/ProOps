/**
 * Stripe Preview Cloud Function
 *
 * Previews proration before plan change.
 * Migrated from: src/app/api/stripe/preview/route.ts
 */

import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { getStripe, getPriceIdForTier, BillingInterval } from "./stripeConfig";

const db = getFirestore();

interface PreviewRequest {
  userId: string;
  newPlanTier: string;
  billingInterval?: BillingInterval;
}

interface PlanPreview {
  tier: string;
  price: number;
  interval: string;
}

interface PaymentMethod {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

interface PreviewData {
  currentPlan: PlanPreview;
  newPlan: PlanPreview;
  amountDue: number;
  creditAmount: number;
  isUpgrade: boolean;
  isDowngrade: boolean;
  paymentMethod: PaymentMethod | null;
  nextBillingDate: string;
}

interface PreviewResponse {
  preview: PreviewData | null;
  message?: string;
  isNewSubscription?: boolean;
  error?: string;
}

export const stripePreview = functions
  .region("southamerica-east1")
  .https.onCall(
    async (data: PreviewRequest, context): Promise<PreviewResponse> => {
      const { userId, newPlanTier, billingInterval } = data || {};

      if (!userId || !newPlanTier) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "userId and newPlanTier are required"
        );
      }

      const targetInterval: BillingInterval =
        billingInterval === "yearly" ? "yearly" : "monthly";

      try {
        console.log("stripePreview called with:", {
          userId,
          newPlanTier,
          billingInterval,
        });

        const stripe = getStripe();
        console.log("Stripe instance created successfully");

        // Get user data
        const userRef = db.collection("users").doc(userId);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
          console.log("User not found:", userId);
          throw new functions.https.HttpsError("not-found", "User not found");
        }

        const userData = userSnap.data()!;
        console.log("User data retrieved:", {
          stripeCustomerId: userData.stripeCustomerId,
          stripeSubscriptionId: userData.stripeSubscriptionId,
          planId: userData.planId,
        });

        const subscriptionId = userData.stripeSubscriptionId;

        if (!userData.stripeCustomerId || !subscriptionId) {
          console.log("No subscription found, returning isNewSubscription");
          return {
            preview: null,
            message: "No active subscription found",
            isNewSubscription: true,
          };
        }

        // Get new price ID
        const newPriceId = getPriceIdForTier(newPlanTier, targetInterval);
        console.log("New price ID:", newPriceId);

        if (!newPriceId) {
          console.log("Invalid plan tier or interval:", {
            newPlanTier,
            targetInterval,
          });
          throw new functions.https.HttpsError(
            "invalid-argument",
            "Invalid plan tier or interval"
          );
        }

        // Get current subscription
        console.log("Retrieving subscription:", subscriptionId);
        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);
        const activeCustomerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;

        const subscriptionItemId = subscription.items.data[0]?.id;
        const currentPriceId = subscription.items.data[0]?.price?.id;

        if (!subscriptionItemId || !currentPriceId) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Subscription item not found"
          );
        }

        // Get proration preview
        const preview = await stripe.invoices.createPreview({
          customer: activeCustomerId,
          subscription: subscriptionId,
          subscription_details: {
            items: [
              {
                id: subscriptionItemId,
                price: newPriceId,
              },
            ],
            proration_behavior: "always_invoice",
          },
        });

        // Get current and new prices
        const [currentPrice, newPrice] = await Promise.all([
          stripe.prices.retrieve(currentPriceId),
          stripe.prices.retrieve(newPriceId),
        ]);

        // Get payment method
        let paymentMethod: PaymentMethod | null = null;
        if (subscription.default_payment_method) {
          const pm = await stripe.paymentMethods.retrieve(
            subscription.default_payment_method as string
          );
          if (pm.card) {
            paymentMethod = {
              brand: pm.card.brand,
              last4: pm.card.last4,
              expMonth: pm.card.exp_month,
              expYear: pm.card.exp_year,
            };
          }
        }

        // Calculate amounts
        const currentAmount = (currentPrice.unit_amount || 0) / 100;
        const newAmount = (newPrice.unit_amount || 0) / 100;

        let creditAmount = 0;
        for (const line of preview.lines.data) {
          if (line.amount < 0) {
            creditAmount += Math.abs(line.amount) / 100;
          }
        }

        // Determine current plan tier
        let currentPlanTier = "unknown";
        if (userData.planId) {
          const planRef = db.collection("plans").doc(userData.planId);
          const planSnap = await planRef.get();
          if (planSnap.exists) {
            const planData = planSnap.data()!;
            currentPlanTier = planData.tier || planData.name || "unknown";
          }
        }
        if (currentPlanTier === "unknown") {
          currentPlanTier = subscription.metadata?.planTier || "unknown";
        }

        return {
          preview: {
            currentPlan: {
              tier: currentPlanTier,
              price: currentAmount,
              interval:
                currentPrice.recurring?.interval === "year"
                  ? "yearly"
                  : "monthly",
            },
            newPlan: {
              tier: newPlanTier,
              price: newAmount,
              interval: targetInterval,
            },
            amountDue: preview.amount_due / 100,
            creditAmount,
            isUpgrade: newAmount > currentAmount,
            isDowngrade: newAmount < currentAmount,
            paymentMethod,
            nextBillingDate: new Date(
              preview.period_end * 1000
            ).toLocaleDateString("pt-BR"),
          },
        };
      } catch (error: unknown) {
        console.error("Error creating preview:", error);
        if (error instanceof functions.https.HttpsError) {
          throw error;
        }
        const errorMessage =
          error instanceof Error ? error.message : "Failed to create preview";
        throw new functions.https.HttpsError("internal", errorMessage);
      }
    }
  );
