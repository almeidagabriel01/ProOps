/**
 * One-shot backfill: normaliza `stock` e `inventoryValue` em todos os docs de
 * `products` (stock = inventoryValue = número parseado, coalesce
 * inventoryValue > stock — mesma semântica de resolveInventoryValue do
 * frontend e do products.controller). Habilita o sort server-side
 * `orderBy("stock")` na listagem paginada (docs sem o campo sumiriam do
 * índice).
 *
 * Run manually:
 *   cd apps/functions
 *   npx tsx src/scripts/backfill-product-stock.ts
 *
 * Idempotente — safe to re-run.
 */
import { db } from "../init";

const PAGE_SIZE = 300;

function parseInventoryValue(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const normalized = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(normalized) ? normalized : 0;
  }
  return 0;
}

async function main(): Promise<void> {
  console.log("=== backfill-product-stock: starting ===");

  let processed = 0;
  let updated = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  for (;;) {
    let query = db.collection("products").orderBy("__name__").limit(PAGE_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if (snap.empty) break;

    const batch = db.batch();
    let batchWrites = 0;

    for (const doc of snap.docs) {
      processed += 1;
      const data = doc.data() as Record<string, unknown>;
      const normalized = parseInventoryValue(
        data.inventoryValue !== undefined && data.inventoryValue !== null
          ? data.inventoryValue
          : data.stock,
      );
      if (data.stock !== normalized || data.inventoryValue !== normalized) {
        batch.update(doc.ref, {
          stock: normalized,
          inventoryValue: normalized,
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
    `=== backfill-product-stock: done — processed=${processed}, updated=${updated} ===`,
  );
}

main().catch((err) => {
  console.error("backfill-product-stock failed:", err);
  process.exitCode = 1;
});
