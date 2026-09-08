/**
 * Fila de entrega da proposta no Google Drive.
 *
 * A entrega renderiza o PDF com Chromium e sobe o arquivo. Feita dentro da
 * request de salvar a proposta, ela colocava dezenas de segundos na frente do
 * usuario — e como o middleware de timeout responde 408 mas **deixa o handler
 * correndo**, o desfecho era o pior possivel: a proposta era salva e a tela
 * mostrava erro.
 *
 * Aqui o salvamento so grava um documento de trabalho (uma escrita pequena) e
 * responde. Um cron entrega depois. Ninguem fica olhando a pasta do Drive em
 * tempo real, entao minutos de latencia nao custam nada; o que nao pode e
 * perder a entrega, e por isso o trabalho vira DOCUMENTO em vez de promessa
 * solta: no Cloud Run a CPU e congelada quando a request termina, entao um
 * dispare-e-esqueca sumiria em silencio.
 *
 * Mesmo desenho de `payout_attempts` e `wallet_cascade_jobs`, que ja existem no
 * projeto. Cloud Tasks (roadmap 4.2) seria o passo seguinte; nao entrou porque
 * exige fila provisionada e o suporte no emulador e instavel, o que tiraria a
 * possibilidade de testar o fluxo localmente.
 */

import { Timestamp } from "firebase-admin/firestore";
import { db } from "../../../init";
import { logger } from "../../../lib/logger";
import { syncProposalToDrive } from "./proposal-drive-sync.service";

export const DRIVE_DELIVERY_JOBS_COLLECTION = "drive_delivery_jobs";

/** Depois disso o job para de tentar e fica registrado para investigacao. */
export const MAX_DRIVE_DELIVERY_ATTEMPTS = 5;

/** Backoff: 1min, 5min, 15min, 60min. */
const RETRY_DELAYS_MS = [60_000, 300_000, 900_000, 3_600_000];

/**
 * `skipped` e terminal e NAO e falha: o tenant nao conectou o Drive, ou a
 * proposta nao tem cliente. Retentar isso ate esgotar as tentativas gastaria
 * ciclos para produzir sempre o mesmo nada.
 */
export type DriveDeliveryJobStatus =
  | "pending"
  | "delivered"
  | "skipped"
  | "failed";

export type DriveDeliveryJob = {
  tenantId: string;
  proposalId: string;
  status: DriveDeliveryJobStatus;
  attempts: number;
  /** ISO. O cron busca `nextRunAt <= agora`, no padrao de payout_attempts. */
  nextRunAt: string;
  lastError?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
};

/**
 * Um job por proposta, com id deterministico.
 *
 * Salvar a mesma proposta cinco vezes seguidas nao pode virar cinco renders do
 * mesmo PDF: o `set` com merge apenas reabre o job que ja existe e zera o
 * contador de tentativas, porque houve mudanca nova a entregar.
 */
export function buildDriveDeliveryJobId(
  tenantId: string,
  proposalId: string,
): string {
  return `${tenantId}_${proposalId}`;
}

export async function enqueueDriveDelivery(params: {
  tenantId: string;
  proposalId: string;
}): Promise<void> {
  const { tenantId, proposalId } = params;
  if (!tenantId || !proposalId) return;

  const jobId = buildDriveDeliveryJobId(tenantId, proposalId);
  const now = Timestamp.now();

  await db
    .collection(DRIVE_DELIVERY_JOBS_COLLECTION)
    .doc(jobId)
    .set(
      {
        tenantId,
        proposalId,
        status: "pending",
        attempts: 0,
        // Vencido de saida: a proxima passagem do cron ja pega.
        nextRunAt: new Date().toISOString(),
        lastError: null,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
}

function resolveNextRunAt(attempts: number): string {
  const delay =
    RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)];
  return new Date(Date.now() + delay).toISOString();
}

/**
 * Processa um job. Nunca lanca: uma proposta que falha nao pode derrubar o
 * lote inteiro.
 */
export async function runDriveDeliveryJob(jobId: string): Promise<void> {
  const ref = db.collection(DRIVE_DELIVERY_JOBS_COLLECTION).doc(jobId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const job = snap.data() as DriveDeliveryJob;
  if (job.status !== "pending") return;

  const proposalSnap = await db
    .collection("proposals")
    .doc(job.proposalId)
    .get();

  if (!proposalSnap.exists) {
    // Proposta apagada entre o enfileiramento e a entrega. Nao e erro.
    await ref.update({
      status: "failed",
      lastError: "PROPOSAL_NOT_FOUND",
      updatedAt: Timestamp.now(),
    });
    return;
  }

  const attempts = Number(job.attempts || 0) + 1;

  // `syncProposalToDrive` nao lanca: ela DEVOLVE o desfecho. Tratar "nao
  // lancou" como sucesso marcava como entregue o que tinha falhado, e o retry
  // desta fila nunca disparava.
  let resultado: Awaited<ReturnType<typeof syncProposalToDrive>>;
  try {
    resultado = await syncProposalToDrive({
      tenantId: job.tenantId,
      proposalId: job.proposalId,
      proposalData: proposalSnap.data() as Record<string, unknown>,
    });
  } catch (error) {
    // Falha de infraestrutura antes de a funcao poder classificar o desfecho.
    resultado = {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (resultado.status === "delivered") {
    await ref.update({
      status: "delivered",
      attempts,
      lastError: null,
      updatedAt: Timestamp.now(),
    });
    return;
  }

  if (resultado.status === "skipped") {
    await ref.update({
      status: "skipped",
      attempts,
      lastError: resultado.reason,
      updatedAt: Timestamp.now(),
    });
    logger.info("drive_delivery_job_skipped", {
      tenantId: job.tenantId,
      proposalId: job.proposalId,
      reason: resultado.reason,
    });
    return;
  }

  const esgotou = attempts >= MAX_DRIVE_DELIVERY_ATTEMPTS;

  await ref.update({
    status: esgotou ? "failed" : "pending",
    attempts,
    nextRunAt: esgotou ? job.nextRunAt : resolveNextRunAt(attempts),
    lastError: resultado.error,
    updatedAt: Timestamp.now(),
  });

  logger.error("drive_delivery_job_failed", {
    tenantId: job.tenantId,
    proposalId: job.proposalId,
    attempts,
    esgotou,
    error: resultado.error,
  });
}

/**
 * Varre os jobs vencidos. Devolve quantos processou, para o log do cron.
 *
 * O lote e pequeno de proposito: cada entrega renderiza um PDF, e um lote que
 * nao caiba nos 540s do cron seria cortado no meio. Com cadencia de um minuto,
 * 20 por ciclo dao vazao de sobra.
 */
export async function processDriveDeliveryQueue(
  limit = 20,
): Promise<{ processed: number }> {
  const snap = await db
    .collection(DRIVE_DELIVERY_JOBS_COLLECTION)
    .where("status", "==", "pending")
    .where("nextRunAt", "<=", new Date().toISOString())
    .orderBy("nextRunAt", "asc")
    .limit(limit)
    .get();

  for (const doc of snap.docs) {
    await runDriveDeliveryJob(doc.id).catch((error) => {
      logger.error("drive_delivery_queue_error", {
        jobId: doc.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  return { processed: snap.size };
}
