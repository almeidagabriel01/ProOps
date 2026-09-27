import { Request, Response } from "express";
import { db } from "../../init";
import { logger } from "../../lib/logger";
import { resolveClientIp } from "../../lib/client-ip";
import { onlyDigits } from "../../lib/br-document";
import { tenantHasCapability } from "../../lib/tenant-capabilities";
import { NotificationService } from "../services/notification.service";
import {
  DeliveryAcceptanceSchema,
  type DeliveryAcceptance,
  type ProjectDelivery,
} from "../services/projects/project-model";
import {
  PROJECTS_COLLECTION,
  resolveProjectShareToken,
  toClientProjectView,
} from "../services/projects/project.service";

/**
 * Link público da entrega da obra: o cliente confere etapas, checklist e fotos
 * e aceita a entrega com nome e CPF/CNPJ. O token é a credencial, como nos
 * links de proposta e de lançamento.
 */

async function loadFromToken(req: Request, res: Response) {
  const shared = await resolveProjectShareToken(String(req.params.token || ""));
  if (!shared) {
    res.status(404).json({ message: "Link não encontrado ou inválido" });
    return null;
  }
  const ref = db.collection(PROJECTS_COLLECTION).doc(shared.projectId);
  const snap = await ref.get();
  const data = snap.data();
  if (!snap.exists || data?.tenantId !== shared.tenantId) {
    res.status(404).json({ message: "Projeto não encontrado" });
    return null;
  }
  return { shared, ref, data: data as Record<string, unknown> };
}

function expiredResponse(error: unknown, res: Response, fallback: string, event: string) {
  if (error instanceof Error && error.message === "EXPIRED_LINK") {
    return res.status(410).json({
      message: "Este link expirou. Peça um novo à empresa.",
      code: "EXPIRED_LINK",
    });
  }
  logger.error(event, { error: error instanceof Error ? error.message : String(error) });
  return res.status(500).json({ message: fallback });
}

/** GET /v1/share/project/:token */
export async function getSharedProject(req: Request, res: Response) {
  try {
    const loaded = await loadFromToken(req, res);
    if (!loaded) return;
    const tenantSnap = await db.collection("tenants").doc(loaded.shared.tenantId).get();
    const tenant = tenantSnap.data() ?? {};
    return res.json({
      project: toClientProjectView(loaded.data),
      tenant: {
        name: tenant.name ?? null,
        logoUrl: tenant.logoUrl ?? null,
        primaryColor: tenant.primaryColor ?? null,
      },
    });
  } catch (error) {
    return expiredResponse(error, res, "Erro ao carregar o projeto.", "shared_project_get_failed");
  }
}

/** POST /v1/share/project/:token/accept */
export async function acceptSharedProjectDelivery(req: Request, res: Response) {
  const parsed = DeliveryAcceptanceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: parsed.error.issues[0]?.message || "Dados inválidos." });
  }
  try {
    const loaded = await loadFromToken(req, res);
    if (!loaded) return;
    const { shared, ref } = loaded;

    if (!(await tenantHasCapability(shared.tenantId, "projects"))) {
      return res.status(403).json({
        message: "Esta opção não está disponível. Fale com a empresa.",
        code: "PROJECTS_UNAVAILABLE",
      });
    }

    const acceptance: DeliveryAcceptance = {
      name: parsed.data.name.trim(),
      document: onlyDigits(parsed.data.document),
      acceptedAt: new Date().toISOString(),
      ip: resolveClientIp(req) ?? null,
      userAgent: req.headers["user-agent"] ? String(req.headers["user-agent"]).slice(0, 300) : null,
    };

    const project = await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      const data = snap.data() ?? {};
      const delivery = data.delivery as ProjectDelivery | undefined;
      if (delivery?.status === "accepted") throw new Error("ALREADY_ACCEPTED");
      if (data.status === "canceled") throw new Error("PROJECT_CANCELED");
      t.update(ref, {
        "delivery.status": "accepted",
        "delivery.acceptance": acceptance,
        status: "completed",
        completedAt: acceptance.acceptedAt,
        updatedAt: acceptance.acceptedAt,
      });
      return data;
    });

    await NotificationService.createNotification({
      tenantId: shared.tenantId,
      type: "project_delivery_accepted",
      title: "Cliente aceitou a entrega",
      message: `${acceptance.name} aceitou a entrega de "${String(project.title || "projeto")}".`,
      projectId: ref.id,
    }).catch(() => undefined);

    return res.json({ success: true, acceptedAt: acceptance.acceptedAt });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_ACCEPTED") {
      return res.status(409).json({ message: "A entrega já foi aceita.", code: "ALREADY_ACCEPTED" });
    }
    if (error instanceof Error && error.message === "PROJECT_CANCELED") {
      return res.status(409).json({ message: "Este projeto foi cancelado pela empresa." });
    }
    return expiredResponse(error, res, "Não foi possível registrar o aceite.", "shared_project_accept_failed");
  }
}
