import { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../../init";
import { logger } from "../../lib/logger";
import { hasPagePermission } from "../../lib/auth-helpers";
import { isTenantAdminRole } from "../../lib/auth-context";
import { isStatusApproved } from "./proposals.controller";
import {
  buildCalendarEventDocument,
  deleteEventFromGoogleIfNeeded,
  getValidationMessage,
  syncEventToGoogle,
  type CalendarEventDocument,
} from "./calendar.controller";
import { NotificationService } from "../services/notification.service";
import { resolveFrontendAppOrigin } from "../../lib/frontend-app-url";
import {
  ScheduleStageSchema,
  scheduleChanged,
  scheduleEventDescription,
  scheduleEventTitle,
  stageScheduleFromEvent,
} from "../services/projects/project-schedule";
import {
  ChecklistItemSchema,
  ChecklistToggleSchema,
  CreateProjectSchema,
  MAX_CHECKLIST_ITEMS,
  MAX_PHOTOS_PER_STAGE,
  PhotoUploadSchema,
  ProjectSettingsSchema,
  UpdateProjectSchema,
  UpdateStageSchema,
  applyStageStatus,
  decodePhotoDataUrl,
  type ProjectDelivery,
  type ProjectStage,
  type StagePhoto,
  type StageSchedule,
} from "../services/projects/project-model";
import {
  UpdateItemsStatusSchema,
  applyItemsStatus,
  buildProjectItemsFromProposal,
  type ProjectItem,
} from "../services/projects/project-items";
import {
  PROJECTS_COLLECTION,
  createProjectFromProposal,
  createProjectShareLink,
  createStandaloneProject,
  deleteProjectPhotos,
  isStorageOverQuota,
  loadProjectOfTenant,
  loadProjectSettings,
  projectPhotoPath,
  saveProjectSettings,
  storeProjectPhoto,
} from "../services/projects/project.service";

/**
 * Projetos de instalação. Permissão própria (pageId `projects`), capacidade
 * `projects` montada por prefixo em `projects.routes.ts`. O tenant vem sempre
 * de `req.user.tenantId`. A leitura da lista e do detalhe é direta no
 * Firestore pelo front (a conta de demonstração lê o tenant `demo`); aqui
 * ficam só as escritas.
 */

// Ação básica ou fina do catálogo (`assign`, `cancel`, `deliveryLink`, `schedule`).
type Action = "canView" | "canCreate" | "canEdit" | "canDelete" | "assign" | "cancel" | "deliveryLink" | "schedule";

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function requireProjectAccess(req: Request, action: Action): Promise<{ tenantId: string; uid: string }> {
  const tenantId = req.user?.tenantId;
  const uid = req.user?.uid;
  if (!tenantId || !uid) throw new HttpError(403, "Tenant não identificado.");
  if (!(await hasPagePermission(req.user, "projects", action))) {
    throw new HttpError(403, "Sem permissão para esta ação em Projetos.");
  }
  return { tenantId, uid };
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message || "Dados inválidos.";
}

function fail(res: Response, error: unknown, fallback: string, event: string) {
  if (error instanceof HttpError) return res.status(error.status).json({ message: error.message });
  logger.error(event, { error: error instanceof Error ? error.message : String(error) });
  return res.status(500).json({ message: fallback });
}

async function userName(uid: string): Promise<string | null> {
  const snap = await db.collection("users").doc(uid).get();
  return (snap.data()?.name as string | undefined) ?? null;
}

/**
 * Lê o projeto dentro de uma transação, aplica a mudança nas etapas e grava.
 * Duas pessoas marcando itens do checklist ao mesmo tempo não se sobrescrevem.
 */
async function mutateStages<T>(
  projectId: string,
  tenantId: string,
  mutate: (stages: ProjectStage[], project: Record<string, unknown>) => { stages: ProjectStage[]; result: T },
): Promise<T> {
  const ref = db.collection(PROJECTS_COLLECTION).doc(projectId);
  return db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const data = snap.data();
    if (!snap.exists || data?.tenantId !== tenantId) throw new HttpError(404, "Projeto não encontrado.");
    const { stages, result } = mutate((data.stages as ProjectStage[]) ?? [], data);
    t.update(ref, { stages, updatedAt: new Date().toISOString() });
    return result;
  });
}

