import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "../init";
import { logger } from "./logger";
import { getTenantPlanProfile } from "./tenant-plan-policy";
import {
  STORAGE_USAGE_COLLECTION,
  isOverStorageQuota,
} from "../shared/storage-usage";

/**
 * Uso de armazenamento por empresa: `tenant_storage_usage/{tenantId}` com
 * `storageBytes` e `overQuota`.
 *
 * Doc proprio, e nao um campo em `tenants/{id}`: aquele doc e escutado em tempo
 * real por toda aba aberta, e cada upload viraria um snapshot em cada tela.
 *
 * `overQuota` existe porque o upload vai do navegador direto ao Storage, sem
 * passar pelo backend. Quem barra e a `storage.rules`, que le esta flag
 * (`firestore.get`), e as rules nao conhecem plano. Por isso a flag e
 * recalculada em dois momentos: a cada arquivo que entra ou sai, e a cada troca
 * de plano (`syncTenantPlanBillingSnapshot`), senao quem faz upgrade continuaria
 * barrado ate apagar algum arquivo.
 */

/** Dias que o id de um evento fica guardado para descartar reentrega. */
const EVENT_DEDUP_TTL_DAYS = 7;

async function quotaMbFor(tenantId: string): Promise<number> {
  const profile = await getTenantPlanProfile(tenantId);
  return profile.limits.storageQuotaMB;
}

/**
 * Soma (ou subtrai) o tamanho de um arquivo. Eventos de Storage sao entregues
 * AO MENOS uma vez; o id do evento fica registrado na mesma transacao, e uma
 * reentrega vira no-op em vez de contar o arquivo duas vezes.
 */
export async function applyStorageDelta(input: {
  tenantId: string;
  deltaBytes: number;
  eventId: string;
}): Promise<void> {
  const { tenantId, deltaBytes, eventId } = input;
  if (!tenantId || !Number.isFinite(deltaBytes) || deltaBytes === 0) return;

  const quotaMb = await quotaMbFor(tenantId);
  const usageRef = db.collection(STORAGE_USAGE_COLLECTION).doc(tenantId);
  const eventRef = usageRef.collection("events").doc(eventId);

  await db.runTransaction(async (tx) => {
    const [usageSnap, eventSnap] = await Promise.all([tx.get(usageRef), tx.get(eventRef)]);
    if (eventSnap.exists) return;

    const current = Number(usageSnap.get("storageBytes")) || 0;
    const storageBytes = Math.max(0, current + deltaBytes);

    tx.set(
      usageRef,
      {
        tenantId,
        storageBytes,
        overQuota: isOverStorageQuota(storageBytes, quotaMb),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    tx.set(eventRef, {
      deltaBytes,
      expiresAt: Timestamp.fromMillis(Date.now() + EVENT_DEDUP_TTL_DAYS * 86_400_000),
    });
  });
}

/** Recalcula so a flag, contra o plano atual. Chamado na troca de plano. */
export async function refreshStorageQuotaFlag(tenantId: string): Promise<void> {
  const usageRef = db.collection(STORAGE_USAGE_COLLECTION).doc(tenantId);
  const snap = await usageRef.get();
  if (!snap.exists) return;

  const overQuota = isOverStorageQuota(
    Number(snap.get("storageBytes")) || 0,
    await quotaMbFor(tenantId),
  );
  if (snap.get("overQuota") === overQuota) return;

  await usageRef.update({ overQuota, updatedAt: FieldValue.serverTimestamp() });
  logger.info("storage_quota_flag_refreshed", { tenantId, overQuota });
}
