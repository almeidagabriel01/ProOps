import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./init";
import { SCHEDULE_OPTIONS } from "./deploymentConfig";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { captureError } from "./lib/observability/error-logger";

/**
 * Cloud Function scheduled que roda diariamente para verificar
 * transações e propostas próximas do vencimento e criar notificações de lembrete.
 */
export const checkDueDates = onSchedule(
  {
    ...SCHEDULE_OPTIONS,
    schedule: "every 24 hours",
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async () => {
    await runDueDateCheck(new Date());
  },
);

/**
 * Propostas vencidas há mais que isto param de gerar lembrete diário. Sem o
 * piso, toda proposta aberta que já expirou era relembrada todo dia, para
 * sempre: o conjunto só crescia, o cron gastava o tempo com o acervo antigo e,
 * em escala, estourava os 300s antes de chegar às que estão para vencer.
 * (Lançamentos não precisam: markOverdueTransactions os tira de "pending".)
 */
export const PROPOSAL_EXPIRED_REMINDER_WINDOW_DAYS = 30;

export async function runDueDateCheck(now: Date): Promise<void> {
  console.log("Starting due date check...");

  const today = now.toISOString().split("T")[0]; // YYYY-MM-DD

  // Data limite: hoje + 3 dias
  const limitDate = new Date(now);
  limitDate.setDate(limitDate.getDate() + 3);
  const limitDateStr = limitDate.toISOString().split("T")[0]; // YYYY-MM-DD

  const expiredFloor = new Date(now);
  expiredFloor.setDate(
    expiredFloor.getDate() - PROPOSAL_EXPIRED_REMINDER_WINDOW_DAYS,
  );
  const expiredFloorStr = expiredFloor.toISOString().split("T")[0];

  // Upserts em paralelo (com o throttling do próprio SDK) em vez de um
  // await por notificação, que custava ~30ms cada contra o timeout de 300s.
  const writer = db.bulkWriter();
  writer.onWriteError((error) => {
    console.warn("[checkDueDates] upsert failed", error.code);
    return error.failedAttempts < 3;
  });

  let transactionReminders = 0;
  let proposalReminders = 0;

  try {
    // ================================================================
    // 1. TRANSAÇÕES PENDENTES — vencimento próximo ou vencido
    // ================================================================
    // Compound query: status == "pending" AND dueDate <= limitDateStr
    // Requires composite index (status ASC, dueDate ASC) in firestore.indexes.json
    // Paginado (mesmo padrão de markOverdueTransactions) — resultado global
    // cresce com a base; nunca carregar tudo em memória de uma vez.
    for await (const doc of paginate(
      db
        .collection("transactions")
        .where("status", "==", "pending")
        .where("dueDate", "<=", limitDateStr)
        .orderBy("dueDate"),
    )) {
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

      upsertDueReminderNotification(writer, {
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
    // Filtro de validUntil na QUERY (não em memória) — sem ele o cron
    // varria todo o inventário global de propostas abertas. Docs sem
    // validUntil já eram ignorados, então o range é equivalente.
    // Requires composite index (status ASC, validUntil ASC).
    for await (const doc of paginate(
      db
        .collection("proposals")
        .where("status", "in", ["draft", "in_progress", "sent"])
        .where("validUntil", ">=", expiredFloorStr)
        .where("validUntil", "<=", limitDateStr)
        .orderBy("validUntil"),
    )) {
      const data = doc.data();
      const validUntil = data.validUntil as string | undefined;
      const tenantId = data.tenantId as string;

      if (!validUntil || !tenantId) continue;

      const isExpired = validUntil < today;
      const title = data.title || "Sem título";
      const clientName = data.clientName || "";

      const formattedValidUntil = formatDateBR(validUntil);

      upsertDueReminderNotification(writer, {
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
    void captureError(error, { source: "functions", route: "cron/checkDueDates", handled: false });
  } finally {
    await writer.close();
  }
}

const CRON_PAGE_SIZE = 400;

/**
 * Itera um query paginando por cursor — memória constante independente do
 * tamanho do resultado (padrão de markOverdueTransactions).
 */
async function* paginate(
  query: FirebaseFirestore.Query,
): AsyncGenerator<FirebaseFirestore.QueryDocumentSnapshot> {
  let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  for (;;) {
    let page = query.limit(CRON_PAGE_SIZE);
    if (last) page = page.startAfter(last);
    const snap = await page.get();
    for (const doc of snap.docs) yield doc;
    if (snap.size < CRON_PAGE_SIZE) return;
    last = snap.docs[snap.docs.length - 1];
  }
}

/**
 * Formata data YYYY-MM-DD para DD/MM/YYYY
 */
function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function upsertDueReminderNotification(
  writer: FirebaseFirestore.BulkWriter,
  data: {
  tenantId: string;
  type: "transaction_due_reminder" | "proposal_expiring";
  title: string;
  message: string;
  resourceId: string;
  resourceField: "transactionId" | "proposalId";
  proposalId?: string;
  transactionId?: string;
  },
): void {
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

  // Falha já é registrada (e retentada) pelo onWriteError do writer; o catch
  // só impede que a promise rejeitada vire unhandled rejection.
  writer.set(
    notificationRef,
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
  ).catch(() => undefined);
}