function findStage(stages: ProjectStage[], stageId: string): number {
  const index = stages.findIndex((s) => s.id === stageId);
  if (index < 0) throw new HttpError(404, "Etapa não encontrada.");
  return index;
}

/** POST /v1/projects */
export async function createProject(req: Request, res: Response) {
  const parsed = CreateProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
  try {
    const { tenantId, uid } = await requireProjectAccess(req, "canCreate");

    if (parsed.data.proposalId) {
      const proposal = await db.collection("proposals").doc(parsed.data.proposalId).get();
      if (!proposal.exists || proposal.data()?.tenantId !== tenantId) {
        return res.status(404).json({ message: "Proposta não encontrada." });
      }
      // A obra é do que foi vendido: proposta em aberto ainda pode mudar.
      if (!(await isStatusApproved(proposal.data()?.status as string | undefined, tenantId))) {
        return res.status(409).json({ message: "Aprove a proposta antes de criar o projeto da obra." });
      }
      const result = await createProjectFromProposal({
        tenantId,
        proposalId: proposal.id,
        proposal: proposal.data() ?? {},
        uid,
      });
      return res.status(result.created ? 201 : 200).json(result);
    }

    let client = null;
    if (parsed.data.clientId) {
      const snap = await db.collection("clients").doc(parsed.data.clientId).get();
      if (!snap.exists || snap.data()?.tenantId !== tenantId) {
        return res.status(404).json({ message: "Contato não encontrado." });
      }
      const c = snap.data() ?? {};
      client = { id: snap.id, name: String(c.name ?? ""), phone: c.phone, email: c.email, address: c.address };
    }
    const projectId = await createStandaloneProject({
      tenantId,
      title: parsed.data.title ?? "Projeto",
      client,
      uid,
    });
    return res.status(201).json({ projectId, created: true });
  } catch (error) {
    return fail(res, error, "Erro ao criar o projeto.", "project_create_failed");
  }
}

/** PUT /v1/projects/:id */
export async function updateProject(req: Request, res: Response) {
  const parsed = UpdateProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
  try {
    const { tenantId } = await requireProjectAccess(req, "canEdit");
    const found = await loadProjectOfTenant(req.params.id, tenantId);
    if (!found) return res.status(404).json({ message: "Projeto não encontrado." });

    // Ações finas: trocar o técnico ("Atribuir") e cancelar ou reabrir a obra
    // ("Cancelar"). Vale a mudança, não a presença do campo.
    const assigneeChanges =
      parsed.data.assigneeId !== undefined && (parsed.data.assigneeId ?? null) !== (found.data.assigneeId ?? null);
    if (assigneeChanges) await requireProjectAccess(req, "assign");
    const cancelChanges =
      parsed.data.status !== undefined &&
      parsed.data.status !== found.data.status &&
      (parsed.data.status === "canceled" || found.data.status === "canceled");
    if (cancelChanges) await requireProjectAccess(req, "cancel");

    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const key of ["title", "status", "startDate", "dueDate", "notes", "address"] as const) {
      if (parsed.data[key] !== undefined) update[key] = parsed.data[key];
    }
    if (parsed.data.assigneeId !== undefined) {
      if (parsed.data.assigneeId === null) {
        update.assigneeId = null;
        update.assigneeName = null;
      } else {
        // O técnico tem que ser da mesma empresa: senão o projeto apontaria
        // para alguém que nunca vai conseguir abri-lo.
        const member = await db.collection("users").doc(parsed.data.assigneeId).get();
        if (!member.exists || member.data()?.tenantId !== tenantId) {
          return res.status(400).json({ message: "O responsável precisa ser da sua equipe." });
        }
        update.assigneeId = member.id;
        update.assigneeName = (member.data()?.name as string | undefined) ?? null;
      }
    }
    await found.ref.update(update);
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao atualizar o projeto.", "project_update_failed");
  }
}

