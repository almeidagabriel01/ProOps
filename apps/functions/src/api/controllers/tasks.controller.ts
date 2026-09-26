import { Request, Response } from "express";
import { db } from "../../init";
import { logger } from "../../lib/logger";
import { hasPagePermission } from "../../lib/auth-helpers";
import { isTenantAdminRole } from "../../lib/auth-context";
import { NotificationService } from "../services/notification.service";
import {
  CreateTaskSchema,
  TASKS_COLLECTION,
  UpdateTaskSchema,
  buildAudience,
  formatDueShort,
  planTaskNotifications,
} from "../services/tasks";

/**
 * Tarefas. Permissão própria (pageId `tasks`), em todos os planos, sem gate de
 * capacidade. O tenant vem sempre de `req.user.tenantId`. A leitura é direta
 * no Firestore pelo front (as rules filtram por `audienceUids`, e a conta de
 * demonstração lê o tenant `demo`); aqui ficam as escritas e a lista de quem
 * pode ser responsável ou citado.
 */

type Action = "canView" | "canCreate" | "canEdit" | "canDelete";

const PEOPLE_LIMIT = 200;

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface Actor {
  tenantId: string;
  uid: string;
  isAdmin: boolean;
}

async function requireTaskAccess(req: Request, action: Action): Promise<Actor> {
  const tenantId = req.user?.tenantId;
  const uid = req.user?.uid;
  if (!tenantId || !uid) throw new HttpError(403, "Tenant não identificado.");
  if (!(await hasPagePermission(req.user, "tasks", action))) {
    throw new HttpError(403, "Sem permissão para esta ação em Tarefas.");
  }
  return { tenantId, uid, isAdmin: isTenantAdminRole(String(req.user?.role || "").toUpperCase()) };
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message || "Dados inválidos.";
}

function fail(res: Response, error: unknown, fallback: string, event: string) {
  if (error instanceof HttpError) return res.status(error.status).json({ message: error.message });
  logger.error(event, { error: error instanceof Error ? error.message : String(error) });
  return res.status(500).json({ message: fallback });
}

interface Person {
  id: string;
  name: string;
}

/**
 * Quem pode ser responsável ou citado: o dono, os administradores e os membros
 * que enxergam a tela de Tarefas. Atribuir a quem não abre a tela seria uma
 * notificação que leva a um 403.
 */
