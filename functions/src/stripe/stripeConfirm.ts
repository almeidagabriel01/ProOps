/**
 * Stripe Confirm Cloud Function
 *
 * Confirms a checkout session after successful payment.
 * Migrated from: src/app/api/stripe/confirm/route.ts
 */

import * as functions from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../init";
import { getStripe } from "./stripeConfig";
import { getPlanIdByTier } from "./stripeHelpers";

// Default plans for seeding if not found
const DEFAULT_PLANS = [
  {
    tier: "starter",
    name: "Starter",
    price: 49,
    pricing: { monthly: 49, yearly: 490 },
    order: 1,
    features: {
      maxProposals: 30,
      maxClients: 30,
      maxProducts: 50,
      maxUsers: 2,
      hasFinancial: false,
      canCustomizeTheme: false,
      maxPdfTemplates: 1,
      canEditPdfSections: false,
      maxImagesPerProduct: 2,
      maxStorageMB: 200,
    },
  },
  {
    tier: "pro",
    name: "Pro",
    price: 99,
    pricing: { monthly: 99, yearly: 990 },
    order: 2,
    features: {
      maxProposals: 80,
      maxClients: 100,
      maxProducts: 200,
      maxUsers: 5,
      hasFinancial: true,
      canCustomizeTheme: true,
      maxPdfTemplates: 3,
      canEditPdfSections: false,
      maxImagesPerProduct: 5,
      maxStorageMB: 500,
    },
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    price: 199,
    pricing: { monthly: 199, yearly: 1990 },
    order: 3,
    features: {
      maxProposals: -1, // unlimited
      maxClients: -1,
      maxProducts: -1,
      maxUsers: -1,
      hasFinancial: true,
      canCustomizeTheme: true,
      maxPdfTemplates: -1,
      canEditPdfSections: true,
      maxImagesPerProduct: 10,
      maxStorageMB: 2000,
    },
  },
];

async function getOrCreatePlanId(tier: string): Promise<string | null> {
  // First try to find existing plan
  const planId = await getPlanIdByTier(tier);
  if (planId) return planId;

  // If not found, seed from defaults
  const defaultPlan = DEFAULT_PLANS.find((p) => p.tier === tier);
  if (defaultPlan) {
    try {
      const docRef = await db.collection("plans").add(defaultPlan);
      console.log(`Seeded missing plan: ${tier} (${docRef.id})`);
      return docRef.id;
    } catch (error) {
      console.error(`Error seeding plan ${tier}:`, error);
      return null;
    }
  }

  return null;
}

interface ConfirmRequest {
  sessionId: string;
}

interface ConfirmResponse {
  success: boolean;
  planId?: string;
  planTier?: string;
  error?: string;
}

export const stripeConfirm = functions
  .region("southamerica-east1")
  .https.onCall(async (data: ConfirmRequest): Promise<ConfirmResponse> => {
    const { sessionId } = data || {};

    if (!sessionId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "sessionId is required"
      );
    }

    try {
      const stripe = getStripe();

      // Retrieve the checkout session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription"],
      });

      if (session.payment_status !== "paid") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Payment not completed"
        );
      }

      const userId = session.metadata?.userId;
      const planTier = session.metadata?.planTier;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      if (!userId || !planTier) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Missing metadata in session"
        );
      }

      // Get or create plan ID
      const planId = await getOrCreatePlanId(planTier);

      if (!planId) {
        throw new functions.https.HttpsError("not-found", "Plan not found");
      }

      // Determine billing interval
      let billingInterval = session.metadata?.billingInterval;
      if (
        !billingInterval &&
        session.subscription &&
        typeof session.subscription !== "string"
      ) {
        const price = session.subscription.items.data[0]?.price;
        billingInterval =
          price?.recurring?.interval === "year" ? "yearly" : "monthly";
      }

      // Update user in Firestore
      const userRef = db.collection("users").doc(userId);
      await userRef.update({
        planId: planId,
        stripeSubscriptionId: subscriptionId || null,
        planUpdatedAt: FieldValue.serverTimestamp(),
        role: "admin",
        billingInterval: billingInterval || "monthly",
      });

      console.log(
        `Confirmed checkout for user ${userId}, upgraded to ${planTier} (${planId})`
      );

      return {
        success: true,
        planId: planId,
        planTier: planTier,
      };
    } catch (error) {
      console.error("Error confirming checkout:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        "internal",
        "Failed to confirm checkout"
      );
    }
  });