/** DELETE /v1/projects/:id (apaga as fotos junto) */
export async function deleteProject(req: Request, res: Response) {
  try {
    const { tenantId } = await requireProjectAccess(req, "canDelete");
    const found = await loadProjectOfTenant(req.params.id, tenantId);
    if (!found) return res.status(404).json({ message: "Projeto não encontrado." });

    const stages = (found.data.stages as ProjectStage[]) ?? [];
    const photos = stages.flatMap((s) => s.photos ?? []);
    await found.ref.delete();
    await deleteProjectPhotos(photos.map((p) => p.storagePath));
    // As visitas agendadas da obra saem da Agenda (e do Google) junto.
    for (const eventId of stages.map((s) => s.schedule?.eventId).filter(Boolean) as string[]) {
      await removeScheduleEvent(eventId, tenantId);
    }
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao excluir o projeto.", "project_delete_failed");
  }
}

/** PUT /v1/projects/:id/stages/:stageId */
export async function updateStage(req: Request, res: Response) {
  const parsed = UpdateStageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
  try {
    const { tenantId } = await requireProjectAccess(req, "canEdit");
    const now = new Date().toISOString();
    const stage = await mutateStages(req.params.id, tenantId, (stages) => {
      const index = findStage(stages, req.params.stageId);
      let next = stages[index];
      if (parsed.data.name !== undefined) next = { ...next, name: parsed.data.name };
      if (parsed.data.status !== undefined) next = applyStageStatus(next, parsed.data.status, now);
      const copy = [...stages];
      copy[index] = next;
      return { stages: copy, result: next };
    });
    return res.json({ stage });
  } catch (error) {
    return fail(res, error, "Erro ao atualizar a etapa.", "project_stage_update_failed");
  }
}

/** POST /v1/projects/:id/stages/:stageId/checklist */
export async function addChecklistItem(req: Request, res: Response) {
  const parsed = ChecklistItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
  try {
    const { tenantId } = await requireProjectAccess(req, "canEdit");
    const item = await mutateStages(req.params.id, tenantId, (stages) => {
      const index = findStage(stages, req.params.stageId);
      if (stages[index].checklist.length >= MAX_CHECKLIST_ITEMS) {
        throw new HttpError(400, `Uma etapa tem no máximo ${MAX_CHECKLIST_ITEMS} itens.`);
      }
      const created = { id: randomUUID(), text: parsed.data.text, done: false, doneAt: null, doneBy: null };
      const copy = [...stages];
      copy[index] = { ...copy[index], checklist: [...copy[index].checklist, created] };
      return { stages: copy, result: created };
    });
    return res.status(201).json({ item });
  } catch (error) {
    return fail(res, error, "Erro ao incluir o item.", "project_checklist_add_failed");
  }
}

