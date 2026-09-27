/**
 * One-shot backfill da central de notificações: grava `recipientUids` e
 * `readBy` nas notificações criadas antes dela.
 *
 * Desde a central, cada pessoa lê só o que foi endereçado a ela, e as rules
 * negam o documento sem `recipientUids`. Sem este backfill, o sino de todo
 * mundo começa vazio no dia do deploy. Os destinatários saem da mesma regra da
 * criação (`resolveTenantRecipients`: catálogo + permissões + preferências), e
 * quem estava como lida para a empresa fica lida para todos os destinatários.
 *
 * Notificações do superadmin (`tenantId: "system"`) ficam como estão: ele lê
 * pela visão da empresa, que não usa destinatários.
 *
 * Run manually (dry-run por padrão):
 *   cd apps/functions
 *   npx tsx src/scripts/backfill-notification-recipients.ts
 *   npx tsx src/scripts/backfill-notification-recipients.ts --apply
 *
 * Idempotente: doc que já tem `recipientUids` é pulado.
 */
import { db } from "../init";
import { resolveTenantRecipients } from "../api/services/notification-audience";
import { isNotificationType } from "../shared/notification-catalog";

const PAGE_SIZE = 300;
const APPLY = process.argv.includes("--apply");

async function main(): Promise<void> {
  console.log(`--- backfill-notification-recipients (${APPLY ? "APLICANDO" : "dry-run"}) ---`);

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  for (;;) {
    let query = db.collection("notifications").orderBy("__name__").limit(PAGE_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if (snap.empty) break;

    const batch = db.batch();
    let batchWrites = 0;

    for (const doc of snap.docs) {
      processed += 1;
      const data = doc.data();
      const tenantId = typeof data.tenantId === "string" ? data.tenantId : "";
      if (Array.isArray(data.recipientUids) || !tenantId || tenantId === "system") {
        skipped += 1;
        continue;
      }
      // Tipo fora do catálogo (legado) vai para quem vê propostas, como o sino
      // tratava: o link padrão é o da proposta.
      const type = isNotificationType(data.type) ? data.type : "proposal_viewed";
      const { recipientUids } = await resolveTenantRecipients(tenantId, type);
      const readBy = data.isRead === true ? recipientUids : [];

      if (APPLY) {
        batch.update(doc.ref, { recipientUids, readBy });
        batchWrites += 1;
      }
      updated += 1;
    }

    if (batchWrites > 0) await batch.commit();
    if (snap.size < PAGE_SIZE) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }

  console.log(
    `processados=${processed} ${APPLY ? "atualizados" : "a atualizar"}=${updated} pulados=${skipped}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
