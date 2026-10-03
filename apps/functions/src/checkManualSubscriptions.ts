import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./init";
import { SCHEDULE_OPTIONS } from "./deploymentConfig";
import { captureError } from "./lib/observability/error-logger";
import {
  MANUAL_GRACE_DAYS,
  addDays,
  manualPhase,
  pastDueSinceFor,
  periodEndDay,
  todayInBrazil,
} from "./lib/manual-subscription-phase";

/**
 * Batch que se divide sozinho: o Firestore aceita 500 escritas por batch, e
 * cada usuário expirado gera duas (user + espelho no tenant). Com mais de 250
 * expirações no mesmo dia o batch único falhava inteiro, e ninguém mudava de
 * status.
 */
export function createChunkedBatch(maxWrites = 400) {
  const batches: FirebaseFirestore.WriteBatch[] = [db.batch()];
  let writes = 0;
  const current = () => {
    if (writes >= maxWrites) {
      batches.push(db.batch());
      writes = 0;
    }
    writes += 1;
    return batches[batches.length - 1];
  };
  return {
    update(ref: FirebaseFirestore.DocumentReference, data: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>) {
      current().update(ref, data);
    },
    set(
      ref: FirebaseFirestore.DocumentReference,
      data: FirebaseFirestore.DocumentData,
      options: FirebaseFirestore.SetOptions,
    ) {
      current().set(ref, data, options);
    },
    async commit() {
      for (const batch of batches) await batch.commit();
    },
  };
}

/** Resolve the tenant id from a user doc (tenantId, legacy companyId fallback). */
function mirrorTenantId(userData: FirebaseFirestore.DocumentData): string | null {
  const raw = userData?.["tenantId"] ?? userData?.["companyId"];
  const tid = typeof raw === "string" ? raw.trim() : "";
  return tid || null;
}

/**
 * Ciclo do contrato manual (regra em `lib/manual-subscription-phase.ts`):
 * ativo até o fim do dia do vencimento, `past_due` com 7 dias de carência e
 * depois `canceled` + free.
 *
 * As consultas comparam com o dia de HOJE em Brasília (`YYYY-MM-DD`), o que
 * vale para os dois formatos gravados: `"2027-09-14"` e
 * `"2027-09-14T00:00:00.000Z"` só ficam menores que `"2027-09-15"`. Antes a
 * comparação era com o ISO de agora, e o contrato vencia na manhã do próprio
 * dia mostrado.
 *
 * O `pastDueSince` vai junto do `past_due`: o backend e o front contam a
 * carência a partir dele, e sem o campo tratavam o atraso como carência
 * vencida, bloqueando a empresa no primeiro dia em vez de no oitavo.
 */
export async function runManualSubscriptionCheck(now: Date = new Date()): Promise<{
  pastDue: number;
  canceled: number;
}> {
  const today = todayInBrazil(now);
  const nowIso = now.toISOString();

  // 1. Ativo -> past_due
  const activeSnapshot = await db
    .collection("users")
    .where("isManualSubscription", "==", true)
    .where("subscriptionStatus", "==", "active")
    .where("currentPeriodEnd", "<", today)
    .get();

  let pastDue = 0;
  if (!activeSnapshot.empty) {
    const batch = createChunkedBatch();
    activeSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const endDay = periodEndDay(data.currentPeriodEnd);
      if (!endDay || manualPhase(endDay, today) === "active") return;
      const pastDueSince = pastDueSinceFor(endDay);
      batch.update(doc.ref, { subscriptionStatus: "past_due", pastDueSince, updatedAt: nowIso });
      // Espelho no tenant: é o doc que o enforcement, o front e o painel leem.
      const tenantId = mirrorTenantId(data);
      if (tenantId) {
        batch.set(
          db.collection("tenants").doc(tenantId),
          { subscriptionStatus: "past_due", pastDueSince, updatedAt: nowIso },
          { merge: true },
        );
      }
      pastDue++;
    });
    await batch.commit();
  }

  // 2. past_due -> canceled + free, passados os dias de carência
  const pastDueSnapshot = await db
    .collection("users")
    .where("isManualSubscription", "==", true)
    .where("subscriptionStatus", "==", "past_due")
    .where("currentPeriodEnd", "<", addDays(today, -MANUAL_GRACE_DAYS))
    .get();

  let canceled = 0;
  if (!pastDueSnapshot.empty) {
    const batch = createChunkedBatch();
    pastDueSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const endDay = periodEndDay(data.currentPeriodEnd);
      if (!endDay || manualPhase(endDay, today) !== "canceled") return;
      batch.update(doc.ref, {
        subscriptionStatus: "canceled",
        planId: "free",
        pastDueSince: null,
        updatedAt: nowIso,
      });
      const tenantId = mirrorTenantId(data);
      if (tenantId) {
        batch.set(
          db.collection("tenants").doc(tenantId),
          { subscriptionStatus: "canceled", plan: "free", pastDueSince: null, updatedAt: nowIso },
          { merge: true },
        );
      }
      canceled++;
    });
    await batch.commit();
  }

  return { pastDue, canceled };
}

export const checkManualSubscriptions = onSchedule(
  {
    ...SCHEDULE_OPTIONS,
    schedule: "every 24 hours",
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async () => {
    try {
      const result = await runManualSubscriptionCheck();
      console.log(
        `Manual subscriptions: ${result.pastDue} to past_due, ${result.canceled} canceled.`,
      );
    } catch (error) {
      console.error("Error checking manual subscriptions:", error);
      void captureError(error, { source: "functions", route: "cron/checkManualSubscriptions", handled: false });
    }
  }
);
