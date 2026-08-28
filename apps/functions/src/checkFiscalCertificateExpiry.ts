import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./init";
import { SCHEDULE_OPTIONS } from "./deploymentConfig";
import { logger } from "./lib/logger";
import { daysUntil } from "./api/services/fiscal/fiscal-settings.service";

/**
 * Avisa antes de o certificado digital A1 vencer.
 *
 * O A1 vale 12 meses e, quando vence, **para de emitir em silêncio**: as notas
 * simplesmente passam a ser rejeitadas por assinatura inválida, e o usuário só
 * descobre na primeira venda que não fatura. É o tipo de falha que o benchmark
 * mostrou nenhum ERP tratar bem, e é barata de resolver.
 *
 * Avisa em D-30, D-15, D-7 e D-1, e continua avisando depois de vencido — a
 * notificação usa ID determinístico por marco, então rodar o cron duas vezes no
 * mesmo dia não gera duplicata.
 */

/** Marcos de aviso, do mais distante ao mais próximo. */
const ALERT_DAYS = [30, 15, 7, 1];

export function resolveAlertMilestone(remainingDays: number): number | null {
  if (remainingDays < 0) {
    // Já vencido: aviso diário até resolverem.
    return -1;
  }
  // O primeiro marco que o prazo alcançou.
  return ALERT_DAYS.find((day) => remainingDays === day) ?? null;
}

function buildMessage(remainingDays: number): { title: string; message: string } {
  if (remainingDays < 0) {
    return {
      title: "Certificado digital vencido",
      message: `O certificado digital da sua empresa venceu há ${Math.abs(remainingDays)} dia(s). Nenhuma nota fiscal será emitida até a renovação.`,
    };
  }
  return {
    title: "Certificado digital vencendo",
    message: `O certificado digital da sua empresa vence em ${remainingDays} dia(s). Renove com a sua certificadora para não interromper a emissão de notas.`,
  };
}

export const checkFiscalCertificateExpiry = onSchedule(
  {
    ...SCHEDULE_OPTIONS,
    schedule: "every 24 hours",
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async () => {
    let notified = 0;

    try {
      const snap = await db.collection("fiscal_settings").limit(1000).get();

      for (const doc of snap.docs) {
        const data = doc.data() as {
          tenantId?: string;
          certificadoValidade?: string;
        };

        if (!data.certificadoValidade) continue;

        const remaining = daysUntil(data.certificadoValidade);
        if (Number.isNaN(remaining)) continue;

        const milestone = resolveAlertMilestone(remaining);
        if (milestone === null) continue;

        const tenantId = data.tenantId ?? doc.id;
        // ID determinístico: um aviso por marco (ou por dia, se já vencido),
        // então reexecutar o cron não empilha notificações.
        const suffix =
          milestone === -1 ? `expired_${new Date().toISOString().slice(0, 10)}` : `d${milestone}`;

        const { title, message } = buildMessage(remaining);

        // Escrita direta com ID estavel: NotificationService.createNotification
        // usa .add() e geraria uma notificacao nova a cada execucao.
        await db
          .collection("notifications")
          .doc(`fiscal_cert_${tenantId}_${suffix}`)
          .set(
            {
              tenantId,
              type: "system",
              title,
              message,
              isRead: false,
              createdAt: new Date().toISOString(),
            },
            { merge: true },
          );

        notified += 1;
      }

      logger.info("Verificacao de validade de certificado concluida", {
        analisados: snap.size,
        notificados: notified,
      });
    } catch (error) {
      logger.error("Falha na verificacao de validade de certificado", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
);
