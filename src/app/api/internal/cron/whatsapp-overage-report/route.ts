import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const WHATSAPP_OVERAGE_EVENT_NAME = "whatsapp_messages";

function getPreviousMonthKey(baseDate = new Date()): string {
  const d = new Date(
    Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(secretKey, {
    apiVersion: "2024-11-20.acacia" as Stripe.LatestApiVersion,
    typescript: true,
  });
}

export async function POST(req: NextRequest) {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    const headerSecret = req.headers.get("X-Cron-Secret");
    if (!expectedSecret || headerSecret !== expectedSecret) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { month?: string };
    const monthFromQuery = req.nextUrl.searchParams.get("month");
    const month = String(body.month || monthFromQuery || getPreviousMonthKey()).trim();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { message: "Invalid month format. Expected YYYY-MM." },
        { status: 400 },
      );
    }

    const db = getAdminFirestore();
    const stripe = getStripeClient();
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

        const stripeCustomerId = String(tenantData?.stripeCustomerId || "").trim();
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
            stripeReportedAt: FieldValue.serverTimestamp(),
            stripeReportIdempotencyKey: idempotencyKey,
            stripeSubscriptionId: tenantData?.stripeSubscriptionId || null,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        charged += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        errors.push({ tenantId, message });
      }
    }

    return NextResponse.json({
      month,
      processed,
      charged,
      skipped,
      errors,
    });
  } catch (error) {
    console.error("[Cron] whatsapp overage report failed", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
