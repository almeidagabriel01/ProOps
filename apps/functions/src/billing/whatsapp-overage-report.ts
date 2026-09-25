import { FieldValue, Timestamp } from "firebase-admin/firestore";

/**
 * Reporte mensal do excedente de WhatsApp ao Stripe (cobrança real).
 *
 * Usado pelo cron `reportWhatsappOverage` e pelo endpoint manual
 * `POST /internal/cron/whatsapp-overage-report`, que antes duplicavam a lógica.
 *
 * Duas garantias:
 *
 * 1. **Todo tenant é alcançado.** Antes, um laço serial sem cursor contra 300s:
 *    com ~1000 tenants a execução morria no meio e os demais NUNCA eram
 *    cobrados (o cron só roda uma vez por mês). Agora é paginado, com
 *    concorrência limitada, e o cron roda nos dias 1 a 3 para pegar quem
 *    ficou de fora de uma execução interrompida.
 *
 * 2. **Nunca cobrar duas vezes.** O Stripe deduplica o `identifier` do meter
 *    event só dentro de 24h. Se a cobrança passasse e a marca `stripeReported`
 *    não fosse gravada, uma nova execução dias depois cobraria de novo. Por
 *    isso a tentativa é RESERVADA (`stripeReportClaimedAt`) antes de chamar o
 *    Stripe: reserva sem confirmação só é repetida dentro de
 *    `SAFE_RETRY_WINDOW_MS`; depois disso o tenant vai para revisão manual.
 */

export const WHATSAPP_OVERAGE_EVENT_NAME = "whatsapp_messages";
export const SAFE_RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;
const TENANT_PAGE_SIZE = 200;
const CONCURRENCY = 8;

type StripeLike = {
  billing: {
    meterEvents: {
      create: (params: {
        event_name: string;
        identifier: string;
        payload: Record<string, string>;
      }) => Promise<{ identifier: string }>;
    };
  };
};

export type OverageReportResult = {
  month: string;
  processed: number;
  charged: number;
  skipped: number;
  needsManualReview: string[];
  errors: Array<{ tenantId: string; message: string }>;
};

export function getPreviousMonthKey(baseDate = new Date()): string {
  const d = new Date(
    Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

type ClaimOutcome = "claimed" | "skip" | "manual_review" | "missing_customer";

export async function runWhatsappOverageReport(params: {
  db: FirebaseFirestore.Firestore;
  stripe: StripeLike;
  month: string;
  nowMs?: number;
}): Promise<OverageReportResult> {
  const { db, stripe, month } = params;
  const nowMs = params.nowMs ?? Date.now();
  const result: OverageReportResult = {
    month,
    processed: 0,
    charged: 0,
    skipped: 0,
    needsManualReview: [],
    errors: [],
  };

  const processTenant = async (tenantDoc: FirebaseFirestore.QueryDocumentSnapshot) => {
    result.processed += 1;
    const tenantId = tenantDoc.id;
    const tenantData = tenantDoc.data() as {
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
    };

    try {
      // Antes da reserva: sem cliente no Stripe não há tentativa possível, e
      // reservar mandaria o tenant para revisão manual sem motivo.
      const stripeCustomerId = String(tenantData?.stripeCustomerId || "").trim();
      const usageRef = db
        .collection("whatsappUsage")
        .doc(tenantId)
        .collection("months")
        .doc(month);

      let overageMessages = 0;
      const outcome = await db.runTransaction<ClaimOutcome>(async (t) => {
        const usageSnap = await t.get(usageRef);
        if (!usageSnap.exists) return "skip";
        const usage = usageSnap.data() as {
          overageMessages?: number;
          stripeReported?: boolean;
          stripeReportClaimedAt?: Timestamp;
        };
        overageMessages = Number(usage.overageMessages || 0);
        if (overageMessages <= 0 || usage.stripeReported === true) return "skip";
        if (!stripeCustomerId) return "missing_customer";

        const claimedAt = usage.stripeReportClaimedAt;
        if (claimedAt && typeof claimedAt.toMillis === "function") {
          // Tentativa anterior sem confirmação: repetir só enquanto o Stripe
          // ainda deduplica o identifier; depois, revisão manual.
          return nowMs - claimedAt.toMillis() < SAFE_RETRY_WINDOW_MS
            ? "claimed"
            : "manual_review";
        }
        t.set(
          usageRef,
          { stripeReportClaimedAt: Timestamp.fromMillis(nowMs) },
          { merge: true },
        );
        return "claimed";
      });

      if (outcome === "skip") {
        result.skipped += 1;
        return;
      }
      if (outcome === "manual_review") {
        result.needsManualReview.push(tenantId);
        return;
      }
      if (outcome === "missing_customer") {
        result.errors.push({ tenantId, message: "Missing tenant.stripeCustomerId" });
        return;
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
          stripeReportedAt: FieldValue.serverTimestamp(),
          stripeReportIdempotencyKey: idempotencyKey,
          stripeSubscriptionId: tenantData?.stripeSubscriptionId || null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      result.charged += 1;
      console.log(
        `[WhatsAppOverage] Charged tenant ${tenantId} for ${overageMessages} overage messages`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[WhatsAppOverage] Error processing tenant ${tenantId}:`, error);
      result.errors.push({ tenantId, message });
    }
  };

  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  for (;;) {
    let query = db
      .collection("tenants")
      .where("whatsappEnabled", "==", true)
      .where("whatsappAllowOverage", "==", true)
      .orderBy("__name__")
      .limit(TENANT_PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) break;

    await mapWithConcurrency(page.docs, CONCURRENCY, processTenant);

    cursor = page.docs[page.docs.length - 1];
    if (page.size < TENANT_PAGE_SIZE) break;
  }

  console.log(
    `[WhatsAppOverage] ${month}: processed=${result.processed} charged=${result.charged} skipped=${result.skipped} manualReview=${result.needsManualReview.length} errors=${result.errors.length}`,
  );
  if (result.needsManualReview.length > 0) {
    console.error(
      "[WhatsAppOverage] Reserva sem confirmação há mais de 23h: conferir no Stripe antes de reportar",
      JSON.stringify(result.needsManualReview),
    );
  }
  if (result.errors.length > 0) {
    console.error("[WhatsAppOverage] Errors:", JSON.stringify(result.errors));
  }
  return result;
}
