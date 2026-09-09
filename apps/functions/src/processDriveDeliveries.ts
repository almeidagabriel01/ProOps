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
 * A cada 3 MINUTOS. O piso do Cloud Scheduler e 1 minuto, e a diferenca de custo
 * nao esta na fatura: uma varredura de fila vazia ainda e cobrada como UMA
 * leitura do Firestore, entao de minuto em minuto sao 1.440 leituras por dia
 * contra 480 aqui. O baseline medido deste projeto e de ~1.666 leituras/dia
 * (mediana), ou seja, o cron de 1 minuto quase DOBRAVA o consumo diario e
 * deslocava a linha de base do alerta de leituras.
 *
 * Em troca, o PDF chega na pasta do cliente em ate 3 minutos em vez de 1.
 * Ninguem observa a pasta do Drive em tempo real, entao a troca e barata.
 *
 * Os recursos NAO sao os do padrao de cron:
 *
 * - `cpu: 1` porque aqui roda Chromium. `SCHEDULE_OPTIONS` traz 0,25 em
 *   producao e 0,083 em dev, calibrados para cron que so le Firestore; com esse
 *   teto o render arrastaria ate estourar o timeout.
 * - `concurrency: 1` para nao existirem dois ciclos varrendo a fila ao mesmo
 *   tempo. Um lote cheio pode passar de 3 minutos, e duas execucoes simultaneas
 *   pegariam o mesmo job pendente e renderizariam o mesmo PDF duas vezes. (O
 *   upload em si e idempotente pela marca `proposalId` no arquivo, entao o pior
 *   caso seria desperdicio, nao arquivo duplicado.)
 * - `memory: 1GiB`, o mesmo da funcao `pdf`.
 */
export const processDriveDeliveries = onSchedule(
  {
    ...SCHEDULE_OPTIONS,
    schedule: "every 3 minutes",
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
