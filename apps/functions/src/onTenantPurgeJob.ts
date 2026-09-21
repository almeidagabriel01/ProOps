import { onDocumentWritten } from "firebase-functions/v2/firestore";
import {
  deadlineFromTimeoutSeconds,
  processTenantPurgeJob,
  TENANT_PURGE_JOBS_COLLECTION,
} from "./api/services/tenant-purge.service";
import { logger } from "./lib/logger";

const FUNCTION_TIMEOUT_SECONDS = 540;

/**
 * Exclusao definitiva de empresa (ver `tenant-purge.service.ts`). Dispara em
 * todo write de `tenant_purge_jobs/{tenantId}` com status `pending`; quando o
 * processador devolve o job para `pending` com `continuationKick` incrementado,
 * o proprio update redispara este trigger e a exclusao continua de onde parou.
 * Sem job, nao roda nada: custo zero ocioso, ao contrario de um cron.
 */
export const onTenantPurgeJob = onDocumentWritten(
  {
    document: `${TENANT_PURGE_JOBS_COLLECTION}/{tenantId}`,
    timeoutSeconds: FUNCTION_TIMEOUT_SECONDS,
    memory: "512MiB",
  },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    if ((after.data() as { status?: string } | undefined)?.status !== "pending") return;

    const tenantId = event.params.tenantId;
    logger.info("tenant_purge_job trigger fired", { tenantId });
    try {
      await processTenantPurgeJob(tenantId, deadlineFromTimeoutSeconds(FUNCTION_TIMEOUT_SECONDS));
    } catch (err) {
      logger.error("tenant_purge_job failed", {
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },
);
