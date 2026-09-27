/**
 * One-shot: grava o nicho nas empresas que não têm um válido.
 *
 * O nicho é escolhido no cadastro e nunca muda: nem a empresa, nem o superadmin
 * trocam (rules e API recusam). Empresas antigas podem estar sem o campo, ou
 * com um texto que não é nicho, e o sistema inteiro já as tratava como
 * automação residencial. Este script só torna isso explícito, para a trava de
 * imutabilidade não impedir de gravar o nicho pela primeira vez.
 *
 * Rodar ANTES do deploy das rules que travam o nicho, em dev e em prod:
 *   cd apps/functions
 *   npx tsx src/scripts/backfill-tenant-niche.ts           # dry-run
 *   npx tsx src/scripts/backfill-tenant-niche.ts --apply
 *
 * Idempotente: empresa com nicho válido é pulada.
 */
import { isTenantNiche, type TenantNicheId } from "../shared/niches";

const PAGE_SIZE = 300;
export const FALLBACK_NICHE: TenantNicheId = "automacao_residencial";

/** O que gravar numa empresa, ou `null` quando o nicho dela já é válido. */
export function nicheBackfillUpdate(data: Record<string, unknown>): { niche: TenantNicheId } | null {
  return isTenantNiche(data.niche) ? null : { niche: FALLBACK_NICHE };
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { db } = await import("../init");
  console.log(`--- backfill-tenant-niche (${apply ? "APLICANDO" : "dry-run"}) ---`);

  let processed = 0;
  let toUpdate = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  for (;;) {
    let query = db.collection("tenants").orderBy("__name__").limit(PAGE_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snap = await query.get();
    if (snap.empty) break;

    const batch = db.batch();
    let writes = 0;
    for (const doc of snap.docs) {
      processed += 1;
      const update = nicheBackfillUpdate(doc.data());
      if (!update) continue;
      toUpdate += 1;
      console.log(`${doc.id}: nicho ${JSON.stringify(doc.data().niche ?? null)} -> ${update.niche}`);
      if (apply) {
        batch.update(doc.ref, update);
        writes += 1;
      }
    }
    if (writes > 0) await batch.commit();
    if (snap.size < PAGE_SIZE) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }

  console.log(`processadas=${processed} ${apply ? "atualizadas" : "a atualizar"}=${toUpdate}`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("backfill-tenant-niche falhou:", err);
      process.exit(1);
    });
}
