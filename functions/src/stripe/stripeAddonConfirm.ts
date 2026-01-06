/**
 * Stripe Add-on Confirm Cloud Function
 *
 * Confirms an add-on checkout session after successful payment.
 * Migrated from: src/app/api/stripe/addon-confirm/route.ts
 */

import {
  onCall,
  HttpsError,
  CallableRequest,
} from "firebase-functions/v2/https";
import { CORS_OPTIONS } from "../deploymentConfig";

import { FieldValue } from "firebase-admin/firestore";
import { db } from "../init";
import { getStripe } from "./stripeConfig";
import { AddonType } from "./stripeHelpers";

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

export const stripeAddonConfirm = onCall(
  CORS_OPTIONS,
  async (
    request: CallableRequest<AddonConfirmRequest>
  ): Promise<AddonConfirmResponse> => {
    const { data } = request;
    const { sessionId } = data || {};

    if (!sessionId) {
      throw new HttpsError("invalid-argument", "sessionId is required");
    }

    try {
      const stripe = getStripe();

      // Retrieve the checkout session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription"],
      });

      if (session.payment_status !== "paid") {
        throw new HttpsError("failed-precondition", "Payment not completed");
      }

      const metadata = session.metadata || {};

      // Verify this is an add-on checkout
      if (metadata.type !== "addon") {
        throw new HttpsError(
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
        throw new HttpsError(
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
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Failed to confirm addon checkout");
    }
  }
);
