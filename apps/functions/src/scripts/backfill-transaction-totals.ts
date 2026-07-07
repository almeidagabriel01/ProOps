/**
 * One-shot backfill: computa e grava `paidTotal`/`pendingTotal` em todos os
 * documentos de `transactions` que ainda não os têm (ou têm valores
 * divergentes). Docs novos são mantidos pelo trigger onTransactionTotals —
 * este script cobre o histórico anterior ao deploy do trigger.
 *
 * Run manually (apontando para o projeto desejado via GOOGLE_APPLICATION_CREDENTIALS
 * ou emulador):
 *   cd apps/functions
 *   npx tsx src/scripts/backfill-transaction-totals.ts
 *
 * Idempotente — safe to re-run: pula docs cujos totais já batem.
 * Ordem de rollout: deploy do trigger → rodar este script → trocar o
 * frontend para o endpoint de summary (aggregation ignora docs sem o campo,
 * então o summary só fica exato após o backfill completar).
 */
import { db } from "../init";
import {
  computeTransactionTotals,
  storedTotalsDiffer,
} from "../lib/transaction-totals";

const PAGE_SIZE = 300; // < limite de 500 ops por batch

async function main(): Promise<void> {
  console.log("=== backfill-transaction-totals: starting ===");

  let processed = 0;
  let updated = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  for (;;) {
    let query = db
      .collection("transactions")
      .orderBy("__name__")
      .limit(PAGE_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if (snap.empty) break;

    const batch = db.batch();
    let batchWrites = 0;

    for (const doc of snap.docs) {
      processed += 1;
      const data = doc.data() as Record<string, unknown>;
      const computed = computeTransactionTotals(data);
      if (storedTotalsDiffer(data, computed)) {
        batch.update(doc.ref, {
          paidTotal: computed.paidTotal,
          pendingTotal: computed.pendingTotal,
        });
        batchWrites += 1;
      }
    }

    if (batchWrites > 0) {
      await batch.commit();
      updated += batchWrites;
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    console.log(`processed=${processed} updated=${updated}`);

    if (snap.size < PAGE_SIZE) break;
  }

  console.log(
    `=== backfill-transaction-totals: done — processed=${processed}, updated=${updated} ===`,
  );
}

main().catch((err) => {
  console.error("backfill-transaction-totals failed:", err);
  process.exitCode = 1;
});
