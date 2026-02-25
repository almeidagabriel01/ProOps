import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./init";
import { SCHEDULE_OPTIONS } from "./deploymentConfig";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

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
      // Compound query: status == "pending" AND dueDate <= limitDateStr
      // Requires composite index (status ASC, dueDate ASC) in firestore.indexes.json
      const pendingTransactions = await db
        .collection("transactions")
        .where("status", "==", "pending")
        .where("dueDate", "<=", limitDateStr)
        .get();

      for (const doc of pendingTransactions.docs) {
        const data = doc.data();
        const dueDate = data.dueDate as string | undefined;
        const tenantId = data.tenantId as string;

        if (!dueDate || !tenantId) continue;

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

        await upsertDueReminderNotification({
          tenantId,
          type: "transaction_due_reminder",
          title,
          message,
          resourceId: doc.id,
          resourceField: "transactionId",
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
      // Single query using `in` operator instead of 3 sequential queries
      const proposalSnapshot = await db
        .collection("proposals")
        .where("status", "in", ["draft", "in_progress", "sent"])
        .get();

      for (const doc of proposalSnapshot.docs) {
        const data = doc.data();
        const validUntil = data.validUntil as string | undefined;
        const tenantId = data.tenantId as string;

        if (!validUntil || !tenantId) continue;

        // Verificar se validUntil está dentro do intervalo
        if (validUntil > limitDateStr) continue;

        const isExpired = validUntil < today;
        const title = data.title || "Sem título";
        const clientName = data.clientName || "";

        const formattedValidUntil = formatDateBR(validUntil);

        await upsertDueReminderNotification({
          tenantId,
          type: "proposal_expiring",
          title: isExpired
            ? "Proposta com validade expirada"
            : "Proposta próxima da validade",
          message: isExpired
            ? `"${title}"${clientName ? ` (${clientName})` : ""} expirou em ${formattedValidUntil}. Verifique o status.`
            : `"${title}"${clientName ? ` (${clientName})` : ""} válida até ${formattedValidUntil}. Lembre-se de acompanhar.`,
          resourceId: doc.id,
          resourceField: "proposalId",
          proposalId: doc.id,
        });

        proposalReminders++;
      }

      console.log(
        `Created ${proposalReminders} proposal expiration reminders.`,
      );
      console.log(
        `Due date check complete. Total reminders: ${transactionReminders + proposalReminders}.`,
      );

      // ================================================================
      // 3. CLEANUP — WhatsApp stale sessions (TTL)
      // ================================================================
      try {
        const staleThreshold = Timestamp.fromMillis(
          Date.now() - 24 * 60 * 60 * 1000,
        );
        const staleSessions = await db
          .collection("whatsappSessions")
          .where("expiresAt", "<", staleThreshold)
          .limit(200)
          .get();

        if (!staleSessions.empty) {
          const batch = db.batch();
          staleSessions.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
          console.log(
            `Cleaned up ${staleSessions.size} stale WhatsApp sessions.`,
          );
        }
      } catch (cleanupError) {
        console.warn(
          "WhatsApp session cleanup failed (non-fatal):",
          cleanupError,
        );
      }
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

async function upsertDueReminderNotification(data: {
  tenantId: string;
  type: "transaction_due_reminder" | "proposal_expiring";
  title: string;
  message: string;
  resourceId: string;
  resourceField: "transactionId" | "proposalId";
  proposalId?: string;
  transactionId?: string;
}): Promise<void> {
  const {
    tenantId,
    type,
    title,
    message,
    resourceId,
    resourceField,
    proposalId,
    transactionId,
  } = data;

  const stableDocId = `due_${tenantId}_${type}_${resourceField}_${resourceId}`;
  const notificationRef = db.collection("notifications").doc(stableDocId);

  await notificationRef.set(
    {
      tenantId,
      type,
      title,
      message,
      isRead: false,
      readAt: FieldValue.delete(),
      createdAt: new Date().toISOString(),
      ...(proposalId ? { proposalId } : {}),
      ...(transactionId ? { transactionId } : {}),
    },
    { merge: true },
  );
}
