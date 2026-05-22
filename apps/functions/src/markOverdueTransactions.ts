import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./init";
import { SCHEDULE_OPTIONS } from "./deploymentConfig";
import { logger } from "./lib/logger";

const BATCH_SIZE = 400;

/**
 * Cron diário 00:05 BRT: marca lançamentos pendentes cujo dueDate já passou
 * como `overdue`. A derivação on-read em transactions.controller cobre a
 * janela entre dueDate vencer e o cron rodar — esta função apenas persiste
 * o estado para que relatórios e queries por status retornem dados corretos.
 *
 * Multi-tenant: a query é global (Admin SDK) e processa todos os tenants —
 * não precisa filtrar por tenantId pois cada transação carrega o seu.
 *
 * Status overdue não afeta wallet balance (lançamento continua não-pago).
 */
export const markOverdueTransactions = onSchedule(
  {
    ...SCHEDULE_OPTIONS,
    schedule: "5 0 * * *",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10); // YYYY-MM-DD
    const nowIso = new Date().toISOString();

    let totalUpdated = 0;
    let batchesCommitted = 0;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

    try {
      while (true) {
        let query = db
          .collection("transactions")
          .where("status", "==", "pending")
          .where("dueDate", "<", todayStr)
          .orderBy("dueDate")
          .limit(BATCH_SIZE);

        if (lastDoc) query = query.startAfter(lastDoc);

        const snap = await query.get();
        if (snap.empty) break;

        const batch = db.batch();
        snap.docs.forEach((doc) => {
          batch.update(doc.ref, {
            status: "overdue",
            updatedAt: nowIso,
            autoOverdueAt: nowIso,
          });
        });
        await batch.commit();
        batchesCommitted += 1;
        totalUpdated += snap.size;
        lastDoc = snap.docs[snap.docs.length - 1];

        if (snap.size < BATCH_SIZE) break;
      }

      logger.info("markOverdueTransactions complete", {
        totalUpdated,
        batchesCommitted,
        todayStr,
      });
    } catch (err) {
      logger.error("markOverdueTransactions failed", {
        totalUpdated,
        batchesCommitted,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },
);

/**
 * Same logic, callable from the manual debug endpoint. Returns metrics so
 * the operator can verify the run.
 */
export async function runMarkOverdueTransactions(): Promise<{
  totalUpdated: number;
  batchesCommitted: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  let totalUpdated = 0;
  let batchesCommitted = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  while (true) {
    let query = db
      .collection("transactions")
      .where("status", "==", "pending")
      .where("dueDate", "<", todayStr)
      .orderBy("dueDate")
      .limit(BATCH_SIZE);

    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: "overdue",
        updatedAt: nowIso,
        autoOverdueAt: nowIso,
      });
    });
    await batch.commit();
    batchesCommitted += 1;
    totalUpdated += snap.size;
    lastDoc = snap.docs[snap.docs.length - 1];

    if (snap.size < BATCH_SIZE) break;
  }

  return { totalUpdated, batchesCommitted };
}
