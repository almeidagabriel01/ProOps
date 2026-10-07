import { Request, Response } from "express";
import { db } from "../../init";
import { hasPagePermission } from "../../lib/auth-helpers";
import { ActivityInputSchema, ActivityUpdateSchema } from "../services/crm-leads";

/**
 * Atividades do CRM (`activities`): ligação, visita, reunião, tarefa com data,
 * presas a um lead ou a um contato. Mesma permissão e mesmo plano dos leads.
 */
const COLLECTION = "activities";
const MAX_ACTIVITIES_LISTED = 200;

type ActivityDoc = Record<string, unknown> & { tenantId?: string };

function toPublicActivity(id: string, data: ActivityDoc) {
  return {
    id,
    leadId: data.leadId ?? null,
    clientId: data.clientId ?? null,
    type: data.type,
    title: data.title,
    dueAt: data.dueAt ?? null,
    doneAt: data.doneAt ?? null,
    createdBy: data.createdBy ?? null,
    createdByName: data.createdByName ?? null,
    createdAt: data.createdAt ?? null,
  };
}

async function ownsTarget(
  tenantId: string,
  target: { leadId?: string; clientId?: string },
): Promise<boolean> {
  const checks: Promise<boolean>[] = [];
  if (target.leadId) {
    checks.push(
      db.collection("leads").doc(target.leadId).get().then((s) => s.exists && s.data()?.tenantId === tenantId),
    );
  }
  if (target.clientId) {
    checks.push(
      db.collection("clients").doc(target.clientId).get().then((s) => s.exists && s.data()?.tenantId === tenantId),
    );
  }
  const results = await Promise.all(checks);
  return results.length > 0 && results.every(Boolean);
}

async function loadActivityOfTenant(id: string, tenantId: string) {
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  const data = snap.data() as ActivityDoc | undefined;
  if (!snap.exists || data?.tenantId !== tenantId) return null;
  return { ref, data: data as ActivityDoc };
}

/** GET /v1/activities?leadId=... | ?clientId=... */
export async function listActivities(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant não identificado." });
    if (!(await hasPagePermission(req.user, "kanban", "canView"))) {
      return res.status(403).json({ message: "Sem permissão para ver o CRM." });
    }

    const leadId = typeof req.query.leadId === "string" ? req.query.leadId : "";
    const clientId = typeof req.query.clientId === "string" ? req.query.clientId : "";
    if (!leadId && !clientId) {
      return res.status(400).json({ message: "Informe o lead ou o contato." });
    }

    const field = leadId ? "leadId" : "clientId";
    const snap = await db
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where(field, "==", leadId || clientId)
      .limit(MAX_ACTIVITIES_LISTED)
      .get();

    const activities = snap.docs
      .map((doc) => toPublicActivity(doc.id, doc.data() as ActivityDoc))
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));

    return res.json({ activities });
  } catch (error) {
    console.error("listActivities Error:", error);
    return res.status(500).json({ message: "Erro ao carregar as atividades." });
  }
}

/** POST /v1/activities */
export async function createActivity(req: Request, res: Response) {
  const parsed = ActivityInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message || "Dados inválidos." });
  }

  try {
    const tenantId = req.user?.tenantId;
    const uid = req.user?.uid;
    if (!tenantId || !uid) return res.status(403).json({ message: "Tenant não identificado." });
    if (!(await hasPagePermission(req.user, "kanban", "canEdit"))) {
      return res.status(403).json({ message: "Sem permissão para registrar atividades." });
    }
    if (!(await ownsTarget(tenantId, parsed.data))) {
      return res.status(404).json({ message: "Lead ou contato não encontrado." });
    }

    const author = await db.collection("users").doc(uid).get();
    const activity: ActivityDoc = {
      tenantId,
      leadId: parsed.data.leadId ?? null,
      clientId: parsed.data.clientId ?? null,
      type: parsed.data.type,
      title: parsed.data.title,
      dueAt: parsed.data.dueAt ?? null,
      doneAt: null,
      createdBy: uid,
      createdByName: (author.data()?.name as string | undefined) ?? null,
      createdAt: new Date().toISOString(),
    };
    const ref = await db.collection(COLLECTION).add(activity);

    return res.status(201).json({ activity: toPublicActivity(ref.id, activity) });
  } catch (error) {
    console.error("createActivity Error:", error);
    return res.status(500).json({ message: "Erro ao salvar a atividade." });
  }
}

/** PUT /v1/activities/:id */
export async function updateActivity(req: Request, res: Response) {
  const parsed = ActivityUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message || "Dados inválidos." });
  }

  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant não identificado." });
    if (!(await hasPagePermission(req.user, "kanban", "canEdit"))) {
      return res.status(403).json({ message: "Sem permissão para editar atividades." });
    }

    const found = await loadActivityOfTenant(req.params.id, tenantId);
    if (!found) return res.status(404).json({ message: "Atividade não encontrada." });

    const update: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) update.title = parsed.data.title;
    if (parsed.data.dueAt !== undefined) update.dueAt = parsed.data.dueAt;
    if (parsed.data.done !== undefined) {
      update.doneAt = parsed.data.done ? new Date().toISOString() : null;
    }
    if (Object.keys(update).length > 0) await found.ref.update(update);

    return res.json({ activity: toPublicActivity(req.params.id, { ...found.data, ...update }) });
  } catch (error) {
    console.error("updateActivity Error:", error);
    return res.status(500).json({ message: "Erro ao atualizar a atividade." });
  }
}

/**
 * DELETE /v1/activities/:id
 *
 * Excluir é "Excluir" no CRM; quem só edita apaga só a atividade que ele
 * mesmo registrou. Até 2026-10 bastava editar, e qualquer um apagava o
 * histórico de contato que outro vendedor tinha registrado.
 */
export async function deleteActivity(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant não identificado." });
    const canDelete = await hasPagePermission(req.user, "kanban", "canDelete");
    if (!canDelete && !(await hasPagePermission(req.user, "kanban", "canEdit"))) {
      return res.status(403).json({ message: "Sem permissão para excluir atividades." });
    }

    const found = await loadActivityOfTenant(req.params.id, tenantId);
    if (!found) return res.status(404).json({ message: "Atividade não encontrada." });
    if (!canDelete && found.data.createdBy !== req.user?.uid) {
      return res.status(403).json({ message: "Você só exclui as atividades que registrou." });
    }

    await found.ref.delete();
    return res.json({ success: true });
  } catch (error) {
    console.error("deleteActivity Error:", error);
    return res.status(500).json({ message: "Erro ao excluir a atividade." });
  }
}
