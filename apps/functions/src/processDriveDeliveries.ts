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
 * A cada MINUTO, que e o piso do Cloud Scheduler. O custo de rodar de minuto em
 * minuto e desprezivel (a varredura de uma fila vazia e uma consulta so, e o
 * container escala a zero entre as execucoes), e em troca o PDF chega na pasta
 * do cliente quase junto da aprovacao, em vez de ate cinco minutos depois.
 *
 * Os recursos NAO sao os do padrao de cron:
 *
 * - `cpu: 1` porque aqui roda Chromium. `SCHEDULE_OPTIONS` traz 0,25 em
 *   producao e 0,083 em dev, calibrados para cron que so le Firestore; com esse
 *   teto o render arrastaria ate estourar o timeout.
 * - `concurrency: 1` para nao existirem dois ciclos varrendo a fila ao mesmo
 *   tempo. Com cadencia de um minuto e render que pode passar disso, duas
 *   execucoes simultaneas pegariam o mesmo job pendente e renderizariam o mesmo
 *   PDF duas vezes. (O upload em si e idempotente pela marca `proposalId` no
 *   arquivo, entao o pior caso seria desperdicio, nao arquivo duplicado.)
 * - `memory: 1GiB`, o mesmo da funcao `pdf`.
 */
export const processDriveDeliveries = onSchedule(
  {
    ...SCHEDULE_OPTIONS,
    schedule: "every 1 minutes",
    timeoutSeconds: 540,
    memory: "1GiB",
    cpu: 1,
    concurrency: 1,
  },
  async () => {
    const { processed } = await processDriveDeliveryQueue();
    if (processed > 0) {
      logger.info("processDriveDeliveries: done", { processed });
    }
  },
);
