import { onSchedule } from "firebase-functions/v2/scheduler";
import { getStripe } from "./stripe/stripeConfig";
import { db } from "./init";
import { captureError } from "./lib/observability/error-logger";
import {
  getPreviousMonthKey,
  runWhatsappOverageReport,
} from "./billing/whatsapp-overage-report";

/**
 * Reporta ao Stripe o excedente de WhatsApp do mês anterior.
 *
 * Roda nos dias 1, 2 e 3: a execução é idempotente (tenant já reportado é
 * pulado, e reserva sem confirmação só é repetida dentro da janela de
 * deduplicação do Stripe), então os dias 2 e 3 só alcançam quem uma execução
 * interrompida deixou de fora. Lógica em billing/whatsapp-overage-report.ts.
 */
export const reportWhatsappOverage = onSchedule(
  {
    schedule: "0 3 1-3 * *",
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async () => {
    try {
      await runWhatsappOverageReport({
        db,
        stripe: getStripe(),
        month: getPreviousMonthKey(),
      });
    } catch (error) {
      console.error("[Cron] whatsapp overage report failed to run globally", error);
      void captureError(error, { source: "functions", route: "cron/reportWhatsappOverage", handled: false });
    }
  },
);
