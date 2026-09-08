import { onSchedule } from "firebase-functions/v2/scheduler";
import { SCHEDULE_OPTIONS } from "./deploymentConfig";
import { processDriveDeliveryQueue } from "./api/services/drive/drive-delivery-queue";
import { logger } from "./lib/logger";

/**
 * Entrega as propostas pendentes no Google Drive.
 *
 * Sai do caminho da request de proposito: renderizar o PDF com Chromium levava
 * dezenas de segundos na frente do usuario. Ver `drive-delivery-queue.ts`.
 *
 * `memory` e `timeoutSeconds` acima do padrao dos crons porque aqui roda
 * Chromium, nao so leitura de Firestore.
 */
export const processDriveDeliveries = onSchedule(
  {
    ...SCHEDULE_OPTIONS,
    schedule: "every 5 minutes",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async () => {
    const { processed } = await processDriveDeliveryQueue();
    logger.info("processDriveDeliveries: done", { processed });
  },
);
