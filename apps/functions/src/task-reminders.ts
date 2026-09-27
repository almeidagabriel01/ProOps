import { db } from "./init";
import { todayInBrazil } from "./api/services/proposal-online-approval";
import { NotificationService } from "./api/services/notification.service";
import { TASKS_COLLECTION } from "./api/services/tasks";

const PAGE_LIMIT = 500;

/**
 * Lembrete das tarefas com prazo hoje (fuso de Brasília), parte do
 * `checkDueDates`. Vai para o responsável, ou para quem criou quando a tarefa
 * não tem responsável. Id `task_{taskId}_{dia}`: rodar de novo no mesmo dia
 * não duplica. Consulta por igualdade num campo só (índice automático).
 */
export async function runTaskReminders(
  now: Date,
  writer: FirebaseFirestore.BulkWriter,
): Promise<number> {
  const today = todayInBrazil(now);
  const createdAt = now.toISOString();
  let created = 0;

  const snap = await db.collection(TASKS_COLLECTION).where("dueAt", "==", today).limit(PAGE_LIMIT).get();
  for (const doc of snap.docs) {
    const task = doc.data();
    if (!task.tenantId || task.doneAt) continue;
    const target = (task.assigneeId as string | null) || (task.createdBy as string | null);
    if (!target) continue;

    const { fields } = await NotificationService.recipientFields(
      String(task.tenantId),
      "task_reminder",
      [target],
    );
    writer.set(
      db.collection("notifications").doc(`task_${doc.id}_${today}`),
      {
        tenantId: String(task.tenantId),
        type: "task_reminder",
        title: "Tarefa para hoje",
        message: `"${String(task.title ?? "")}"`,
        taskId: doc.id,
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
