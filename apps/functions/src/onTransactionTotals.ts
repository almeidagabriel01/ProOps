import { onDocumentWritten } from "firebase-functions/v2/firestore";
import {
  computeTransactionTotals,
  storedTotalsDiffer,
} from "./lib/transaction-totals";
import { logger } from "./lib/logger";

/**
 * Mantém `paidTotal`/`pendingTotal` desnormalizados em transactions/{id}.
 *
 * Trigger em vez de mudança inline no transaction.service (~1800 linhas com
 * múltiplos caminhos de escrita) e nos demais escritores (proposals sync,
 * webhook Asaas, bot WhatsApp): cobre TODOS os writers presentes e futuros
 * sem tocá-los, e é auto-corretivo — qualquer write com totais divergentes é
 * consertado na sequência.
 *
 * Anti-loop: só escreve quando os totais armazenados divergem dos computados
 * (storedTotalsDiffer, epsilon de meio centavo). A própria escrita re-dispara
 * o trigger uma vez, que então não diverge e retorna sem escrever — converge
 * em 1 invocação extra.
 *
 * Consumidor: GET /v1/transactions/summary (aggregation sum sobre os campos).
 */
export const onTransactionTotals = onDocumentWritten(
  {
    document: "transactions/{transactionId}",
    memory: "512MiB",
    timeoutSeconds: 60,
  },
  async (event) => {
    const afterSnap = event.data?.after;
    if (!afterSnap?.exists) return; // delete — nada a manter

    const data = afterSnap.data() as Record<string, unknown>;
    const computed = computeTransactionTotals(data);

    if (!storedTotalsDiffer(data, computed)) return;

    try {
      await afterSnap.ref.update({
        paidTotal: computed.paidTotal,
        pendingTotal: computed.pendingTotal,
      });
    } catch (err) {
      // Doc pode ter sido deletado entre o evento e o update — não é erro.
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("NOT_FOUND") || message.includes("no entity")) {
        return;
      }
      logger.error("onTransactionTotals update failed", {
        transactionId: event.params.transactionId,
        error: message,
      });
      throw err; // re-lança para retry do trigger
    }
  },
);
