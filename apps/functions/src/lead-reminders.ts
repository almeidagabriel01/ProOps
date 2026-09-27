import { db } from "./init";
import { isLeadOpen } from "./api/services/crm-leads";
import { todayInBrazil } from "./api/services/proposal-online-approval";
import { NotificationService } from "./api/services/notification.service";

/**
 * Lembrete da próxima ação do CRM: lead com "próxima ação" marcada para hoje e
 * atividade com prazo hoje ainda não concluída viram notificação no sino, no
 * dia (fuso de Brasília). Consultas por igualdade num campo só: índice
 * automático, sem composto.
 *
 * Ids determinísticos por item e dia (`lead_{id}_{dia}`, `activity_{id}_{dia}`):
 * rodar de novo no mesmo dia não duplica.
 */
const PAGE_LIMIT = 500;

export function buildLeadReminder(params: {
  tenantId: string;
  leadId: string;
  name: string;
  nextAction?: string | null;
  ownerName?: string | null;
}) {
  const action = params.nextAction?.trim() || "Retomar o contato";
  const owner = params.ownerName?.trim();
  return {
    tenantId: params.tenantId,
    type: "lead_reminder" as const,
    title: `Hoje: ${action}`,
    message: owner
      ? `Lead ${params.name}, com ${owner}.`
      : `Lead ${params.name}.`,
    leadId: params.leadId,
  };
}

export function buildActivityReminder(params: {
  tenantId: string;
  activityId: string;
  title: string;
  leadId?: string | null;
  clientId?: string | null;
}) {
  return {
    tenantId: params.tenantId,
    type: "lead_reminder" as const,
    title: "Atividade para hoje",
    message: params.title,
    ...(params.leadId ? { leadId: params.leadId } : {}),
    ...(params.clientId ? { clientId: params.clientId } : {}),
  };
}

export async function runLeadReminders(
  now: Date,
  writer: FirebaseFirestore.BulkWriter,
): Promise<number> {
  const today = todayInBrazil(now);
  const createdAt = now.toISOString();
  let created = 0;

  const leads = await db
    .collection("leads")
    .where("nextActionAt", "==", today)
    .limit(PAGE_LIMIT)
    .get();
  for (const doc of leads.docs) {
    const lead = doc.data();
    if (!lead.tenantId || !isLeadOpen(lead.stage)) continue;
    const { fields } = await NotificationService.recipientFields(
      String(lead.tenantId),
      "lead_reminder",
    );
    writer.set(
      db.collection("notifications").doc(`lead_${doc.id}_${today}`),
      {
        ...buildLeadReminder({
          tenantId: String(lead.tenantId),
          leadId: doc.id,
          name: String(lead.name ?? ""),
          nextAction: lead.nextAction as string | undefined,
          ownerName: lead.ownerName as string | undefined,
        }),
        ...fields,
        isRead: false,
        createdAt,
      },
      { merge: true },
    );
    created++;
  }

  const activities = await db
    .collection("activities")
    .where("dueAt", "==", today)
    .limit(PAGE_LIMIT)
    .get();
  for (const doc of activities.docs) {
    const activity = doc.data();
    if (!activity.tenantId || activity.doneAt) continue;
    const { fields } = await NotificationService.recipientFields(
      String(activity.tenantId),
      "lead_reminder",
    );
    writer.set(
      db.collection("notifications").doc(`activity_${doc.id}_${today}`),
      {
        ...buildActivityReminder({
          tenantId: String(activity.tenantId),
          activityId: doc.id,
          title: String(activity.title ?? ""),
          leadId: activity.leadId as string | null,
          clientId: activity.clientId as string | null,
        }),
        ...fields,
        isRead: false,
        createdAt,
      },
      { merge: true },
    );
    created++;
  }

  return created;
}
