import { db } from "../init";
import { getStripe } from "../stripe/stripeConfig";
import * as admin from "firebase-admin";

/**
 * Report WhatsApp overage usage to Stripe
 * @param tenantId The tenant ID to report usage for
 * @param month The month in YYYY-MM format
 */
export async function reportWhatsAppOverage(
  tenantId: string,
  month: string,
): Promise<{ success: boolean; message: string; eventId?: string }> {
  try {
    console.log(
      `[reportWhatsAppOverage] Starting for tenant ${tenantId}, month ${month}`,
    );

    // 1. Get Tenant to find Stripe Customer ID
    // We need to check both "tenants" collection (if exists) or "companies"
    // Based on previous code, companies seems to be the one, or tenants.
    // Let's check where stripeId is usually stored.
    // In admin.controller.ts, createCheckoutSession uses req.user.stripeId.
    // But here we might be running as a cron or admin action.
    // We need to find the OWNER of the tenant to get the stripeId, OR the tenant itself has it.
    // admin.controller.ts: check checkManualSubscriptions.ts or similar if available,
    // but typically the subscription is attached to the User (Owner).

    // Let's try to find the user who is the master/owner of this tenant.
    // Or maybe the tenant doc has stripeSubscriptionId / stripeCustomerId?
    // In createCheckoutSession, it updates `users` collection.
    // So we need to find the user who owns this tenant.

    // Strategy: Look for the user with role 'MASTER' or 'admin' for this tenantId.
    const usersSnap = await db
      .collection("users")
      .where("tenantId", "==", tenantId)
      .where("role", "in", ["MASTER", "admin", "ADMIN", "master"])
      .limit(1)
      .get();

    if (usersSnap.empty) {
      console.error(
        `[reportWhatsAppOverage] No master user found for tenant ${tenantId}`,
      );
      return { success: false, message: "Master user not found for tenant" };
    }

    const userDoc = usersSnap.docs[0];
    const userData = userDoc.data();
    const stripeCustomerId = userData.stripeId;

    if (!stripeCustomerId) {
      console.error(
        `[reportWhatsAppOverage] No stripeId found for user ${userDoc.id} (tenant ${tenantId})`,
      );
      return { success: false, message: "Stripe Customer ID not found" };
    }

    // 2. Get Usage for the month
    const usageRef = db.doc(`whatsappUsage/${tenantId}/months/${month}`);
    const usageSnap = await usageRef.get();

    if (!usageSnap.exists) {
      console.log(`[reportWhatsAppOverage] No usage data found for ${month}`);
      return { success: false, message: "No usage data found" };
    }

    const usageData = usageSnap.data();
    const overageMessages = usageData?.overageMessages || 0;
    const stripeReported = usageData?.stripeReported || false;

    if (overageMessages <= 0) {
      console.log(
        `[reportWhatsAppOverage] No overage to report (${overageMessages})`,
      );
      return { success: true, message: "No overage to report" };
    }

    if (stripeReported) {
      console.log(`[reportWhatsAppOverage] Already reported for ${month}`);
      return { success: true, message: "Already reported" };
    }

    // 3. Report to Stripe
    const stripe = getStripe();
    const idempotencyKey = `${tenantId}-${month}-${overageMessages}`;

    console.log(
      `[reportWhatsAppOverage] Reporting ${overageMessages} messages for customer ${stripeCustomerId}`,
    );

    const event = await stripe.billing.meterEvents.create({
      event_name: "whatsapp_messages",
      payload: {
        value: String(overageMessages), // Stripe expects string for decimal-like values, but for validation simple count is fine.
        // Docs say: payload.value: The value of the event.
        stripe_customer_id: stripeCustomerId,
      },
      identifier: idempotencyKey, // unique identifier for idempotency
    });

    // 4. Update Firestore
    await usageRef.update({
      stripeReported: true,
      stripeEventId: event.identifier,
      reportedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
      `[reportWhatsAppOverage] Successfully reported. Event Identifier: ${event.identifier}`,
    );

    return {
      success: true,
      message: "Overage reported successfully",
      eventId: event.identifier,
    };
  } catch (error: any) {
    console.error(`[reportWhatsAppOverage] Error:`, error);
    return { success: false, message: error.message || "Unknown error" };
  }
}
