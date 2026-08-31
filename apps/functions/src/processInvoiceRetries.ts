import { onSchedule } from "firebase-functions/v2/scheduler";
import { SCHEDULE_OPTIONS } from "./deploymentConfig";
import { logger } from "./lib/logger";
import { pollPendingInvoices } from "./api/services/fiscal/invoice.service";

/**
 * Polls the fiscal provider for documents whose outcome never arrived.
 *
 * This is not redundancy with the webhook — it is the only backstop. Focus NFe
 * retries a failed notification at 1min, 30min, 1h, 3h and 24h and then never
 * fires that event again. A delivery outage spanning that window would strand
 * an authorized invoice in `processing` forever, with the client holding a
 * valid fiscal document the ERP does not know about.
 *
 * Runs every 15 minutes: authorization usually settles in seconds to a few
 * minutes, so a shorter interval mostly buys extra provider calls (each one
 * counts against the monthly package) without settling anything sooner.
 */
export const processInvoiceRetries = onSchedule(
  {
    ...SCHEDULE_OPTIONS,
    schedule: "every 15 minutes",
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async () => {
    try {
      const settled = await pollPendingInvoices();
      logger.info("Consulta de notas pendentes concluida", { settled });
    } catch (error) {
      logger.error("Falha na consulta de notas pendentes", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
);
