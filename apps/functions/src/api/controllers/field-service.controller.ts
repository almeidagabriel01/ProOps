import { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../../init";
import { logger } from "../../lib/logger";
import { hasPagePermission } from "../../lib/auth-helpers";
import { isTenantAdminRole } from "../../lib/auth-context";
import { resolveClientIp } from "../../lib/client-ip";
import { tenantHasCapability } from "../../lib/tenant-capabilities";
import { buildPdfContentDisposition, buildPdfFilename } from "../services/pdf-filename";
import { decodePhotoDataUrl } from "../services/projects/project-model";
import { isStorageOverQuota } from "../services/projects/project.service";
import { NotificationService } from "../services/notification.service";
import { TransactionService } from "../services/transaction.service";
import { validateTransactionData, type CreateTransactionDTO } from "../helpers/transaction-validation";
import { resolveFrontendAppOrigin } from "../../lib/frontend-app-url";
import {
  buildCalendarEventDocument,
  deleteEventFromGoogleIfNeeded,
  syncEventToGoogle,
  type CalendarEventDocument,
} from "./calendar.controller";
import {
  CompleteServiceOrderSchema,
  CreateServiceOrderSchema,
  EQUIPMENT_COLLECTION,
  EquipmentBatchSchema,
  EquipmentSchema,
  ExecutionUpdateSchema,
  LaunchTransactionSchema,
  MAX_ORDER_PHOTOS,
  PhotoUploadSchema,
  ReopenServiceOrderSchema,
  SERVICE_ORDERS_COLLECTION,
  SERVICE_ORDER_INCOME_CATEGORY,
  ServiceOrderStatusSchema,
  UpdateEquipmentSchema,
  UpdateServiceOrderSchema,
  canTransition,
  computeOrderTotals,
  decodeSignatureDataUrl,
  isClosedStatus,
  signatureContentHash,
  type ServiceOrderItem,
  type ServiceOrderPhoto,
  type ServiceOrderSignature,
  type ServiceOrderStatus,
} from "../services/field-service/field-service-model";
import {
  allocateOrderNumber,
  buildOrderShareUrl,
  deleteOrderFiles,
  ensureOrderShareToken,
  generateOrderPdf,
  loadClientSnapshot,
  loadEquipmentLabels,
  loadOfTenant,
  loadTechnician,
  orderFilePath,
  resolveOrderShareToken,
  storeOrderFile,
  syncOrderStock,
  toClientOrderView,
} from "../services/field-service/field-service.service";

/**
 * Equipamentos do cliente e ordens de serviço. Capacidade `fieldService`,
 * montada por prefixo em `field-service.routes.ts`; permissões `equipment`,
 * `service_orders` e o escopo `service_orders_all`. O tenant vem sempre de
 * `req.user.tenantId`. Listas e detalhes são lidos direto no Firestore pelo
 * front (a conta de demonstração lê o tenant de exemplo); aqui ficam as
 * escritas.
 */

type Action = "canView" | "canCreate" | "canEdit" | "canDelete";

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message || "Dados inválidos.";
}

function fail(res: Response, error: unknown, fallback: string, event: string) {
  if (error instanceof HttpError) return res.status(error.status).json({ message: error.message });
  logger.error(event, { error: error instanceof Error ? error.message : String(error) });
  return res.status(500).json({ message: fallback });
}

async function requireAccess(
  req: Request,
  pageId: "equipment" | "service_orders",
  action: Action,
): Promise<{ tenantId: string; uid: string }> {
  const tenantId = req.user?.tenantId;
  const uid = req.user?.uid;
  if (!tenantId || !uid) throw new HttpError(403, "Tenant não identificado.");
  if (!(await hasPagePermission(req.user, pageId, action))) {
    const modulo = pageId === "equipment" ? "Equipamentos" : "Ordens de serviço";
    throw new HttpError(403, `Sem permissão para esta ação em ${modulo}.`);
  }
  return { tenantId, uid };
}

/**
 * Quem enxerga a equipe inteira (master, admin ou membro com
 * `service_orders_all`) mexe em qualquer OS. O técnico, só nas atribuídas a
 * ele: é a mesma regra que o Firestore aplica na leitura.
 */
async function seesAllOrders(req: Request): Promise<boolean> {
  return hasPagePermission(req.user, "service_orders_all", "canView");
}

async function loadOrderForUser(req: Request, tenantId: string, uid: string) {
  const found = await loadOfTenant(SERVICE_ORDERS_COLLECTION, req.params.id, tenantId);
  if (!found) throw new HttpError(404, "Ordem de serviço não encontrada.");
  const all = await seesAllOrders(req);
  const assigned = ((found.data.technicianUids as string[] | undefined) ?? []).includes(uid);
  if (!all && !assigned) throw new HttpError(404, "Ordem de serviço não encontrada.");
  return { ...found, seesAll: all };
}

function orderStatus(data: Record<string, unknown>): ServiceOrderStatus {
  return (data.status as ServiceOrderStatus) ?? "open";
}

