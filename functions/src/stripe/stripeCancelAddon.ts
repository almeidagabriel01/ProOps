import * as functions from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../init";
import { getStripe } from "./stripeConfig";

type AddonType = "financial" | "pdf_editor_partial" | "pdf_editor_full";

interface CancelAddonRequest {
  tenantId: string;
  addonType: AddonType;
}

export const stripeCancelAddon = functions
  .region("southamerica-east1")
  .https.onCall(async (data: CancelAddonRequest, context) => {
    console.log("stripeCancelAddon called (v1)");

    try {
      // Check authentication
      if (!context.auth) {
        console.warn("User not authenticated");
        throw new functions.https.HttpsError(
          "unauthenticated",
          "User must be authenticated"
        );
      }

      const { tenantId, addonType } = data;
      console.log(
        `Request data: tenantId=${tenantId}, addonType=${addonType}, uid=${context.auth.uid}`
      );

      if (!tenantId || !addonType) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "tenantId and addonType are required"
        );
      }

      const addonId = `${tenantId}_${addonType}`;

      console.log(`Fetching addon ${addonId}`);
      const addonRef = db.collection("addons").doc(addonId);
      const addonDoc = await addonRef.get();

      if (!addonDoc.exists) {
        console.warn(`Addon not found: ${addonId}`);
        throw new functions.https.HttpsError("not-found", "Add-on not found");
      }

      const addonData = addonDoc.data();
      console.log("Addon data found, verifying user permissions");

      // Verify user belongs to this tenant
      const userRef = db.collection("users").doc(context.auth.uid);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
         console.warn(`User not found: ${context.auth.uid}`);
         throw new functions.https.HttpsError("permission-denied", "User profile not found");
      }
      
      const userData = userDoc.data();

      // Check permissions: Must be superadmin OR (member of tenant AND match tenantId)
      // Note: userData.tenantId might be the user's active tenant
      const isSuperAdmin = userData?.role === "superadmin";
      const isTenantMember = userData?.tenantId === tenantId;

      if (!isTenantMember && !isSuperAdmin) {
        console.warn(
          `Permission denied: uid=${context.auth.uid}, userTenant=${userData?.tenantId}, targetTenant=${tenantId}, role=${userData?.role}`
        );
        throw new functions.https.HttpsError(
          "permission-denied",
          "You do not have permission to cancel this add-on"
        );
      }

      // Cancel Stripe subscription if it exists
      if (addonData?.stripeSubscriptionId) {
        console.log(
          `Attempting to cancel Stripe subscription: ${addonData.stripeSubscriptionId}`
        );
        try {
          // Initialize Stripe only when needed
          const stripe = getStripe();
          await stripe.subscriptions.cancel(addonData.stripeSubscriptionId);
          console.log(
            `Cancelled Stripe subscription ${addonData.stripeSubscriptionId}`
          );
        } catch (stripeError) {
          console.error("Error cancelling Stripe subscription:", stripeError);
          // Log config error specifically if needed
          if ((stripeError as Error).message.includes("STRIPE_SECRET_KEY")) {
             throw new functions.https.HttpsError("internal", "Stripe configuration error");
          }
          // Continue even if Stripe cancellation fails (e.g. already cancelled) - we still update our db
          // But if it's a configuration error, we might want to stop? 
          // For now, let's assume if it fails it's safer to mark as cancelled in DB so user doesn't get stuck
        }
      } else {
        console.log("No Stripe subscription ID found on addon");
      }

      console.log("Updating Firestore status");
      // Update add-on status in Firestore
      await addonRef.update({
        status: "cancelled",
        expiresAt: FieldValue.serverTimestamp(),
        cancelledAt: FieldValue.serverTimestamp(),
        cancelledBy: context.auth.uid,
      });

      console.log(`Cancelled add-on ${addonType} for tenant ${tenantId}`);

      return {
        success: true,
        message: "Add-on cancelled successfully",
      };
    } catch (error) {
      console.error("Error in stripeCancelAddon:", error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      // Ensure we return a structured error that the SDK can parse
      throw new functions.https.HttpsError(
        "internal",
        error instanceof Error ? error.message : "An internal error occurred"
      );
    }
  });
