import { Request, Response } from "express";
import { getStripe } from "../../stripe/stripeConfig";
import { db } from "../../init";
import * as admin from "firebase-admin";

const WHATSAPP_OVERAGE_EVENT_NAME = "whatsapp_messages";

function getPreviousMonthKey(baseDate = new Date()): string {
  const d = new Date(
    Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const reportWhatsappOverageManual = async (
  req: Request,
  res: Response,
) => {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    const headerSecret = req.headers["x-cron-secret"];
    if (!expectedSecret || headerSecret !== expectedSecret) {
      return res.status(401).send("Unauthorized");
    }

    const body = req.body || {};
    const monthFromQuery = req.query.month;
    const month = String(
      body.month || monthFromQuery || getPreviousMonthKey(),
    ).trim();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res
        .status(400)
        .json({ message: "Invalid month format. Expected YYYY-MM." });
    }

    const stripe = getStripe();
    const tenantsSnap = await db
      .collection("tenants")
      .where("whatsappEnabled", "==", true)
      .where("whatsappAllowOverage", "==", true)
      .get();

    let processed = 0;
    let charged = 0;
    let skipped = 0;
    const errors: Array<{ tenantId: string; message: string }> = [];

    for (const tenantDoc of tenantsSnap.docs) {
      processed += 1;
      const tenantId = tenantDoc.id;
      const tenantData = tenantDoc.data() as {
        stripeCustomerId?: string;
        stripeSubscriptionId?: string;
      };

      try {
        const usageRef = db
          .collection("whatsappUsage")
          .doc(tenantId)
          .collection("months")
          .doc(month);
        const usageSnap = await usageRef.get();

        if (!usageSnap.exists) {
          skipped += 1;
          continue;
        }

        const usageData = usageSnap.data() as
          | { overageMessages?: number; stripeReported?: boolean }
          | undefined;
        const overageMessages = Number(usageData?.overageMessages || 0);
        const stripeReported = usageData?.stripeReported === true;

        if (overageMessages <= 0 || stripeReported) {
          skipped += 1;
          continue;
        }

        const stripeCustomerId = String(
          tenantData?.stripeCustomerId || "",
        ).trim();
        if (!stripeCustomerId) {
          errors.push({
            tenantId,
            message: "Missing tenant.stripeCustomerId",
          });
          continue;
        }

        const idempotencyKey = `${tenantId}:${month}:whatsapp_overage`;
        const event = await stripe.billing.meterEvents.create({
          event_name: WHATSAPP_OVERAGE_EVENT_NAME,
          identifier: idempotencyKey,
          payload: {
            value: String(overageMessages),
            stripe_customer_id: stripeCustomerId,
          },
        });

        await usageRef.set(
          {
            stripeReported: true,
            stripeEventId: event.identifier,
            stripeReportedAt: admin.firestore.FieldValue.serverTimestamp(),
            stripeReportIdempotencyKey: idempotencyKey,
            stripeSubscriptionId: tenantData?.stripeSubscriptionId || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        charged += 1;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        errors.push({ tenantId, message });
      }
    }

    return res.json({
      month,
      processed,
      charged,
      skipped,
      errors,
    });
  } catch (error) {
    console.error("[Cron api] whatsapp overage report failed", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