/** PUT /v1/projects/:id/stages/:stageId/checklist/:itemId */
export async function toggleChecklistItem(req: Request, res: Response) {
  const parsed = ChecklistToggleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
  try {
    const { tenantId, uid } = await requireProjectAccess(req, "canEdit");
    const now = new Date().toISOString();
    const item = await mutateStages(req.params.id, tenantId, (stages) => {
      const index = findStage(stages, req.params.stageId);
      const stage = stages[index];
      const itemIndex = stage.checklist.findIndex((i) => i.id === req.params.itemId);
      if (itemIndex < 0) throw new HttpError(404, "Item não encontrado.");
      const updated = {
        ...stage.checklist[itemIndex],
        done: parsed.data.done,
        doneAt: parsed.data.done ? now : null,
        doneBy: parsed.data.done ? uid : null,
      };
      const checklist = [...stage.checklist];
      checklist[itemIndex] = updated;
      // Marcar o primeiro item de uma etapa pendente a põe em andamento: é o
      // que aconteceu na obra, e poupa um clique que ninguém lembraria de dar.
      const status = stage.status === "pending" && parsed.data.done ? "in_progress" : stage.status;
      const copy = [...stages];
      copy[index] = { ...stage, checklist, status };
      return { stages: copy, result: updated };
    });
    return res.json({ item });
  } catch (error) {
    return fail(res, error, "Erro ao atualizar o item.", "project_checklist_toggle_failed");
  }
}

/** DELETE /v1/projects/:id/stages/:stageId/checklist/:itemId */
export async function deleteChecklistItem(req: Request, res: Response) {
  try {
    const { tenantId } = await requireProjectAccess(req, "canEdit");
    await mutateStages(req.params.id, tenantId, (stages) => {
      const index = findStage(stages, req.params.stageId);
      const stage = stages[index];
      if (!stage.checklist.some((i) => i.id === req.params.itemId)) {
        throw new HttpError(404, "Item não encontrado.");
      }
      const copy = [...stages];
      copy[index] = { ...stage, checklist: stage.checklist.filter((i) => i.id !== req.params.itemId) };
      return { stages: copy, result: null };
    });
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao excluir o item.", "project_checklist_delete_failed");
  }
}

/**
 * POST /v1/projects/:id/stages/:stageId/photos
 *
 * A foto chega já reduzida no navegador (data URL) e sobe pelo backend: o
 * técnico é membro, e as regras do Storage só deixam master e admin gravarem
 * direto. Conta no armazenamento do plano (pasta `projects/`).
 */
export async function uploadStagePhoto(req: Request, res: Response) {
  const parsed = PhotoUploadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
  try {
    const { tenantId, uid } = await requireProjectAccess(req, "canEdit");
    const decoded = decodePhotoDataUrl(parsed.data.dataUrl);
    if (!decoded) {
      return res.status(400).json({ message: "Envie uma foto em JPG, PNG ou WebP de até 700 KB." });
    }
    const found = await loadProjectOfTenant(req.params.id, tenantId);
    if (!found) return res.status(404).json({ message: "Projeto não encontrado." });
    const stage = ((found.data.stages as ProjectStage[]) ?? []).find((s) => s.id === req.params.stageId);
    if (!stage) return res.status(404).json({ message: "Etapa não encontrada." });
    if (stage.photos.length >= MAX_PHOTOS_PER_STAGE) {
      return res.status(400).json({ message: `Uma etapa tem no máximo ${MAX_PHOTOS_PER_STAGE} fotos.` });
    }
    if (await isStorageOverQuota(tenantId)) {
      return res.status(402).json({
        message: "O armazenamento do seu plano está cheio. Libere espaço ou faça upgrade.",
        code: "STORAGE_QUOTA_EXCEEDED",
      });
    }

    const photoId = randomUUID();
    const path = projectPhotoPath(tenantId, req.params.id, req.params.stageId, photoId, decoded.extension);
    const url = await storeProjectPhoto({ path, buffer: decoded.buffer, contentType: decoded.contentType });
    const photo: StagePhoto = {
      id: photoId,
      url,
      storagePath: path,
      caption: parsed.data.caption?.trim() || null,
      uploadedAt: new Date().toISOString(),
      uploadedBy: uid,
      uploadedByName: await userName(uid),
    };

    try {
      await mutateStages(req.params.id, tenantId, (stages) => {
        const index = findStage(stages, req.params.stageId);
        const copy = [...stages];
        copy[index] = { ...copy[index], photos: [...copy[index].photos, photo] };
        return { stages: copy, result: null };
      });
    } catch (error) {
      // A etapa sumiu entre o upload e a gravação: não deixar arquivo órfão.
      await deleteProjectPhotos([path]);
      throw error;
    }
    return res.status(201).json({ photo });
  } catch (error) {
    return fail(res, error, "Erro ao enviar a foto.", "project_photo_upload_failed");
  }
}

