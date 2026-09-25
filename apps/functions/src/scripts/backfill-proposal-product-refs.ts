/**
 * One-shot backfill: grava `productRefs` e `productRefsIndexed` em todas as
 * propostas (ver lib/proposal-product-refs.ts). Até ele rodar num ambiente, a
 * checagem "produto em uso" da tela continua caindo no método antigo (baixa
 * todas as propostas do tenant) para qualquer tenant com proposta sem a marca.
 *
 * Não mexe em `updatedAt`: é índice derivado, não edição da proposta. Os dois
 * campos estão em PDF_IRRELEVANT_PROPOSAL_FIELDS, então o cache de PDF segue
 * válido.
 *
 * Run manually:
 *   cd apps/functions
 *   npx tsx src/scripts/backfill-proposal-product-refs.ts
 *
 * Idempotente — safe to re-run.
 */
import { db } from "../init";
import { buildProposalProductRefs } from "../lib/proposal-product-refs";

const PAGE_SIZE = 300;

function sameRefs(a: unknown, b: string[]): boolean {
  if (!Array.isArray(a) || a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

async function main(): Promise<void> {
  console.log("=== backfill-proposal-product-refs: starting ===");
  let processed = 0;
  let updated = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  for (;;) {
    let query = db.collection("proposals").orderBy("__name__").limit(PAGE_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snap = await query.get();
    if (snap.empty) break;

    const batch = db.batch();
    let batchWrites = 0;
    for (const doc of snap.docs) {
      processed += 1;
      const data = doc.data() as Record<string, unknown>;
      const refs = buildProposalProductRefs(data.products);
      if (data.productRefsIndexed === true && sameRefs(data.productRefs, refs)) continue;
      batch.update(doc.ref, { productRefs: refs, productRefsIndexed: true });
      batchWrites += 1;
    }
    if (batchWrites > 0) {
      await batch.commit();
      updated += batchWrites;
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    console.log(`proposals: processed=${processed} updated=${updated}`);
    if (snap.size < PAGE_SIZE) break;
  }

  console.log(`=== done — processed=${processed}, updated=${updated} ===`);
}

main().catch((err) => {
  console.error("backfill-proposal-product-refs failed:", err);
  process.exitCode = 1;
});
