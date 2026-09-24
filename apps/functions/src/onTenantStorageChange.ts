import {
  onObjectDeleted,
  onObjectFinalized,
  type StorageEvent,
} from "firebase-functions/v2/storage";
import { logger } from "./lib/logger";
import { applyStorageDelta } from "./lib/tenant-storage-usage";
import { tenantForCountedPath } from "./shared/storage-usage";

/**
 * Mantem `tenant_storage_usage/{tenantId}` a cada arquivo que entra ou sai do
 * bucket. Os uploads vao do navegador direto ao Storage, entao este e o unico
 * lugar do backend que ve todos eles.
 *
 * Sobrescrever um arquivo no mesmo caminho dispara os DOIS eventos (o bucket
 * nao e versionado: a versao antiga e apagada), e a conta fecha sozinha.
 *
 * Erro relanca: o Eventarc reentrega, e o id do evento ja registrado impede a
 * contagem dupla.
 */

const TRIGGER_OPTIONS = { memory: "512MiB" as const };

async function handle(event: StorageEvent, sign: 1 | -1): Promise<void> {
  const tenantId = tenantForCountedPath(event.data.name);
  if (!tenantId) return;

  const size = Number(event.data.size) || 0;
  try {
    await applyStorageDelta({ tenantId, deltaBytes: sign * size, eventId: event.id });
  } catch (error) {
    logger.error("storage_usage_update_failed", {
      tenantId,
      sign,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export const onTenantStorageFinalized = onObjectFinalized(TRIGGER_OPTIONS, (event) =>
  handle(event, 1),
);

export const onTenantStorageDeleted = onObjectDeleted(TRIGGER_OPTIONS, (event) =>
  handle(event, -1),
);