async function loadTaskPeople(tenantId: string): Promise<Person[]> {
  const snap = await db.collection("users").where("tenantId", "==", tenantId).limit(PEOPLE_LIMIT).get();
  const people = await Promise.all(
    snap.docs.map(async (doc): Promise<Person | null> => {
      const data = doc.data();
      const role = String(data.role || "").toUpperCase();
      if (role === "SUPERADMIN") return null;
      const name = String(data.name || data.email || "Sem nome");
      if (role === "FREE" || isTenantAdminRole(role)) return { id: doc.id, name };
      const perm = await doc.ref.collection("permissions").doc("tasks").get();
      return perm.data()?.canView === true ? { id: doc.id, name } : null;
    }),
  );
  return people
    .filter((p): p is Person => p !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function assertPeople(people: Map<string, string>, uids: Array<string | null | undefined>) {
  for (const uid of uids) {
    if (uid && !people.has(uid)) {
      throw new HttpError(400, "A pessoa escolhida não pode receber tarefas nesta empresa.");
    }
  }
}

/** O que a tarefa cita (contato, proposta, lead) precisa ser da empresa. */
async function resolveLinks(
  tenantId: string,
  links: { clientId?: string; proposalId?: string; leadId?: string },
): Promise<Record<string, string | null>> {
  const read = async (collection: string, id: string | undefined, field: string) => {
    if (!id) return null;
    const snap = await db.collection(collection).doc(id).get();
    const data = snap.data();
    if (!snap.exists || data?.tenantId !== tenantId) {
      throw new HttpError(404, "O que a tarefa cita não foi encontrado.");
    }
    return String(data?.[field] ?? "");
  };
  const [clientName, proposalTitle, leadName] = await Promise.all([
    read("clients", links.clientId, "name"),
    read("proposals", links.proposalId, "title"),
    read("leads", links.leadId, "name"),
  ]);
  return {
    clientId: links.clientId ?? null,
    clientName,
    proposalId: links.proposalId ?? null,
    proposalTitle,
    leadId: links.leadId ?? null,
    leadName,
  };
}

async function notifyTaskPeople(input: {
  tenantId: string;
  taskId: string;
  title: string;
  dueAt: string | null;
  actorName: string;
  assigned: string | null;
  mentioned: string[];
}) {
  const due = formatDueShort(input.dueAt);
  try {
    if (input.assigned) {
      await NotificationService.createNotification({
        tenantId: input.tenantId,
        type: "task_assigned",
        title: "Nova tarefa para você",
        message: `${input.actorName} passou para você: "${input.title}"${due ? `, prazo ${due}` : ""}.`,
        taskId: input.taskId,
        targetUids: [input.assigned],
      });
    }
    if (input.mentioned.length > 0) {
      await NotificationService.createNotification({
        tenantId: input.tenantId,
        type: "task_mentioned",
        title: "Você foi citado numa tarefa",
        message: `${input.actorName} citou você em "${input.title}".`,
        taskId: input.taskId,
        targetUids: input.mentioned,
      });
    }
  } catch (error) {
    // A tarefa já foi gravada; o aviso é conveniência.
    logger.warn("task_notification_failed", {
      tenantId: input.tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** GET /v1/tasks/people */
export async function listTaskPeople(req: Request, res: Response) {
  try {
    const { tenantId } = await requireTaskAccess(req, "canView");
    return res.json({ people: await loadTaskPeople(tenantId) });
  } catch (error) {
    return fail(res, error, "Erro ao carregar a equipe.", "task_people_failed");
  }
}

/** POST /v1/tasks */
export async function createTask(req: Request, res: Response) {
  const parsed = CreateTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
  try {
    const actor = await requireTaskAccess(req, "canCreate");
    const input = parsed.data;
    const peopleList = await loadTaskPeople(actor.tenantId);
    const people = new Map(peopleList.map((p) => [p.id, p.name]));
    const mentionUids = Array.from(new Set(input.mentionUids ?? []));
    assertPeople(people, [input.assigneeId, ...mentionUids]);
    const links = await resolveLinks(actor.tenantId, input);

    const now = new Date().toISOString();
    const assigneeId = input.assigneeId ?? null;
    const actorName = people.get(actor.uid) ?? "Alguém da equipe";
    const ref = db.collection(TASKS_COLLECTION).doc();
    const task = {
      tenantId: actor.tenantId,
      title: input.title,
      notes: input.notes ?? null,
      dueAt: input.dueAt ?? null,
      assigneeId,
      assigneeName: assigneeId ? people.get(assigneeId) ?? null : null,
      mentionUids,
      audienceUids: buildAudience(actor.uid, assigneeId, mentionUids),
      ...links,
      doneAt: null,
      doneBy: null,
      createdBy: actor.uid,
      createdByName: actorName,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(task);

    const plan = planTaskNotifications({
      actorUid: actor.uid,
      previousAssigneeId: null,
      assigneeId,
      previousMentionUids: [],
      mentionUids,
    });
    await notifyTaskPeople({
      tenantId: actor.tenantId,
      taskId: ref.id,
      title: task.title,
      dueAt: task.dueAt,
      actorName,
      ...plan,
    });

    return res.status(201).json({ task: { id: ref.id, ...task } });
  } catch (error) {
    return fail(res, error, "Erro ao criar a tarefa.", "task_create_failed");
  }
}

async function loadTaskFor(actor: Actor, id: string) {
  const ref = db.collection(TASKS_COLLECTION).doc(id);
  const snap = await ref.get();
  const data = snap.data();
  if (!snap.exists || data?.tenantId !== actor.tenantId) throw new HttpError(404, "Tarefa não encontrada.");
  const audience = (data.audienceUids as string[] | undefined) ?? [];
  // Quem não enxerga a tarefa não sabe que ela existe: 404, não 403.
  if (!actor.isAdmin && !audience.includes(actor.uid)) throw new HttpError(404, "Tarefa não encontrada.");
  return { ref, data };
}

/** PUT /v1/tasks/:id */
export async function updateTask(req: Request, res: Response) {
  const parsed = UpdateTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
  try {
    const actor = await requireTaskAccess(req, "canEdit");
    const { ref, data } = await loadTaskFor(actor, String(req.params.id));
    const input = parsed.data;

    const touchesPeople = input.assigneeId !== undefined || input.mentionUids !== undefined;
    const peopleList = touchesPeople ? await loadTaskPeople(actor.tenantId) : [];
    const people = new Map(peopleList.map((p) => [p.id, p.name]));
    const mentionUids =
      input.mentionUids !== undefined
        ? Array.from(new Set(input.mentionUids))
        : ((data.mentionUids as string[] | undefined) ?? []);
    const assigneeId =
      input.assigneeId !== undefined ? input.assigneeId : ((data.assigneeId as string | null) ?? null);
    if (touchesPeople) assertPeople(people, [assigneeId, ...mentionUids]);

    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (input.title !== undefined) update.title = input.title;
    if (input.notes !== undefined) update.notes = input.notes || null;
    if (input.dueAt !== undefined) update.dueAt = input.dueAt;
    if (input.assigneeId !== undefined) {
      update.assigneeId = assigneeId;
      update.assigneeName = assigneeId ? people.get(assigneeId) ?? null : null;
    }
    if (input.mentionUids !== undefined) update.mentionUids = mentionUids;
    if (touchesPeople) {
      update.audienceUids = buildAudience(String(data.createdBy), assigneeId, mentionUids);
    }
    if (input.done !== undefined) {
      update.doneAt = input.done ? new Date().toISOString() : null;
      update.doneBy = input.done ? actor.uid : null;
    }
    await ref.update(update);

    if (touchesPeople) {
      const plan = planTaskNotifications({
        actorUid: actor.uid,
        previousAssigneeId: (data.assigneeId as string | null) ?? null,
        assigneeId,
        previousMentionUids: (data.mentionUids as string[] | undefined) ?? [],
        mentionUids,
      });
      await notifyTaskPeople({
        tenantId: actor.tenantId,
        taskId: ref.id,
        title: String(update.title ?? data.title),
        dueAt: (update.dueAt as string | null | undefined) ?? (data.dueAt as string | null) ?? null,
        actorName: people.get(actor.uid) ?? "Alguém da equipe",
        ...plan,
      });
    }

    return res.json({ task: { id: ref.id, ...data, ...update } });
  } catch (error) {
    return fail(res, error, "Erro ao salvar a tarefa.", "task_update_failed");
  }
}

/** DELETE /v1/tasks/:id: quem criou, ou o dono. */
export async function deleteTask(req: Request, res: Response) {
  try {
    const actor = await requireTaskAccess(req, "canDelete");
    const { ref, data } = await loadTaskFor(actor, String(req.params.id));
    if (!actor.isAdmin && data.createdBy !== actor.uid) {
      throw new HttpError(403, "Só quem criou a tarefa, ou o dono da conta, pode excluí-la.");
    }
    await ref.delete();
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao excluir a tarefa.", "task_delete_failed");
  }
}
