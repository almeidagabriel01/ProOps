import { onSchedule } from "firebase-functions/v2/scheduler";
import { SCHEDULE_OPTIONS } from "./deploymentConfig";
import { runServiceContracts } from "./api/services/field-service/contract-billing-run";

/**
 * Contratos de manutenção: mensalidade lançada dez dias antes do vencimento e
 * visita preventiva aberta uma semana antes, todo dia às 06:00. Idempotente:
 * rodar duas vezes no mesmo dia não cobra nem abre OS em dobro. A lógica está
 * em `runServiceContracts`, compartilhada com `POST /internal/cron/service-contracts`.
 */
export const processServiceContracts = onSchedule(
  {
    ...SCHEDULE_OPTIONS,
    schedule: "0 6 * * *",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    await runServiceContracts({ dryRun: false, cursorId: "processServiceContracts" });
  },
);
