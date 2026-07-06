/**
 * One-shot backfill: (a) grava o campo `grouped` em todos os docs de
 * `transactions` onde diverge; (b) computa e grava os doc-resumos em
 * `transaction_groups` para todos os grupos do histórico. Docs novos são
 * mantidos pelo trigger onTransactionTotals — este script cobre o histórico
 * anterior ao deploy do trigger estendido.
 *
 * Run manually (apontando para o projeto desejado via GOOGLE_APPLICATION_CREDENTIALS
 * ou emulador):
 *   cd apps/functions
 *   npx tsx src/scripts/backfill-transaction-groups.ts
 *
 * Idempotente — safe to re-run. Grupos legados mistos (parte dos membros com
 * proposalGroupId, parte só installmentGroupId) são promovidos à chave
 * proposal pelo recomputeGroup (mesma lógica do trigger — single source).
 * Ordem de rollout: índices READY → rules → functions → este backfill →
 * frontend.
 */
import { db } from "../init";
import { resolveGroupKey } from "../lib/transaction-group-summary";
import { recomputeGroup } from "../onTransactionTotals";

const PAGE_SIZE = 300; // < limite de 500 ops por batch

async function main(): Promise<void> {
  console.log("=== backfill-transaction-groups: starting ===");

  let processed = 0;
  let updatedGrouped = 0;
  const groups = new Map<string, { tenantId: string; groupKey: string }>();
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
      const groupKey = resolveGroupKey(data);
      const grouped = groupKey !== null;

      if (data.grouped !== grouped) {
        batch.update(doc.ref, { grouped });
        batchWrites += 1;
      }

      const tenantId =
        typeof data.tenantId === "string" && data.tenantId.length > 0
          ? data.tenantId
          : null;
      if (groupKey && tenantId) {
        groups.set(`${tenantId}|${groupKey}`, { tenantId, groupKey });
      } else if (groupKey && !tenantId) {
        console.warn(`doc ${doc.id} tem grupo mas não tem tenantId — pulado`);
      }
    }

    if (batchWrites > 0) {
      await batch.commit();
      updatedGrouped += batchWrites;
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    console.log(`processed=${processed} updatedGrouped=${updatedGrouped}`);

    if (snap.size < PAGE_SIZE) break;
  }

  console.log(`recomputing ${groups.size} groups...`);
  let groupsWritten = 0;
  for (const { tenantId, groupKey } of groups.values()) {
    await recomputeGroup(db, tenantId, groupKey);
    groupsWritten += 1;
    if (groupsWritten % 100 === 0) {
      console.log(`groupsWritten=${groupsWritten}/${groups.size}`);
    }
  }

  console.log(
    `=== backfill-transaction-groups: done — processed=${processed}, ` +
      `updatedGrouped=${updatedGrouped}, groupsWritten=${groupsWritten} ===`,
  );
}

main().catch((err) => {
  console.error("backfill-transaction-groups failed:", err);
  process.exitCode = 1;
});
