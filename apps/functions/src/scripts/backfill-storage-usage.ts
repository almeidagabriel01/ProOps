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
 *   npx tsx src/scripts/backfill-storage-usage.ts --project=erp-softcode-prod            # so mostra
 *   npx tsx src/scripts/backfill-storage-usage.ts --project=erp-softcode-prod --apply    # grava
 *
 * `--project` e OBRIGATORIO e define o bucket E o Firestore juntos. A primeira
 * versao recebia so `--bucket`, e o Firestore vinha da credencial padrao da
 * maquina: rodando contra o bucket de producao, o script lia o plano e gravaria
 * o uso no Firestore de DEV. So foi pego porque as empresas de dev apareceram
 * na listagem de producao.
 *
 * Idempotente: grava o total ABSOLUTO lido do bucket, entao rodar de novo
 * corrige qualquer desvio em vez de somar.
 */
import { getApps, initializeApp } from "firebase-admin/app";
import {
  STORAGE_USAGE_COLLECTION,
  bytesToMb,
  isOverStorageQuota,
  tenantForCountedPath,
} from "../shared/storage-usage";

const PAGE_SIZE = 1000;

function argValue(name: string): string | undefined {
  const arg = process.argv.find((value) => value.startsWith(`--${name}=`));
  return arg?.slice(name.length + 3).trim() || undefined;
}

async function main(): Promise<void> {
  const projectId = argValue("project");
  if (!projectId) {
    throw new Error("Informe --project=<id do projeto Firebase> (ex.: erp-softcode-prod).");
  }
  const bucketName = argValue("bucket") ?? `${projectId}.firebasestorage.app`;
  if (!bucketName.startsWith(`${projectId}.`)) {
    throw new Error(`O bucket ${bucketName} nao pertence ao projeto ${projectId}.`);
  }
  const apply = process.argv.includes("--apply");

  // O app tem que nascer com o projeto ANTES de qualquer import que toque
  // `../init`: ele reaproveita o primeiro app existente, e sem isto criaria um
  // com o projeto padrao da credencial local.
  if (getApps().length > 0) throw new Error("App do Firebase ja inicializado antes do script.");
  initializeApp({ projectId, storageBucket: bucketName });

  const { getStorage } = await import("firebase-admin/storage");
  const { FieldValue } = await import("firebase-admin/firestore");
  const { adminApp, db } = await import("../init");
  const { getTenantPlanProfile } = await import("../lib/tenant-plan-policy");

  const bucket = getStorage(adminApp).bucket(bucketName);
  console.log(
    `=== backfill-storage-usage (${apply ? "APPLY" : "dry-run"}) projeto=${projectId} bucket=${bucket.name} ===`,
  );

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
    const tenantExists = (await db.collection("tenants").doc(tenantId).get()).exists;
    const quotaMb = (await getTenantPlanProfile(tenantId)).limits.storageQuotaMB;
    const overQuota = isOverStorageQuota(storageBytes, quotaMb);
    console.log(
      `${tenantId}: ${bytesToMb(storageBytes).toFixed(1)} MB de ${quotaMb === -1 ? "ilimitado" : `${quotaMb} MB`}${overQuota ? "  ESTOURADO" : ""}${tenantExists ? "" : "  (empresa nao existe neste projeto)"}`,
    );
    // Arquivo que sobrou de empresa apagada: nao ha a quem atribuir o uso.
    if (!apply || !tenantExists) continue;
    await db.collection(STORAGE_USAGE_COLLECTION).doc(tenantId).set(
      { tenantId, storageBytes, overQuota, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }

  console.log(apply ? "=== gravado ===" : "=== dry-run: nada gravado (use --apply) ===");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
