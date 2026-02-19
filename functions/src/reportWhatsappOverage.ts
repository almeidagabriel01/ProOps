import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { getStripe } from "./stripe/stripeConfig"; // Assumes we can use the shared stripe instance
import { db } from "./init";

const WHATSAPP_OVERAGE_EVENT_NAME = "whatsapp_messages";

function getPreviousMonthKey(baseDate = new Date()): string {
  const d = new Date(
    Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const reportWhatsappOverage = onSchedule(
  {
    schedule: "0 3 1 * *", // 1st of every month at 03:00 AM
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1", // Or your preferred region
    memory: "256MiB",
    timeoutSeconds: 300,
  },
  async (event) => {
    console.log("[Cron] Starting reportWhatsappOverage job execution");

    try {
      const month = getPreviousMonthKey();
      console.log(`[Cron] Processing overage for month: ${month}`);

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
          const stripeEvent = await stripe.billing.meterEvents.create({
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
              stripeEventId: stripeEvent.identifier,
              stripeReportedAt: admin.firestore.FieldValue.serverTimestamp(),
              stripeReportIdempotencyKey: idempotencyKey,
              stripeSubscriptionId: tenantData?.stripeSubscriptionId || null,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          );

          charged += 1;
          console.log(
            `[Cron] Charged tenant ${tenantId} for ${overageMessages} overage messages`,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          console.error(`[Cron] Error processing tenant ${tenantId}:`, error);
          errors.push({ tenantId, message });
        }
      }

      console.log(
        `[Cron] Report completed. Processed: ${processed}, Charged: ${charged}, Skipped: ${skipped}, Errors: ${errors.length}`,
      );

      if (errors.length > 0) {
        console.error(
          "[Cron] Errors encountered:",
          JSON.stringify(errors, null, 2),
        );
      }
    } catch (error) {
      console.error(
        "[Cron] whatsapp overage report failed to run globally",
        error,
      );
    }
  },
);
