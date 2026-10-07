/**
 * One-shot backfill: grava o `sellerId` (o vendedor da proposta) nos
 * lançamentos de proposta criados antes de o sync passar a copiá-lo. Sem ele,
 * quem tem o alcance "só os das minhas vendas" em Lançamentos não vê os
 * lançamentos das propostas antigas.
 *
 * Run manually (apontando para o projeto desejado via GOOGLE_APPLICATION_CREDENTIALS
 * ou emulador):
 *   cd apps/functions
 *   npx tsx src/scripts/backfill-transaction-seller.ts          # dry-run
 *   npx tsx src/scripts/backfill-transaction-seller.ts --apply  # grava
 *
 * Idempotente: pula lançamento cujo vendedor já bate (`expectedTransactionSeller`).
 * Ordem de rollout: índices → este script → backend e rules → front.
 */
import { db } from "../init";
import { expectedTransactionSeller } from "../lib/transaction-seller";

const PAGE_SIZE = 300; // < limite de 500 ops por batch
const APPLY = process.argv.includes("--apply");

async function main(): Promise<void> {
  console.log(`=== backfill-transaction-seller: starting (${APPLY ? "apply" : "dry-run"}) ===`);

  const sellerByProposal = new Map<string, string | null>();
  const sellerOf = async (proposalId: string): Promise<string | null> => {
    if (!sellerByProposal.has(proposalId)) {
      const snap = await db.collection("proposals").doc(proposalId).get();
      const seller = snap.exists ? (snap.data()?.sellerId as string | undefined) : undefined;
      sellerByProposal.set(proposalId, seller || null);
    }
    return sellerByProposal.get(proposalId) ?? null;
  };

  let processed = 0;
  let updated = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  for (;;) {
    let query = db.collection("transactions").orderBy("__name__").limit(PAGE_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snap = await query.get();
    if (snap.empty) break;

    const batch = db.batch();
    let batchWrites = 0;
    for (const doc of snap.docs) {
      processed += 1;
      const data = doc.data() as Record<string, unknown>;
      if (!data.proposalId) continue;
      const next = expectedTransactionSeller(data, await sellerOf(String(data.proposalId)));
      if (next === undefined) continue;
      batch.update(doc.ref, { sellerId: next });
      batchWrites += 1;
    }

    if (batchWrites > 0) {
      if (APPLY) await batch.commit();
      updated += batchWrites;
    }
    lastDoc = snap.docs[snap.docs.length - 1];
    console.log(`processed=${processed} ${APPLY ? "updated" : "would update"}=${updated}`);
    if (snap.size < PAGE_SIZE) break;
  }

  console.log(`=== backfill-transaction-seller: done, processed=${processed}, ${APPLY ? "updated" : "would update"}=${updated} ===`);
}

main().catch((err) => {
  console.error("backfill-transaction-seller failed:", err);
  process.exitCode = 1;
});