/** DELETE /v1/projects/:id/stages/:stageId/photos/:photoId */
export async function deleteStagePhoto(req: Request, res: Response) {
  try {
    const { tenantId } = await requireProjectAccess(req, "canEdit");
    const removed = await mutateStages(req.params.id, tenantId, (stages) => {
      const index = findStage(stages, req.params.stageId);
      const stage = stages[index];
      const photo = stage.photos.find((p) => p.id === req.params.photoId);
      if (!photo) throw new HttpError(404, "Foto não encontrada.");
      const copy = [...stages];
      copy[index] = { ...stage, photos: stage.photos.filter((p) => p.id !== photo.id) };
      return { stages: copy, result: photo };
    });
    await deleteProjectPhotos([removed.storagePath]);
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao excluir a foto.", "project_photo_delete_failed");
  }
}

/** POST /v1/projects/:id/delivery-link */
export async function createDeliveryLink(req: Request, res: Response) {
  try {
    const { tenantId, uid } = await requireProjectAccess(req, "deliveryLink");
    const found = await loadProjectOfTenant(req.params.id, tenantId);
    if (!found) return res.status(404).json({ message: "Projeto não encontrado." });
    const delivery = found.data.delivery as ProjectDelivery | undefined;
    if (delivery?.status === "accepted") {
      return res.status(409).json({ message: "O cliente já aceitou a entrega deste projeto." });
    }

    const link = await createProjectShareLink({ tenantId, projectId: found.ref.id, uid });
    await found.ref.update({
      "delivery.status": "sent",
      "delivery.sharedProjectId": link.sharedProjectId,
      updatedAt: new Date().toISOString(),
    });
    return res.json({ url: link.url });
  } catch (error) {
    return fail(res, error, "Erro ao gerar o link de entrega.", "project_delivery_link_failed");
  }
}

/**
 * POST /v1/projects/:id/items/import
 *
 * Traz os produtos da proposta para um projeto que nasceu antes da lista de
 * itens existir. Lê a proposta pelo Admin SDK e grava só os campos sem valor
 * (`buildProjectItemsFromProposal`): é o que deixa o técnico, que não vê
 * propostas, ter a lista do que instalar. Só preenche lista vazia; nunca
 * sobrescreve o andamento já marcado.
 */
export async function importProjectItems(req: Request, res: Response) {
  try {
    const { tenantId } = await requireProjectAccess(req, "canEdit");
    const ref = db.collection(PROJECTS_COLLECTION).doc(req.params.id);
    const count = await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      const data = snap.data();
      if (!snap.exists || data?.tenantId !== tenantId) throw new HttpError(404, "Projeto não encontrado.");
      if (Array.isArray(data.items) && data.items.length > 0) {
        throw new HttpError(409, "Este projeto já tem a lista de itens.");
      }
      const proposalId = typeof data.proposalId === "string" ? data.proposalId : "";
      if (!proposalId) throw new HttpError(400, "Este projeto não veio de uma proposta.");
      const proposalSnap = await t.get(db.collection("proposals").doc(proposalId));
      const proposal = proposalSnap.data();
      if (!proposalSnap.exists || proposal?.tenantId !== tenantId) {
        throw new HttpError(404, "A proposta deste projeto não foi encontrada.");
      }
      const items = buildProjectItemsFromProposal(proposal);
      t.update(ref, { items, updatedAt: new Date().toISOString() });
      return items.length;
    });
    return res.json({ count });
  } catch (error) {
    return fail(res, error, "Erro ao trazer os itens da proposta.", "project_items_import_failed");
  }
}

