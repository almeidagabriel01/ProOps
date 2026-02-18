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

    // 1. Resolve Stripe IDs from tenant first (source of truth), fallback to owner user.
    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    const tenantData = tenantSnap.data() as
      | {
          stripeCustomerId?: string;
          stripeSubscriptionId?: string;
        }
      | undefined;
    let stripeCustomerId = String(tenantData?.stripeCustomerId || "").trim();
    const stripeSubscriptionId = String(
      tenantData?.stripeSubscriptionId || "",
    ).trim();

    if (!stripeCustomerId) {
      const usersSnap = await db
        .collection("users")
        .where("tenantId", "==", tenantId)
        .where("role", "in", ["MASTER", "admin", "ADMIN", "master"])
        .limit(1)
        .get();

      if (!usersSnap.empty) {
        const userData = usersSnap.docs[0].data() as { stripeId?: string } | undefined;
        stripeCustomerId = String(userData?.stripeId || "").trim();
      }
    }

    if (!stripeCustomerId) {
      console.error(
        `[reportWhatsAppOverage] No stripeCustomerId found for tenant ${tenantId}`,
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
    const idempotencyKey = `${tenantId}:${month}:whatsapp_overage`;

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
      stripeReportedAt: admin.firestore.FieldValue.serverTimestamp(),
      stripeReportIdempotencyKey: idempotencyKey,
      stripeSubscriptionId: stripeSubscriptionId || null,
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
