import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./init";
import { SCHEDULE_OPTIONS } from "./deploymentConfig";
import { NotificationService } from "./api/services/notification.service";

/**
 * Cloud Function scheduled que roda diariamente para verificar
 * transações e propostas próximas do vencimento e criar notificações de lembrete.
 */
export const checkDueDates = onSchedule(
  {
    ...SCHEDULE_OPTIONS,
    schedule: "every 24 hours",
    timeoutSeconds: 300,
  },
  async () => {
    console.log("Starting due date check...");

    const now = new Date();
    const today = now.toISOString().split("T")[0]; // YYYY-MM-DD

    // Data limite: hoje + 3 dias
    const limitDate = new Date(now);
    limitDate.setDate(limitDate.getDate() + 3);
    const limitDateStr = limitDate.toISOString().split("T")[0]; // YYYY-MM-DD

    let transactionReminders = 0;
    let proposalReminders = 0;

    try {
      // ================================================================
      // 1. TRANSAÇÕES PENDENTES — vencimento próximo ou vencido
      // ================================================================
      // Query: status == "pending" e dueDate <= hoje + 3 dias
      // Firestore não suporta <= em strings de forma confiável para datas,
      // então buscamos todas as pendentes e filtramos no código.
      const pendingTransactions = await db
        .collection("transactions")
        .where("status", "==", "pending")
        .get();

      for (const doc of pendingTransactions.docs) {
        const data = doc.data();
        const dueDate = data.dueDate as string | undefined;
        const tenantId = data.tenantId as string;

        if (!dueDate || !tenantId) continue;

        // Verificar se dueDate está dentro do intervalo (já venceu ou vence em até 3 dias)
        if (dueDate > limitDateStr) continue;

        // Verificar se já existe lembrete não-lido de hoje ou de dias anteriores
        const activeReminderIds = await NotificationService.findActiveReminders(
          tenantId,
          "transaction_due_reminder",
          doc.id,
          "transactionId",
        );

        // Se houver lembretes antigos não lidos, remova-os para evitar duplicação/acumulo
        if (activeReminderIds.length > 0) {
          for (const notificationId of activeReminderIds) {
            // isSuperAdmin = true para bypassar validações de tenant se necessário (embora aqui seja server-side)
            // Mas usamos deleteNotification que já lida com a docRef diretamente.
            // Para simplificar e garantir limpeza, deletamos.
            await NotificationService.deleteNotification(
              notificationId,
              tenantId,
              true,
            );
          }
        }

        // Determinar se já venceu ou está próximo
        const isOverdue = dueDate < today;
        const description = data.description || "Sem descrição";
        const amount = data.amount
          ? Number(data.amount).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })
          : "";

        const formattedDueDate = formatDateBR(dueDate);

        // Diferenciar parcelas de lançamentos avulsos
        const isInstallment = data.isInstallment === true;
        const installmentNumber = data.installmentNumber as number | undefined;
        const installmentCount = data.installmentCount as number | undefined;

        let title: string;
        let message: string;

        if (isInstallment && installmentNumber && installmentCount) {
          // Notificação específica para parcela
          const parcelaLabel = `Parcela ${installmentNumber}/${installmentCount}`;
          title = isOverdue
            ? `${parcelaLabel} vencida`
            : `${parcelaLabel} próxima do vencimento`;
          message = isOverdue
            ? `${parcelaLabel} de "${description}"${amount ? ` (${amount})` : ""} venceu em ${formattedDueDate}. Atualize o status.`
            : `${parcelaLabel} de "${description}"${amount ? ` (${amount})` : ""} vence em ${formattedDueDate}. Lembre-se de atualizar o status.`;
        } else {
          // Notificação para lançamento avulso (sem parcelas)
          title = isOverdue
            ? "Lançamento vencido"
            : "Lançamento próximo do vencimento";
          message = isOverdue
            ? `"${description}"${amount ? ` (${amount})` : ""} venceu em ${formattedDueDate}. Atualize o status.`
            : `"${description}"${amount ? ` (${amount})` : ""} vence em ${formattedDueDate}. Lembre-se de atualizar o status.`;
        }

        await NotificationService.createNotification({
          tenantId,
          type: "transaction_due_reminder",
          title,
          message,
          transactionId: doc.id,
        });

        transactionReminders++;
      }

      console.log(
        `Created ${transactionReminders} transaction due date reminders.`,
      );

      // ================================================================
      // 2. PROPOSTAS COM VALIDADE PRÓXIMA OU EXPIRADA
      // ================================================================
      const activeStatuses = ["draft", "in_progress", "sent"];

      for (const status of activeStatuses) {
        const proposalSnapshot = await db
          .collection("proposals")
          .where("status", "==", status)
          .get();

        for (const doc of proposalSnapshot.docs) {
          const data = doc.data();
          const validUntil = data.validUntil as string | undefined;
          const tenantId = data.tenantId as string;

          if (!validUntil || !tenantId) continue;

          // Verificar se validUntil está dentro do intervalo
          if (validUntil > limitDateStr) continue;

          // Verificar se já existe lembrete não-lido
          const activeReminderIds = await NotificationService.findActiveReminders(
            tenantId,
            "proposal_expiring",
            doc.id,
            "proposalId",
          );

          // Remover lembretes antigos para atualizar o texto/status (ex: vence amanhã -> vence hoje)
          if (activeReminderIds.length > 0) {
            for (const notificationId of activeReminderIds) {
              await NotificationService.deleteNotification(
                notificationId,
                tenantId,
                true,
              );
            }
          }

          const isExpired = validUntil < today;
          const title = data.title || "Sem título";
          const clientName = data.clientName || "";

          const formattedValidUntil = formatDateBR(validUntil);

          await NotificationService.createNotification({
            tenantId,
            type: "proposal_expiring",
            title: isExpired
              ? "Proposta com validade expirada"
              : "Proposta próxima da validade",
            message: isExpired
              ? `"${title}"${clientName ? ` (${clientName})` : ""} expirou em ${formattedValidUntil}. Verifique o status.`
              : `"${title}"${clientName ? ` (${clientName})` : ""} válida até ${formattedValidUntil}. Lembre-se de acompanhar.`,
            proposalId: doc.id,
          });

          proposalReminders++;
        }
      }

      console.log(
        `Created ${proposalReminders} proposal expiration reminders.`,
      );
      console.log(
        `Due date check complete. Total reminders: ${transactionReminders + proposalReminders}.`,
      );
    } catch (error) {
      console.error("Error checking due dates:", error);
    }
  },
);

/**
 * Formata data YYYY-MM-DD para DD/MM/YYYY
 */
function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}