/**
 * PUT /v1/projects/:id/items/status
 *
 * Marca um ou vários itens (compra solicitada, em estoque, instalado). Status
 * manual: não mexe em estoque nem no financeiro. Pede editar Projetos, que o
 * técnico tem.
 */
export async function updateProjectItemsStatus(req: Request, res: Response) {
  const parsed = UpdateItemsStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
  try {
    const { tenantId, uid } = await requireProjectAccess(req, "canEdit");
    const actor = { uid, name: await userName(uid), now: new Date().toISOString() };
    const ref = db.collection(PROJECTS_COLLECTION).doc(req.params.id);
    const changed = await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      const data = snap.data();
      if (!snap.exists || data?.tenantId !== tenantId) throw new HttpError(404, "Projeto não encontrado.");
      const items = Array.isArray(data.items) ? (data.items as ProjectItem[]) : [];
      const applied = applyItemsStatus(items, parsed.data.itemIds, parsed.data.status, actor);
      if (applied.missing.length > 0) throw new HttpError(404, "Item não encontrado.");
      if (applied.changed > 0) t.update(ref, { items: applied.items, updatedAt: actor.now });
      return applied.changed;
    });
    return res.json({ changed });
  } catch (error) {
    return fail(res, error, "Erro ao atualizar os itens.", "project_items_status_failed");
  }
}

const CALENDAR_EVENTS_COLLECTION = "calendar_events";
/** Mesma cor para toda visita de obra, entre as seis da Agenda. */
const SCHEDULE_EVENT_COLOR = "#0891b2";
const SCHEDULE_VALIDATION_ERRORS = new Set([
  "TITLE_REQUIRED",
  "TITLE_TOO_LONG",
  "INVALID_DATE",
  "INVALID_DATETIME",
  "INVALID_DATE_RANGE",
  "INVALID_TIME_RANGE",
]);

/** Apaga o evento de uma visita (e a cópia no Google), se ainda for do tenant. */
async function removeScheduleEvent(eventId: string, tenantId: string): Promise<void> {
  const ref = db.collection(CALENDAR_EVENTS_COLLECTION).doc(eventId);
  const snap = await ref.get();
  const data = snap.data() as CalendarEventDocument | undefined;
  if (!snap.exists || data?.tenantId !== tenantId) return;
  await deleteEventFromGoogleIfNeeded(data);
  await ref.delete();
}

