/**
 * One-shot backfill das metas de vendas: grava `approvedAt` nas propostas que
 * já estavam aprovadas antes do campo existir.
 *
 * A meta soma o que foi aprovado no mês pela data da aprovação, que só passou
 * a ser gravada com as metas. Para as antigas não há como saber o dia exato,
 * então vale o dia da última alteração (`updatedAt`), como combinado com o
 * dono do produto. Sem este backfill, nenhuma venda anterior aparece em mês
 * nenhum.
 *
 * O vendedor NÃO é preenchido: proposta antiga fica sem vendedor e conta só na
 * meta da empresa.
 *
 * Run manually (dry-run por padrão):
 *   cd apps/functions
 *   npx tsx src/scripts/backfill-proposal-approved-at.ts
 *   npx tsx src/scripts/backfill-proposal-approved-at.ts --apply
 *
 * Idempotente: proposta com `approvedAt` é pulada.
 */
import { db } from "../init";
import { isStatusApproved } from "../api/controllers/proposals.controller";

const PAGE_SIZE = 300;
const APPLY = process.argv.includes("--apply");

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

async function main(): Promise<void> {
  console.log(`--- backfill-proposal-approved-at (${APPLY ? "APLICANDO" : "dry-run"}) ---`);

  const approvedCache = new Map<string, boolean>();
  let processed = 0;
  let updated = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  for (;;) {
    let query = db.collection("proposals").orderBy("__name__").limit(PAGE_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snap = await query.get();
    if (snap.empty) break;

    const batch = db.batch();
    let writes = 0;

    for (const doc of snap.docs) {
      processed += 1;
      const data = doc.data();
      if (data.approvedAt) continue;
      const key = `${data.tenantId}|${data.status}`;
      let approved = approvedCache.get(key);
      if (approved === undefined) {
        approved = await isStatusApproved(data.status as string | undefined, data.tenantId as string);
        approvedCache.set(key, approved);
      }
      if (!approved) continue;
      const approvedAt = toIso(data.updatedAt) ?? toIso(data.createdAt);
      if (!approvedAt) continue;
      if (APPLY) {
        batch.update(doc.ref, { approvedAt });
        writes += 1;
      }
      updated += 1;
    }

    if (writes > 0) await batch.commit();
    if (snap.size < PAGE_SIZE) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }

  console.log(`processadas=${processed} ${APPLY ? "atualizadas" : "a atualizar"}=${updated}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
