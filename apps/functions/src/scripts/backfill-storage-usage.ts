/**
 * Conta o armazenamento que ja existe no bucket e grava
 * `tenant_storage_usage/{tenantId}` (bytes + `overQuota`).
 *
 * Os gatilhos `onTenantStorageFinalized`/`onTenantStorageDeleted` mantem a
 * conta daqui para a frente; este script cobre o que foi enviado antes deles.
 * Rodar DEPOIS do deploy dos gatilhos: um arquivo que chegue entre o script e
 * o deploy ficaria de fora da conta.
 *
 *   cd apps/functions
 *   npx tsx src/scripts/backfill-storage-usage.ts            # so mostra
 *   npx tsx src/scripts/backfill-storage-usage.ts --apply    # grava
 *
 * Fora do Cloud Functions o app nao sabe o bucket padrao: passe
 * `--bucket=<projeto>.firebasestorage.app`.
 *
 * Aponta para o projeto de GOOGLE_APPLICATION_CREDENTIALS / gcloud ADC.
 * Idempotente: grava o total ABSOLUTO lido do bucket, entao rodar de novo
 * corrige qualquer desvio em vez de somar.
 */
import { getStorage } from "firebase-admin/storage";
import { FieldValue } from "firebase-admin/firestore";
import { adminApp, db } from "../init";
import { getTenantPlanProfile } from "../lib/tenant-plan-policy";
import {
  STORAGE_USAGE_COLLECTION,
  bytesToMb,
  isOverStorageQuota,
  tenantForCountedPath,
} from "../shared/storage-usage";

const PAGE_SIZE = 1000;

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const bucketArg = process.argv.find((arg) => arg.startsWith("--bucket="));
  const bucket = getStorage(adminApp).bucket(bucketArg?.slice("--bucket=".length) || undefined);
  console.log(`=== backfill-storage-usage (${apply ? "APPLY" : "dry-run"}) bucket=${bucket.name} ===`);

  const bytesByTenant = new Map<string, number>();
  let pageToken: string | undefined;
  let files = 0;

  do {
    const [page, next] = await bucket.getFiles({
      prefix: "tenants/",
      maxResults: PAGE_SIZE,
      autoPaginate: false,
      pageToken,
    });
    for (const file of page) {
      files += 1;
      const tenantId = tenantForCountedPath(file.name);
      if (!tenantId) continue;
      const size = Number(file.metadata.size) || 0;
      bytesByTenant.set(tenantId, (bytesByTenant.get(tenantId) ?? 0) + size);
    }
    pageToken = (next as { pageToken?: string } | undefined)?.pageToken;
  } while (pageToken);

  // Empresa com doc de uso e sem arquivo nenhum no bucket volta para zero.
  const existing = await db.collection(STORAGE_USAGE_COLLECTION).select().get();
  for (const doc of existing.docs) {
    if (!bytesByTenant.has(doc.id)) bytesByTenant.set(doc.id, 0);
  }

  console.log(`arquivos lidos: ${files}; empresas: ${bytesByTenant.size}`);

  for (const [tenantId, storageBytes] of bytesByTenant) {
    const quotaMb = (await getTenantPlanProfile(tenantId)).limits.storageQuotaMB;
    const overQuota = isOverStorageQuota(storageBytes, quotaMb);
    console.log(
      `${tenantId}: ${bytesToMb(storageBytes).toFixed(1)} MB de ${quotaMb === -1 ? "ilimitado" : `${quotaMb} MB`}${overQuota ? "  ESTOURADO" : ""}`,
    );
    if (!apply) continue;
    await db.collection(STORAGE_USAGE_COLLECTION).doc(tenantId).set(
      { tenantId, storageBytes, overQuota, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }

  console.log(apply ? "=== gravado ===" : "=== dry-run: nada gravado (use --apply) ===");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