function assertEditable(data: Record<string, unknown>) {
  if (isClosedStatus(orderStatus(data))) {
    throw new HttpError(409, "Esta OS está encerrada. Reabra para alterar.");
  }
}

// ---------------------------------------------------------------------------
// Agenda e aviso ao técnico
// ---------------------------------------------------------------------------

const CALENDAR_EVENTS_COLLECTION = "calendar_events";
/** Uma das seis cores da Agenda: toda visita de OS sai igual. */
const ORDER_EVENT_COLOR = "#7c3aed";

function formatVisit(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadOrderEvent(eventId: string | null, tenantId: string, orderId: string) {
  if (!eventId) return null;
  const snap = await db.collection(CALENDAR_EVENTS_COLLECTION).doc(eventId).get();
  const data = snap.data() as CalendarEventDocument | undefined;
  if (!snap.exists || data?.tenantId !== tenantId || data.serviceOrderId !== orderId) return null;
  return { ref: snap.ref, data };
}

async function removeOrderEvent(eventId: string | null, tenantId: string, orderId: string) {
  const event = await loadOrderEvent(eventId, tenantId, orderId);
  if (!event) return;
  await deleteEventFromGoogleIfNeeded(event.data);
  await event.ref.delete();
}

/**
 * Leva a OS para a Agenda: agendada e aberta, ela tem um evento (criado ou
 * atualizado); sem data ou encerrada, o evento sai. A data mora no evento, e
 * mover o evento na Agenda volta para a OS pelo espelho
 * (`order-schedule-store.ts`). Falhar aqui não desfaz a OS: a data dela já
 * foi gravada, e o próximo salvamento tenta de novo.
 */
async function syncOrderAgenda(orderId: string, tenantId: string, uid: string): Promise<void> {
  try {
    const ref = db.collection(SERVICE_ORDERS_COLLECTION).doc(orderId);
    const order = (await ref.get()).data();
    if (!order || order.tenantId !== tenantId) return;
    const eventId = (order.calendarEventId as string | null) ?? null;
    const wantsEvent = Boolean(order.scheduledStart && order.scheduledEnd) && !isClosedStatus(orderStatus(order));

    if (!wantsEvent) {
      await removeOrderEvent(eventId, tenantId, orderId);
      if (eventId) await ref.update({ calendarEventId: null });
      return;
    }

    const existing = await loadOrderEvent(eventId, tenantId, orderId);
    const eventRef = existing?.ref ?? db.collection(CALENDAR_EVENTS_COLLECTION).doc();
    const description = [
      `Cliente: ${String(order.clientName ?? "")}`,
      order.clientPhone ? `Telefone: ${String(order.clientPhone)}` : null,
      order.technicianName ? `Técnico: ${String(order.technicianName)}` : null,
      `OS: ${new URL(`/service-orders/${orderId}`, resolveFrontendAppOrigin()).toString()}`,
    ].filter(Boolean);
    const event = buildCalendarEventDocument({
      input: {
        title: `${String(order.code ?? "OS")}: ${String(order.title ?? "")}`.slice(0, 140),
        description: description.join("\n"),
        location: (order.address as string | null) ?? null,
        status: "scheduled",
        color: existing?.data.color ?? ORDER_EVENT_COLOR,
        isAllDay: false,
        startsAt: order.scheduledStart,
        endsAt: order.scheduledEnd,
      },
      tenantId,
      ownerUserId: existing?.data.ownerUserId ?? (order.technicianUids as string[] | undefined)?.[0] ?? uid,
      actingUserId: uid,
      existing: existing?.data,
      links: { serviceOrderId: orderId },
    });
    const googleSync = await syncEventToGoogle(eventRef.id, event);
    await eventRef.set({ ...event, googleSync }, { merge: false });
    if (eventId !== eventRef.id) await ref.update({ calendarEventId: eventRef.id });
  } catch (error) {
    logger.warn("service_order_agenda_sync_failed", {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Avisa o técnico quando a OS passa a ser dele ou quando a data dela muda.
 * Quem fez a mudança nunca é avisado de si mesmo.
 */
async function notifyTechnician(params: {
  tenantId: string;
  orderId: string;
  uid: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
}): Promise<void> {
  const technician = (params.after.technicianUids as string[] | undefined)?.[0];
  if (!technician || technician === params.uid) return;
  const previous = (params.before?.technicianUids as string[] | undefined)?.[0];
  const start = (params.after.scheduledStart as string | null) ?? null;
  const assigned = technician !== previous;
  const rescheduled = !assigned && Boolean(start) && start !== ((params.before?.scheduledStart as string | null) ?? null);
  if (!assigned && !rescheduled) return;
  const code = String(params.after.code ?? "OS");
  const when = start ? ` para ${formatVisit(start)}` : "";
  try {
    await NotificationService.createNotification({
      tenantId: params.tenantId,
      type: "service_order_assigned",
      title: assigned ? `${code} passou para você` : `${code} remarcada`,
      message: assigned
        ? `${String(params.after.title ?? "")}, em ${String(params.after.clientName ?? "")}${when}.`
        : `${String(params.after.title ?? "")} ficou${when}.`,
      serviceOrderId: params.orderId,
      targetUids: [technician],
    });
  } catch (error) {
    logger.warn("service_order_notify_failed", { error: error instanceof Error ? error.message : String(error) });
  }
}

// ---------------------------------------------------------------------------
// Equipamentos
// ---------------------------------------------------------------------------

/** POST /v1/equipment */
export async function createEquipment(req: Request, res: Response) {
  const parsed = EquipmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
  try {
    const { tenantId, uid } = await requireAccess(req, "equipment", "canCreate");
    const client = await loadClientSnapshot(parsed.data.clientId, tenantId);
    if (!client) return res.status(404).json({ message: "Contato não encontrado." });

    const now = new Date().toISOString();
    const ref = db.collection(EQUIPMENT_COLLECTION).doc();
    await ref.set({
      tenantId,
      clientId: client.id,
      clientName: client.name,
      name: parsed.data.name,
      type: parsed.data.type ?? null,
      brand: parsed.data.brand ?? null,
      model: parsed.data.model ?? null,
      serialNumber: parsed.data.serialNumber ?? null,
      capacity: parsed.data.capacity ?? null,
      location: parsed.data.location ?? null,
      installedAt: parsed.data.installedAt ?? null,
      warrantyUntil: parsed.data.warrantyUntil ?? null,
      notes: parsed.data.notes ?? null,
      status: parsed.data.status ?? "active",
      projectId: parsed.data.projectId ?? null,
      lastServiceAt: null,
      lastServiceOrderId: null,
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
    });
    return res.status(201).json({ id: ref.id });
  } catch (error) {
    return fail(res, error, "Erro ao cadastrar o equipamento.", "equipment_create_failed");
  }
}

/** PUT /v1/equipment/:id */
export async function updateEquipment(req: Request, res: Response) {
  const parsed = UpdateEquipmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
  try {
    const { tenantId } = await requireAccess(req, "equipment", "canEdit");
    const found = await loadOfTenant(EQUIPMENT_COLLECTION, req.params.id, tenantId);
    if (!found) return res.status(404).json({ message: "Equipamento não encontrado." });

    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [key, value] of Object.entries(parsed.data)) {
      if (key !== "clientId" && value !== undefined) update[key] = value;
    }
    if (parsed.data.clientId && parsed.data.clientId !== found.data.clientId) {
      const client = await loadClientSnapshot(parsed.data.clientId, tenantId);
      if (!client) return res.status(404).json({ message: "Contato não encontrado." });
      update.clientId = client.id;
      update.clientName = client.name;
    }
    await found.ref.update(update);
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao atualizar o equipamento.", "equipment_update_failed");
  }
}

/** DELETE /v1/equipment/:id. As OS antigas guardam o nome do aparelho e não quebram. */
export async function deleteEquipment(req: Request, res: Response) {
  try {
    const { tenantId } = await requireAccess(req, "equipment", "canDelete");
    const found = await loadOfTenant(EQUIPMENT_COLLECTION, req.params.id, tenantId);
    if (!found) return res.status(404).json({ message: "Equipamento não encontrado." });
    await found.ref.delete();
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao excluir o equipamento.", "equipment_delete_failed");
  }
}

// ---------------------------------------------------------------------------
// Ordens de serviço
// ---------------------------------------------------------------------------

/**
 * GET /v1/service-orders/technicians
 *
 * A equipe que pode receber uma OS. Pede ver OS, não a tela de Equipe: é quem
 * coordena o chamado que escolhe o técnico.
 */
export async function listTechnicians(req: Request, res: Response) {
  try {
    const { tenantId } = await requireAccess(req, "service_orders", "canView");
    const snap = await db.collection("users").where("tenantId", "==", tenantId).limit(200).get();
    const technicians = snap.docs
      .map((doc) => ({ id: doc.id, name: String(doc.data().name || doc.data().email || "Sem nome") }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return res.json({ technicians });
  } catch (error) {
    return fail(res, error, "Erro ao carregar a equipe.", "service_order_technicians_failed");
  }
}

async function resolveTechnician(technicianId: string | null | undefined, tenantId: string) {
  if (!technicianId) return { technicianUids: [] as string[], technicianName: null as string | null };
  const technician = await loadTechnician(technicianId, tenantId);
  if (!technician) throw new HttpError(400, "O técnico precisa ser da sua equipe.");
  return { technicianUids: [technician.uid], technicianName: technician.name || null };
}

function validateSchedule(start: string | null | undefined, end: string | null | undefined) {
  if (start && end && Date.parse(end) <= Date.parse(start)) {
    throw new HttpError(400, "O fim do atendimento precisa ser depois do início.");
  }
}

/** POST /v1/service-orders */
export async function createServiceOrder(req: Request, res: Response) {
  const parsed = CreateServiceOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
  try {
    const { tenantId, uid } = await requireAccess(req, "service_orders", "canCreate");
    const input = parsed.data;
    const client = await loadClientSnapshot(input.clientId, tenantId);
    if (!client) return res.status(404).json({ message: "Contato não encontrado." });

    const equipment = await loadEquipmentLabels(input.equipmentIds ?? [], tenantId, client.id);
    if (!equipment) return res.status(400).json({ message: "Escolha equipamentos deste cliente." });
    const technician = await resolveTechnician(input.technicianId, tenantId);
    validateSchedule(input.scheduledStart, input.scheduledEnd);

    const items = input.items ?? [];
    const now = new Date().toISOString();
    const ref = db.collection(SERVICE_ORDERS_COLLECTION).doc();
    const code = await db.runTransaction(async (t) => {
      const allocated = await allocateOrderNumber(t, tenantId);
      t.set(ref, {
        tenantId,
        number: allocated.number,
        code: allocated.code,
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        address: input.address ?? client.address,
        type: input.type,
        priority: input.priority ?? "normal",
        status: input.scheduledStart ? "scheduled" : "open",
        title: input.title,
        description: input.description ?? null,
        equipmentIds: equipment.map((e) => e.id),
        equipmentLabels: equipment.map((e) => e.label),
        projectId: input.projectId ?? null,
        ...technician,
        scheduledStart: input.scheduledStart ?? null,
        scheduledEnd: input.scheduledEnd ?? null,
        checklist: input.checklist ?? [],
        items,
        totals: computeOrderTotals(items),
        photos: [],
        report: null,
        checkInAt: null,
        checkOutAt: null,
        signature: null,
        noSignatureReason: null,
        stockApplied: {},
        stockRevision: 0,
        completedAt: null,
        canceledAt: null,
        reopenLog: [],
        createdAt: now,
        updatedAt: now,
        createdBy: uid,
      });
      return allocated.code;
    });
    if (input.scheduledStart) await syncOrderAgenda(ref.id, tenantId, uid);
    const created = (await ref.get()).data();
    if (created) await notifyTechnician({ tenantId, orderId: ref.id, uid, before: null, after: created });
    return res.status(201).json({ id: ref.id, code });
  } catch (error) {
    return fail(res, error, "Erro ao abrir a ordem de serviço.", "service_order_create_failed");
  }
}

/**
 * PUT /v1/service-orders/:id
 *
 * Quem coordena edita tudo; o técnico, só a execução (checklist, peças e
 * relatório). Um campo de coordenação vindo de um técnico é recusado, não
 * ignorado: ignorar esconderia do técnico que a mudança não valeu.
 */
export async function updateServiceOrder(req: Request, res: Response) {
  try {
    const { tenantId, uid } = await requireAccess(req, "service_orders", "canEdit");
    const found = await loadOrderForUser(req, tenantId, uid);
    assertEditable(found.data);

    const schema = found.seesAll ? UpdateServiceOrderSchema : ExecutionUpdateSchema;
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const onlyExecution = !found.seesAll && UpdateServiceOrderSchema.safeParse(req.body).success;
      return res.status(onlyExecution ? 403 : 400).json({
        message: onlyExecution
          ? "O técnico altera só o checklist, as peças e o relatório."
          : firstIssue(parsed.error),
      });
    }
    const input = parsed.data as Record<string, unknown>;
    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    for (const key of ["type", "priority", "title", "description", "address", "projectId", "checklist", "report"]) {
      if (input[key] !== undefined) update[key] = input[key];
    }
    if (input.items !== undefined) {
      update.items = input.items;
      update.totals = computeOrderTotals(input.items as ServiceOrderItem[]);
    }

    let clientId = String(found.data.clientId);
    if (typeof input.clientId === "string" && input.clientId !== clientId) {
      const client = await loadClientSnapshot(input.clientId, tenantId);
      if (!client) return res.status(404).json({ message: "Contato não encontrado." });
      clientId = client.id;
      Object.assign(update, { clientId, clientName: client.name, clientPhone: client.phone });
      if (input.address === undefined) update.address = client.address;
      // Os equipamentos eram do cliente anterior.
      if (input.equipmentIds === undefined) Object.assign(update, { equipmentIds: [], equipmentLabels: [] });
    }
    if (input.equipmentIds !== undefined) {
      const equipment = await loadEquipmentLabels(input.equipmentIds as string[], tenantId, clientId);
      if (!equipment) return res.status(400).json({ message: "Escolha equipamentos deste cliente." });
      Object.assign(update, {
        equipmentIds: equipment.map((e) => e.id),
        equipmentLabels: equipment.map((e) => e.label),
      });
    }
    if (input.technicianId !== undefined) {
      Object.assign(update, await resolveTechnician(input.technicianId as string | null, tenantId));
    }
    if (input.scheduledStart !== undefined || input.scheduledEnd !== undefined) {
      const start = (input.scheduledStart as string | null | undefined) ?? (found.data.scheduledStart as string | null);
      const end = (input.scheduledEnd as string | null | undefined) ?? (found.data.scheduledEnd as string | null);
      validateSchedule(start, end);
      update.scheduledStart = input.scheduledStart !== undefined ? input.scheduledStart : found.data.scheduledStart;
      update.scheduledEnd = input.scheduledEnd !== undefined ? input.scheduledEnd : found.data.scheduledEnd;
      const status = orderStatus(found.data);
      if (status === "open" && update.scheduledStart) update.status = "scheduled";
      if (status === "scheduled" && !update.scheduledStart) update.status = "open";
    }

    await found.ref.update(update);
    const agendaFields = ["scheduledStart", "scheduledEnd", "technicianUids", "title", "address", "clientId"];
    if (agendaFields.some((key) => key in update)) {
      await syncOrderAgenda(found.ref.id, tenantId, uid);
      await notifyTechnician({ tenantId, orderId: found.ref.id, uid, before: found.data, after: { ...found.data, ...update } });
    }
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao atualizar a ordem de serviço.", "service_order_update_failed");
  }
}

/**
 * POST /v1/service-orders/:id/status
 *
 * Iniciar o atendimento registra a chegada (`checkInAt`). Cancelar é de quem
 * coordena, e uma OS cancelada devolve ao estoque o que tinha tirado.
 */
export async function changeServiceOrderStatus(req: Request, res: Response) {
  const parsed = ServiceOrderStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
  try {
    const { tenantId, uid } = await requireAccess(req, "service_orders", "canEdit");
    const found = await loadOrderForUser(req, tenantId, uid);
    const target = parsed.data.status;
    if (target === "canceled" && !found.seesAll) {
      return res.status(403).json({ message: "Só quem coordena as OS pode cancelar." });
    }

    const result = await db.runTransaction(async (t) => {
      const snap = await t.get(found.ref);
      const data = snap.data() ?? {};
      const from = orderStatus(data);
      if (!canTransition(from, target)) {
        throw new HttpError(409, "Esta mudança de status não é permitida.");
      }
      const now = new Date().toISOString();
      const update: Record<string, unknown> = { status: target, updatedAt: now };
      if (target === "in_progress" && !data.checkInAt) update.checkInAt = now;
      if (target === "canceled") {
        update.canceledAt = now;
        const revision = Number(data.stockRevision ?? 0) + 1;
        const stock = await syncOrderStock({
          t,
          tenantId,
          orderId: found.ref.id,
          orderCode: String(data.code ?? ""),
          revision,
          items: (data.items as ServiceOrderItem[]) ?? [],
          applied: (data.stockApplied as Record<string, number>) ?? {},
          uid,
          now,
          release: true,
        });
        update.stockApplied = stock.applied;
        update.stockRevision = revision;
      }
      if (from === "canceled") update.canceledAt = null;
      t.update(found.ref, update);
      return update;
    });
    // Cancelar tira a visita da Agenda; reabrir uma cancelada com data a devolve.
    if (target === "canceled" || found.data.status === "canceled") {
      await syncOrderAgenda(found.ref.id, tenantId, uid);
    }
    return res.json({ success: true, status: result.status });
  } catch (error) {
    return fail(res, error, "Erro ao mudar o status da OS.", "service_order_status_failed");
  }
}

/** POST /v1/service-orders/:id/photos */
export async function uploadServiceOrderPhoto(req: Request, res: Response) {
  const parsed = PhotoUploadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
  try {
    const { tenantId, uid } = await requireAccess(req, "service_orders", "canEdit");
    const decoded = decodePhotoDataUrl(parsed.data.dataUrl);
    if (!decoded) return res.status(400).json({ message: "Envie uma foto em JPG, PNG ou WebP de até 700 KB." });
    const found = await loadOrderForUser(req, tenantId, uid);
    assertEditable(found.data);
    if (((found.data.photos as ServiceOrderPhoto[]) ?? []).length >= MAX_ORDER_PHOTOS) {
      return res.status(400).json({ message: `Uma OS tem no máximo ${MAX_ORDER_PHOTOS} fotos.` });
    }
    if (await isStorageOverQuota(tenantId)) {
      return res.status(402).json({
        message: "O armazenamento do seu plano está cheio. Libere espaço ou faça upgrade.",
        code: "STORAGE_QUOTA_EXCEEDED",
      });
    }

    const photoId = randomUUID();
    const path = orderFilePath(tenantId, found.ref.id, `${photoId}.${decoded.extension}`);
    const url = await storeOrderFile({ path, buffer: decoded.buffer, contentType: decoded.contentType });
    const photo: ServiceOrderPhoto = {
      id: photoId,
      url,
      storagePath: path,
      caption: parsed.data.caption?.trim() || null,
      uploadedAt: new Date().toISOString(),
      uploadedBy: uid,
    };
    try {
      await db.runTransaction(async (t) => {
        const snap = await t.get(found.ref);
        const photos = (snap.data()?.photos as ServiceOrderPhoto[]) ?? [];
        t.update(found.ref, { photos: [...photos, photo], updatedAt: photo.uploadedAt });
      });
    } catch (error) {
      await deleteOrderFiles([path]);
      throw error;
    }
    return res.status(201).json({ photo });
  } catch (error) {
    return fail(res, error, "Erro ao enviar a foto.", "service_order_photo_upload_failed");
  }
}

/** DELETE /v1/service-orders/:id/photos/:photoId */
export async function deleteServiceOrderPhoto(req: Request, res: Response) {
  try {
    const { tenantId, uid } = await requireAccess(req, "service_orders", "canEdit");
    const found = await loadOrderForUser(req, tenantId, uid);
    assertEditable(found.data);
    const removed = await db.runTransaction(async (t) => {
      const snap = await t.get(found.ref);
      const photos = (snap.data()?.photos as ServiceOrderPhoto[]) ?? [];
      const photo = photos.find((p) => p.id === req.params.photoId);
      if (!photo) throw new HttpError(404, "Foto não encontrada.");
      t.update(found.ref, { photos: photos.filter((p) => p.id !== photo.id), updatedAt: new Date().toISOString() });
      return photo;
    });
    await deleteOrderFiles([removed.storagePath]);
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao excluir a foto.", "service_order_photo_delete_failed");
  }
}

/**
 * POST /v1/service-orders/:id/complete
 *
 * Fecha a OS com a assinatura do cliente (ou o motivo de não haver uma), dá
 * baixa nas peças e atualiza o último atendimento dos equipamentos. A
 * assinatura guarda nome, documento, data, IP, navegador e o hash do conteúdo
 * da OS: é uma assinatura eletrônica simples, e o hash prova o que foi
 * assinado, porque a OS assinada não muda mais.
 */
export async function completeServiceOrder(req: Request, res: Response) {
  const parsed = CompleteServiceOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
  try {
    const { tenantId, uid } = await requireAccess(req, "service_orders", "canEdit");
    const found = await loadOrderForUser(req, tenantId, uid);
    assertEditable(found.data);

    const revision = Number(found.data.stockRevision ?? 0) + 1;
    let signatureFile: { path: string; url: string } | null = null;
    if (parsed.data.signature) {
      const buffer = decodeSignatureDataUrl(parsed.data.signature.imageDataUrl);
      if (!buffer) return res.status(400).json({ message: "A assinatura não pôde ser lida. Assine de novo." });
      const path = orderFilePath(tenantId, found.ref.id, `assinatura-${revision}.png`);
      signatureFile = { path, url: await storeOrderFile({ path, buffer, contentType: "image/png" }) };
    }

    const result = await db
      .runTransaction(async (t) => {
        const snap = await t.get(found.ref);
        const data = snap.data() ?? {};
        assertEditable(data);
        const now = new Date().toISOString();
        const items = (data.items as ServiceOrderItem[]) ?? [];
        const stock = await syncOrderStock({
          t,
          tenantId,
          orderId: found.ref.id,
          orderCode: String(data.code ?? ""),
          revision,
          items,
          applied: (data.stockApplied as Record<string, number>) ?? {},
          uid,
          now,
        });
        const checkOutAt = now;
        const checkInAt = (data.checkInAt as string | null) ?? now;
        let signature: ServiceOrderSignature | null = null;
        if (parsed.data.signature && signatureFile) {
          signature = {
            name: parsed.data.signature.name,
            document: parsed.data.signature.document?.trim() || null,
            imageUrl: signatureFile.url,
            storagePath: signatureFile.path,
            signedAt: now,
            ip: resolveClientIp(req) ?? null,
            userAgent: String(req.headers["user-agent"] ?? "").slice(0, 300) || null,
            contentHash: signatureContentHash({ ...data, checkInAt, checkOutAt }),
          };
        }
        t.update(found.ref, {
          status: "completed",
          completedAt: now,
          completedBy: uid,
          checkInAt,
          checkOutAt,
          signature,
          noSignatureReason: parsed.data.noSignatureReason ?? null,
          stockApplied: stock.applied,
          stockRevision: revision,
          updatedAt: now,
        });
        for (const equipmentId of (data.equipmentIds as string[]) ?? []) {
          t.set(
            db.collection(EQUIPMENT_COLLECTION).doc(equipmentId),
            { lastServiceAt: now, lastServiceOrderId: found.ref.id, updatedAt: now },
            { merge: true },
          );
        }
        return { negative: stock.negative, completedAt: now };
      })
      .catch(async (error: unknown) => {
        if (signatureFile) await deleteOrderFiles([signatureFile.path]);
        throw error;
      });

    return res.json({ success: true, ...result });
  } catch (error) {
    return fail(res, error, "Erro ao concluir a ordem de serviço.", "service_order_complete_failed");
  }
}

/**
 * POST /v1/service-orders/:id/reopen
 *
 * Só o master (ou admin) reabre uma OS concluída, com o motivo registrado. A
 * assinatura sai: ela atestava um conteúdo que agora pode mudar. O estoque não
 * se mexe aqui; a próxima conclusão (ou o cancelamento) acerta a diferença.
 */
export async function reopenServiceOrder(req: Request, res: Response) {
  const parsed = ReopenServiceOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
  try {
    const { tenantId, uid } = await requireAccess(req, "service_orders", "canEdit");
    if (!isTenantAdminRole(String(req.user?.role ?? "").toUpperCase())) {
      return res.status(403).json({ message: "Só o administrador da empresa reabre uma OS concluída." });
    }
    const found = await loadOfTenant(SERVICE_ORDERS_COLLECTION, req.params.id, tenantId);
    if (!found) return res.status(404).json({ message: "Ordem de serviço não encontrada." });
    if (orderStatus(found.data) !== "completed") {
      return res.status(409).json({ message: "Só uma OS concluída pode ser reaberta." });
    }
    const now = new Date().toISOString();
    const previous = found.data.signature as ServiceOrderSignature | null;
    const log = [
      ...((found.data.reopenLog as unknown[]) ?? []),
      { at: now, by: uid, reason: parsed.data.reason, previousSignature: previous ?? null },
    ];
    await found.ref.update({
      status: "in_progress",
      completedAt: null,
      signature: null,
      noSignatureReason: null,
      reopenLog: log,
      updatedAt: now,
    });
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao reabrir a ordem de serviço.", "service_order_reopen_failed");
  }
}

/**
 * DELETE /v1/service-orders/:id
 *
 * OS concluída não se apaga: ela tem assinatura e baixa de estoque. Para tirar
 * do caminho, reabra e cancele (o que devolve as peças).
 */
export async function deleteServiceOrder(req: Request, res: Response) {
  try {
    const { tenantId } = await requireAccess(req, "service_orders", "canDelete");
    const found = await loadOfTenant(SERVICE_ORDERS_COLLECTION, req.params.id, tenantId);
    if (!found) return res.status(404).json({ message: "Ordem de serviço não encontrada." });
    const status = orderStatus(found.data);
    const applied = (found.data.stockApplied as Record<string, number>) ?? {};
    if (status === "completed" || Object.keys(applied).length > 0) {
      return res.status(409).json({
        message: "Esta OS já movimentou o estoque. Reabra e cancele em vez de excluir.",
      });
    }
    const photos = ((found.data.photos as ServiceOrderPhoto[]) ?? []).map((p) => p.storagePath);
    const signature = (found.data.signature as ServiceOrderSignature | null)?.storagePath;
    await found.ref.delete();
    await deleteOrderFiles(signature ? [...photos, signature] : photos);
    await removeOrderEvent((found.data.calendarEventId as string | null) ?? null, tenantId, found.ref.id);
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao excluir a ordem de serviço.", "service_order_delete_failed");
  }
}

/**
 * POST /v1/service-orders/:id/share-link
 *
 * O link do comprovante para mandar ao cliente. Um por OS, reaproveitado.
 */
export async function createServiceOrderShareLink(req: Request, res: Response) {
  try {
    const { tenantId, uid } = await requireAccess(req, "service_orders", "canView");
    const found = await loadOrderForUser(req, tenantId, uid);
    const token = await ensureOrderShareToken({ tenantId, orderId: found.ref.id, uid });
    return res.json({ url: buildOrderShareUrl(token) });
  } catch (error) {
    return fail(res, error, "Erro ao gerar o link da OS.", "service_order_share_link_failed");
  }
}

/**
 * GET /v1/share/service-order/:token (público)
 *
 * Token inexistente, OS apagada ou empresa sem o módulo dão o mesmo 404, como
 * no portal do cliente.
 */
export async function getSharedServiceOrder(req: Request, res: Response) {
  try {
    const shared = await resolveOrderShareToken(String(req.params.token || ""));
    if (!shared || !(await tenantHasCapability(shared.tenantId, "fieldService"))) {
      return res.status(404).json({ message: "Link não encontrado ou inválido" });
    }
    const tenant = (await db.collection("tenants").doc(shared.tenantId).get()).data() ?? {};
    res.setHeader("Cache-Control", "no-store");
    return res.json({
      order: toClientOrderView(shared.data),
      tenant: {
        name: tenant.name ?? null,
        logoUrl: tenant.logoUrl ?? null,
        primaryColor: tenant.primaryColor ?? null,
      },
    });
  } catch (error) {
    return fail(res, error, "Erro ao carregar a OS.", "shared_service_order_get_failed");
  }
}

/**
 * GET /v1/service-orders/:id/pdf
 *
 * Montado também na função `pdf` (o proxy manda todo caminho terminado em
 * `/pdf` para lá), que não passa pelo gate de plano do router: por isso a
 * capacidade é conferida aqui.
 */
export async function downloadServiceOrderPdf(req: Request, res: Response) {
  try {
    const { tenantId, uid } = await requireAccess(req, "service_orders", "canView");
    if (!(await tenantHasCapability(tenantId, "fieldService"))) {
      return res.status(402).json({ message: "O plano da empresa não inclui ordens de serviço." });
    }
    const found = await loadOrderForUser(req, tenantId, uid);
    const result = await generateOrderPdf({ tenantId, orderId: found.ref.id, uid });
    const filename = buildPdfFilename(result.code, { prefix: "OS", fallbackName: "OS.pdf" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", buildPdfContentDisposition(filename));
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).send(result.buffer);
  } catch (error) {
    return fail(res, error, "Erro ao gerar o PDF da OS.", "service_order_pdf_failed");
  }
}

/** Trava de lançamento: duas abas clicando ao mesmo tempo não lançam duas receitas. */
const TRANSACTION_CLAIM_MS = 2 * 60 * 1000;

/**
 * POST /v1/service-orders/:id/transaction
 *
 * A OS concluída vira uma receita no financeiro, com o total dela, pelo
 * mesmo serviço de lançamentos da tela (que confere a permissão de
 * Lançamentos e mexe no saldo da carteira quando já nasce paga). Uma receita
 * por OS: o id fica gravado nela.
 */
export async function launchServiceOrderTransaction(req: Request, res: Response) {
  const parsed = LaunchTransactionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
  try {
    const { tenantId, uid } = await requireAccess(req, "service_orders", "canView");
    if (!(await tenantHasCapability(tenantId, "financial"))) {
      return res.status(402).json({ message: "O plano da empresa não inclui o financeiro." });
    }
    const found = await loadOrderForUser(req, tenantId, uid);
    if (orderStatus(found.data) !== "completed") {
      return res.status(409).json({ message: "Conclua a OS antes de lançar no financeiro." });
    }
    const total = Number((found.data.totals as { total?: number } | undefined)?.total ?? 0);
    if (!(total > 0)) return res.status(400).json({ message: "A OS não tem valor para lançar." });

    await db.runTransaction(async (t) => {
      const snap = await t.get(found.ref);
      const data = snap.data() ?? {};
      if (data.transactionId) throw new HttpError(409, "Esta OS já foi lançada no financeiro.");
      const claim = Date.parse(String(data.transactionClaimAt ?? ""));
      if (!Number.isNaN(claim) && Date.now() - claim < TRANSACTION_CLAIM_MS) {
        throw new HttpError(409, "O lançamento desta OS já está em andamento.");
      }
      t.update(found.ref, { transactionClaimAt: new Date().toISOString() });
    });

    try {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
      const dto: CreateTransactionDTO = {
        type: "income",
        description: `${String(found.data.code ?? "OS")}: ${String(found.data.title ?? "")}`.slice(0, 200),
        amount: total,
        date: today,
        dueDate: parsed.data.dueDate,
        status: parsed.data.status,
        wallet: parsed.data.wallet,
        clientId: String(found.data.clientId ?? ""),
        clientName: String(found.data.clientName ?? ""),
        category: SERVICE_ORDER_INCOME_CATEGORY,
        installmentCount: 1,
      };
      const validation = validateTransactionData(dto);
      if (!validation.isValid) throw new HttpError(400, validation.message ?? "Dados inválidos.");
      const result = await TransactionService.createTransaction(uid, req.user, dto);
      await found.ref.update({ transactionId: result.transactionId, transactionClaimAt: null });
      return res.status(201).json({ transactionId: result.transactionId });
    } catch (error) {
      await found.ref.update({ transactionClaimAt: null });
      if (error instanceof HttpError) throw error;
      const message = error instanceof Error ? error.message : "";
      // O serviço de lançamentos sinaliza permissão e carteira por mensagem.
      if (/permiss|FORBIDDEN/i.test(message)) throw new HttpError(403, "Sem permissão para criar lançamentos.");
      if (/carteira|wallet/i.test(message)) throw new HttpError(400, message);
      throw error;
    }
  } catch (error) {
    return fail(res, error, "Erro ao lançar a OS no financeiro.", "service_order_transaction_failed");
  }
}

/**
 * POST /v1/equipment/batch
 *
 * Os aparelhos de uma obra entregue, de uma vez: a tela da obra traz os
 * produtos da proposta e a pessoa escolhe o que é equipamento (o split sim, a
 * tubulação não) e completa série e local.
 */
export async function createEquipmentBatch(req: Request, res: Response) {
  const parsed = EquipmentBatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
  try {
    const { tenantId, uid } = await requireAccess(req, "equipment", "canCreate");
    const client = await loadClientSnapshot(parsed.data.clientId, tenantId);
    if (!client) return res.status(404).json({ message: "Contato não encontrado." });
    const projectId = parsed.data.projectId ?? null;
    if (projectId && !(await loadOfTenant("projects", projectId, tenantId))) {
      return res.status(404).json({ message: "Projeto não encontrado." });
    }

    const now = new Date().toISOString();
    const batch = db.batch();
    const ids: string[] = [];
    for (const item of parsed.data.items) {
      const ref = db.collection(EQUIPMENT_COLLECTION).doc();
      ids.push(ref.id);
      batch.set(ref, {
        tenantId,
        clientId: client.id,
        clientName: client.name,
        name: item.name,
        type: item.type ?? null,
        brand: item.brand ?? null,
        model: item.model ?? null,
        serialNumber: item.serialNumber ?? null,
        capacity: item.capacity ?? null,
        location: item.location ?? null,
        installedAt: item.installedAt ?? null,
        warrantyUntil: item.warrantyUntil ?? null,
        notes: item.notes ?? null,
        status: "active",
        projectId,
        lastServiceAt: null,
        lastServiceOrderId: null,
        createdAt: now,
        updatedAt: now,
        createdBy: uid,
      });
    }
    await batch.commit();
    return res.status(201).json({ ids });
  } catch (error) {
    return fail(res, error, "Erro ao registrar os equipamentos.", "equipment_batch_failed");
  }
}
