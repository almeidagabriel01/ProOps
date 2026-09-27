import { Request, Response } from "express";
import { z } from "zod";
import { logger } from "../../lib/logger";
import { hasPagePermission } from "../../lib/auth-helpers";
import { isTenantAdminRole } from "../../lib/auth-context";
import {
  BookingRequestInputSchema,
  BookingSettingsInputSchema,
} from "../services/booking/booking-model";
import {
  BookingError,
  confirmBookingRequest,
  createBookingRequest,
  declineBookingRequest,
  listPendingRequests,
  loadBookingSettings,
  publicBookingView,
  saveBookingSettings,
} from "../services/booking/booking.service";

/**
 * Link de agendamento. As rotas da empresa passam pelo gate `bookingLink`
 * (booking.routes.ts); o expediente é do dono e dos administradores, e os
 * pedidos seguem a permissão da Agenda (`calendar`). As públicas resolvem a
 * empresa pelo token do link.
 */

function fail(res: Response, error: unknown, fallback: string, event: string) {
  if (error instanceof BookingError) return res.status(error.status).json({ message: error.message });
  logger.error(event, { error: error instanceof Error ? error.message : String(error) });
  return res.status(500).json({ message: fallback });
}

function isAdmin(req: Request): boolean {
  return isTenantAdminRole(String(req.user?.role || "").toUpperCase());
}

/** GET /v1/booking/settings */
export async function getBookingSettings(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant não identificado." });
    if (!isAdmin(req)) return res.status(403).json({ message: "Só o administrador configura o link." });
    return res.json({ settings: await loadBookingSettings(tenantId) });
  } catch (error) {
    return fail(res, error, "Erro ao carregar o link de agendamento.", "booking_settings_get_failed");
  }
}

/** PUT /v1/booking/settings */
export async function updateBookingSettings(req: Request, res: Response) {
  const parsed = BookingSettingsInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Dados inválidos." });
  }
  try {
    const tenantId = req.user?.tenantId;
    const uid = req.user?.uid;
    if (!tenantId || !uid) return res.status(403).json({ message: "Tenant não identificado." });
    if (!isAdmin(req)) return res.status(403).json({ message: "Só o administrador configura o link." });
    return res.json({ settings: await saveBookingSettings(tenantId, parsed.data, uid) });
  } catch (error) {
    return fail(res, error, "Erro ao salvar o link de agendamento.", "booking_settings_update_failed");
  }
}

/** GET /v1/booking/requests: os pedidos que esperam resposta. */
export async function listBookingRequests(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant não identificado." });
    if (!(await hasPagePermission(req.user, "calendar", "canView"))) {
      return res.status(403).json({ message: "Sem permissão para ver a Agenda." });
    }
    return res.json({ requests: await listPendingRequests(tenantId) });
  } catch (error) {
    return fail(res, error, "Erro ao carregar os pedidos de visita.", "booking_requests_list_failed");
  }
}

async function requireCalendarEdit(req: Request): Promise<{ tenantId: string; uid: string }> {
  const tenantId = req.user?.tenantId;
  const uid = req.user?.uid;
  if (!tenantId || !uid) throw new BookingError(403, "Tenant não identificado.");
  if (!(await hasPagePermission(req.user, "calendar", "canEdit"))) {
    throw new BookingError(403, "Sem permissão para responder pedidos de visita.");
  }
  return { tenantId, uid };
}

/** POST /v1/booking/requests/:id/confirm */
export async function confirmBooking(req: Request, res: Response) {
  try {
    const { tenantId, uid } = await requireCalendarEdit(req);
    await confirmBookingRequest(tenantId, String(req.params.id), uid);
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao confirmar a visita.", "booking_confirm_failed");
  }
}

const DeclineSchema = z.object({ message: z.string().trim().max(500).optional() }).strict();

/** POST /v1/booking/requests/:id/decline */
export async function declineBooking(req: Request, res: Response) {
  const parsed = DeclineSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ message: "Recado inválido." });
  try {
    const { tenantId, uid } = await requireCalendarEdit(req);
    await declineBookingRequest(tenantId, String(req.params.id), uid, parsed.data.message || null);
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao recusar a visita.", "booking_decline_failed");
  }
}

/** GET /v1/public/booking/:token: a empresa, os tipos de visita e os horários livres. */
export async function getPublicBooking(req: Request, res: Response) {
  try {
    return res.json(await publicBookingView(String(req.params.token)));
  } catch (error) {
    return fail(res, error, "Erro ao carregar os horários.", "booking_public_view_failed");
  }
}

/** POST /v1/public/booking/:token: o cliente pede a visita. */
export async function submitPublicBooking(req: Request, res: Response) {
  const parsed = BookingRequestInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Dados inválidos." });
  }
  // Honeypot: robô preenche o campo escondido. Responde "ok" para ele não
  // tentar de novo com outra estratégia.
  if (parsed.data.website) return res.status(201).json({ success: true });
  try {
    await createBookingRequest(String(req.params.token), parsed.data);
    return res.status(201).json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao enviar o pedido. Tente de novo.", "booking_public_submit_failed");
  }
}