function formatVisitWhen(schedule: StageSchedule): string {
  if (schedule.isAllDay && schedule.startDate) {
    const [y, m, d] = schedule.startDate.split("-");
    return `${d}/${m}/${y}`;
  }
  return new Date(schedule.startMs).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * PUT /v1/projects/:id/stages/:stageId/schedule
 *
 * Agenda (ou remarca) a etapa: cria ou atualiza o evento da Agenda ligado a
 * ela e grava o espelho na etapa. Pede editar Projetos, não a Agenda: é quem
 * cuida da obra que marca a visita.
 */
export async function scheduleStage(req: Request, res: Response) {
  const parsed = ScheduleStageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
  try {
    const { tenantId, uid } = await requireProjectAccess(req, "schedule");
    const found = await loadProjectOfTenant(req.params.id, tenantId);
    if (!found) return res.status(404).json({ message: "Projeto não encontrado." });
    const project = found.data;
    const stages = (project.stages as ProjectStage[]) ?? [];
    const stage = stages[findStage(stages, req.params.stageId)];

    const previous = stage.schedule ?? null;
    let existing: CalendarEventDocument | undefined;
    if (previous?.eventId) {
      const snap = await db.collection(CALENDAR_EVENTS_COLLECTION).doc(previous.eventId).get();
      const data = snap.data() as CalendarEventDocument | undefined;
      if (snap.exists && data?.tenantId === tenantId) existing = data;
    }
    const eventRef =
      existing && previous
        ? db.collection(CALENDAR_EVENTS_COLLECTION).doc(previous.eventId)
        : db.collection(CALENDAR_EVENTS_COLLECTION).doc();

    let event: CalendarEventDocument;
    try {
      event = buildCalendarEventDocument({
        input: {
          ...parsed.data,
          title: scheduleEventTitle(stage.name, String(project.title ?? "Obra")),
          description: scheduleEventDescription({
            clientName: project.clientName as string | null,
            clientPhone: project.clientPhone as string | null,
            assigneeName: project.assigneeName as string | null,
            projectUrl: new URL(`/projects/${found.ref.id}`, resolveFrontendAppOrigin()).toString(),
          }),
          location: (project.address as string | null) ?? null,
          status: "scheduled",
          color: existing?.color ?? SCHEDULE_EVENT_COLOR,
        },
        tenantId,
        ownerUserId: existing?.ownerUserId ?? uid,
        actingUserId: uid,
        existing,
        links: { projectId: found.ref.id, projectStageId: stage.id },
      });
    } catch (error) {
      if (error instanceof Error && SCHEDULE_VALIDATION_ERRORS.has(error.message)) {
        return res.status(400).json({ message: getValidationMessage(error) });
      }
      throw error;
    }

    const googleSync = await syncEventToGoogle(eventRef.id, event);
    await eventRef.set({ ...event, googleSync }, { merge: false });

    const schedule = stageScheduleFromEvent(eventRef.id, event);
    await mutateStages(found.ref.id, tenantId, (current) => {
      const index = findStage(current, stage.id);
      const copy = [...current];
      copy[index] = { ...current[index], schedule };
      return { stages: copy, result: null };
    });

    const assigneeId = project.assigneeId as string | null;
    if (schedule && assigneeId && assigneeId !== uid && scheduleChanged(previous, schedule)) {
      try {
        const actor = (await userName(uid)) ?? "Alguém da equipe";
        await NotificationService.createNotification({
          tenantId,
          type: "project_visit_scheduled",
          title: previous ? "Visita remarcada" : "Visita agendada",
          message: `${actor} marcou ${stage.name} em ${String(project.title ?? "Obra")} para ${formatVisitWhen(schedule)}.`,
          projectId: found.ref.id,
          targetUids: [assigneeId],
        });
      } catch (error) {
        logger.warn("project_schedule_notify_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return res.json({ schedule });
  } catch (error) {
    return fail(res, error, "Erro ao agendar a etapa.", "project_stage_schedule_failed");
  }
}

/** DELETE /v1/projects/:id/stages/:stageId/schedule: desmarca a visita. */
export async function unscheduleStage(req: Request, res: Response) {
  try {
    const { tenantId } = await requireProjectAccess(req, "schedule");
    const eventId = await mutateStages(req.params.id, tenantId, (current) => {
      const index = findStage(current, req.params.stageId);
      const copy = [...current];
      const removed = current[index].schedule?.eventId ?? null;
      copy[index] = { ...current[index], schedule: null };
      return { stages: copy, result: removed };
    });
    if (eventId) await removeScheduleEvent(eventId, tenantId);
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao desmarcar a visita.", "project_stage_unschedule_failed");
  }
}

/**
 * GET /v1/projects/assignees — quem pode ser o técnico responsável: a equipe
 * da empresa. Pela API porque as regras do Firestore só deixam o admin listar
 * os usuários, e quem monta a obra no dia a dia costuma ser membro.
 */
export async function listProjectAssignees(req: Request, res: Response) {
  try {
    const { tenantId } = await requireProjectAccess(req, "canView");
    const snap = await db.collection("users").where("tenantId", "==", tenantId).limit(200).get();
    const assignees = snap.docs
      .map((doc) => ({ id: doc.id, name: String(doc.data().name || doc.data().email || "Sem nome") }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return res.json({ assignees });
  } catch (error) {
    return fail(res, error, "Erro ao carregar a equipe.", "project_assignees_failed");
  }
}

/**
 * O que a tela da obra precisa da proposta para registrar os aparelhos
 * instalados: as linhas de produto (nome, fabricante, quantidade e ambiente)
 * e os nomes dos ambientes. Sem preço nenhum.
 *
 * Pela API porque as rules só deixam ler a proposta a quem vê Propostas ou o
 * CRM, e quem registra os equipamentos da obra costuma ser o técnico.
 */
function equipmentSourceFromProposal(proposal: Record<string, unknown>) {
  const asRecords = (value: unknown): Record<string, unknown>[] =>
    Array.isArray(value) ? value.filter((v): v is Record<string, unknown> => !!v && typeof v === "object") : [];
  const text = (value: unknown) => (typeof value === "string" ? value : undefined);

  const products = asRecords(proposal.products).map((line) => ({
    itemType: text(line.itemType),
    status: text(line.status),
    _isInactive: line._isInactive === true ? true : undefined,
    quantity: typeof line.quantity === "number" ? line.quantity : Number(line.quantity) || undefined,
    productName: text(line.productName),
    name: text(line.name),
    manufacturer: text(line.manufacturer),
    ambienteInstanceId: text(line.ambienteInstanceId),
  }));
  const sistemas = asRecords(proposal.sistemas).map((sistema) => ({
    sistemaId: text(sistema.sistemaId),
    ambientes: asRecords(sistema.ambientes).map((ambiente) => ({
      ambienteId: text(ambiente.ambienteId),
      ambienteName: text(ambiente.ambienteName),
    })),
  }));
  return { products, sistemas };
}

/** GET /v1/projects/:id/proposal-equipment */
export async function getProjectProposalEquipment(req: Request, res: Response) {
  try {
    const { tenantId } = await requireProjectAccess(req, "canView");
    if (!(await hasPagePermission(req.user, "equipment", "canCreate"))) {
      throw new HttpError(403, "Sem permissão para registrar equipamentos.");
    }
    const project = await loadProjectOfTenant(String(req.params.id), tenantId);
    if (!project) throw new HttpError(404, "Projeto não encontrado.");

    const proposalId = typeof project.data.proposalId === "string" ? project.data.proposalId : "";
    if (!proposalId) return res.json({ products: [], sistemas: [] });

    const proposal = await db.collection("proposals").doc(proposalId).get();
    if (!proposal.exists || proposal.data()?.tenantId !== tenantId) {
      return res.json({ products: [], sistemas: [] });
    }
    return res.json(equipmentSourceFromProposal(proposal.data() ?? {}));
  } catch (error) {
    return fail(res, error, "Erro ao carregar os itens da proposta.", "project_proposal_equipment_failed");
  }
}

/** GET /v1/projects/settings */
export async function getProjectSettings(req: Request, res: Response) {
  try {
    const { tenantId } = await requireProjectAccess(req, "canView");
    return res.json({ settings: await loadProjectSettings(tenantId) });
  } catch (error) {
    return fail(res, error, "Erro ao carregar as configurações.", "project_settings_get_failed");
  }
}

/** PUT /v1/projects/settings (só administrador da empresa) */
export async function updateProjectSettings(req: Request, res: Response) {
  const parsed = ProjectSettingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
  try {
    const tenantId = req.user?.tenantId;
    const uid = req.user?.uid;
    if (!tenantId || !uid) return res.status(403).json({ message: "Tenant não identificado." });
    if (!isTenantAdminRole(String(req.user?.role || "").toUpperCase())) {
      return res.status(403).json({ message: "Só o administrador da empresa altera as configurações." });
    }
    const settings = await saveProjectSettings(tenantId, parsed.data, uid);
    return res.json({ settings });
  } catch (error) {
    return fail(res, error, "Erro ao salvar as configurações.", "project_settings_update_failed");
  }
}
