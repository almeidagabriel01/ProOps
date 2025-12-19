/**
 * Stripe Add-on Confirm Cloud Function
 *
 * Confirms an add-on checkout session after successful payment.
 * Migrated from: src/app/api/stripe/addon-confirm/route.ts
 */

import * as functions from "firebase-functions";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStripe } from "./stripeConfig";
import { AddonType } from "./stripeHelpers";

const db = getFirestore();

interface AddonConfirmRequest {
  sessionId: string;
}

interface AddonConfirmResponse {
  success: boolean;
  addonId?: string;
  addonType?: string;
  tenantId?: string;
  error?: string;
}

export const stripeAddonConfirm = functions
  .region("southamerica-east1")
  .https.onCall(
    async (data: AddonConfirmRequest): Promise<AddonConfirmResponse> => {
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

        const metadata = session.metadata || {};

        // Verify this is an add-on checkout
        if (metadata.type !== "addon") {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "This session is not an add-on purchase"
          );
        }

        const tenantId = metadata.tenantId;
        const addonType = metadata.addonType as AddonType;
        const billingInterval =
          (metadata.billingInterval as "monthly" | "yearly") || "monthly";
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (!tenantId || !addonType) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Missing add-on metadata in session"
          );
        }

        // Save add-on to Firestore
        const addonId = `${tenantId}_${addonType}`;
        await db
          .collection("addons")
          .doc(addonId)
          .set({
            tenantId,
            addonType,
            stripeSubscriptionId: subscriptionId || null,
            billingInterval,
            status: "active",
            purchasedAt: FieldValue.serverTimestamp(),
          });

        console.log(
          `Confirmed add-on checkout: ${addonType} for tenant ${tenantId}`
        );

        return {
          success: true,
          addonId: addonId,
          addonType: addonType,
          tenantId: tenantId,
        };
      } catch (error) {
        console.error("Error confirming addon checkout:", error);
        if (error instanceof functions.https.HttpsError) {
          throw error;
        }
        throw new functions.https.HttpsError(
          "internal",
          "Failed to confirm addon checkout"
        );
      }
    }
  );
