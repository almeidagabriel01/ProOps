import { db } from "./init";
import { acceptanceStatus, isChangeRequestOpen } from "./api/services/proposal-online-approval";
import { NotificationService } from "./api/services/notification.service";

/**
 * Follow-up de proposta vista e não respondida: o cliente abriu o link há
 * alguns dias e a proposta continua aberta. Quem recebe o lembrete é a
 * empresa (notificação no ERP); o contato com o cliente continua humano.
 *
 * O link marca `followUpPending: true` e `firstViewedAt` na PRIMEIRA
 * visualização (`SharedProposalService.recordView`). O cron consulta por esses
 * dois campos e desmarca o pendente depois de avisar: um aviso por link.
 */
export const FOLLOW_UP_AFTER_DAYS = 3;

const CLOSED_STATUSES = new Set(["approved", "rejected", "draft", "default_2", "default_3"]);

/** A proposta ainda espera resposta do cliente? */
export async function isProposalAwaitingClient(
  proposal: Record<string, unknown>,
): Promise<boolean> {
  const status = String(proposal.status ?? "");
  if (!status || CLOSED_STATUSES.has(status)) return false;
  // Aceite pendente ou confirmado já é resposta; descartado ou anulado não.
  const accepted = acceptanceStatus(proposal.clientAcceptance);
  if (accepted === "pending" || accepted === "confirmed") return false;
  // Pediu mudanças: a bola está com a empresa, não com o cliente.
  if (isChangeRequestOpen(proposal.clientChangeRequest)) return false;
  if (["in_progress", "sent", "default_0", "default_1"].includes(status)) return true;

  // Coluna personalizada do CRM: ganha ou perdida já teve resposta.
  const column = await db.collection("kanban_statuses").doc(status).get();
  const category = column.data()?.category;
  const mapped = column.data()?.mappedStatus;
  return category !== "won" && category !== "lost" && mapped !== "approved" && mapped !== "rejected";
}

export function followUpCutoffIso(now: Date): string {
  return new Date(now.getTime() - FOLLOW_UP_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function buildFollowUpNotification(params: {
  tenantId: string;
  proposalId: string;
  sharedProposalId: string;
  title?: string | null;
  clientName?: string | null;
}) {
  const title = params.title?.trim() || "Sem título";
  const who = params.clientName?.trim() || "O cliente";
  return {
    tenantId: params.tenantId,
    type: "proposal_follow_up" as const,
    title: "Cliente viu e ainda não respondeu",
    message: `${who} abriu "${title}" há ${FOLLOW_UP_AFTER_DAYS} dias e a proposta continua sem resposta. Que tal mandar uma mensagem?`,
    proposalId: params.proposalId,
    sharedProposalId: params.sharedProposalId,
  };
}

/**
 * Cria os lembretes pendentes. Id determinístico por link (`followup_{id}`):
 * rodar de novo no mesmo dia não duplica.
 */
export async function runProposalFollowUps(
  now: Date,
  writer: FirebaseFirestore.BulkWriter,
  pageSize = 200,
): Promise<number> {
  const cutoff = followUpCutoffIso(now);
  let created = 0;
  let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  for (;;) {
    let query = db
      .collection("shared_proposals")
      .where("followUpPending", "==", true)
      .where("firstViewedAt", "<=", cutoff)
      .orderBy("firstViewedAt")
      .limit(pageSize);
    if (last) query = query.startAfter(last);
    const snap = await query.get();

    for (const doc of snap.docs) {
      const shared = doc.data();
      const proposalSnap = await db
        .collection("proposals")
        .doc(String(shared.proposalId))
        .get();
      const proposal = proposalSnap.data();

      if (
        proposal &&
        proposal.tenantId === shared.tenantId &&
        (await isProposalAwaitingClient(proposal))
      ) {
        const notification = buildFollowUpNotification({
          tenantId: String(shared.tenantId),
          proposalId: proposalSnap.id,
          sharedProposalId: doc.id,
          title: proposal.title as string | undefined,
          clientName: proposal.clientName as string | undefined,
        });
        const { fields, emailRecipients } = await NotificationService.recipientFields(
          notification.tenantId,
          "proposal_follow_up",
        );
        writer.set(
          db.collection("notifications").doc(`followup_${doc.id}`),
          { ...notification, ...fields, isRead: false, createdAt: now.toISOString() },
          { merge: true },
        );
        // Um aviso por link (o link é desmarcado logo abaixo), então o e-mail
        // também sai uma vez só.
        await NotificationService.sendNotificationEmails(notification, emailRecipients);
        created++;
      }
      writer.update(doc.ref, { followUpPending: false });
    }

    if (snap.size < pageSize) return created;
    last = snap.docs[snap.docs.length - 1];
  }
}
