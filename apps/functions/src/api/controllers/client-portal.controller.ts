import { Request, Response } from "express";
import { z } from "zod";
import { logger } from "../../lib/logger";
import { hasPagePermission } from "../../lib/auth-helpers";
import {
  ClientPortalError,
  ensurePortalLink,
  getPortalLink,
  openPortalItem,
  publicPortalView,
  revokePortalLink,
  rotatePortalLink,
} from "../services/client-portal/client-portal.service";

/**
 * Portal do cliente. As rotas da empresa passam pelo gate `clientPortal`
 * (client-portal.routes.ts) e seguem a permissão de Contatos (`clients`): ver
 * o link pede `canView`; criar, trocar ou desligar pede `canEdit`. As públicas
 * resolvem a empresa e o contato pelo token.
 *
 * O portal abre as propostas e os pagamentos do contato sem login, então ver,
 * criar ou trocar o link pede também "Ver" em Propostas ou em Lançamentos:
 * sem isso, quem só tinha Contatos entregava (e lia) pelo link o que o ERP
 * não lhe mostrava. Desligar o link só fecha o acesso e pede só Contatos.
 */

function fail(res: Response, error: unknown, fallback: string, event: string) {
  if (error instanceof ClientPortalError) return res.status(error.status).json({ message: error.message });
  logger.error(event, { error: error instanceof Error ? error.message : String(error) });
  return res.status(500).json({ message: fallback });
}

async function requireClients(
  req: Request,
  action: "canView" | "canEdit",
  opts: { opensPortal: boolean } = { opensPortal: true },
) {
  const tenantId = req.user?.tenantId;
  const uid = req.user?.uid;
  if (!tenantId || !uid) throw new ClientPortalError(403, "Tenant não identificado.");
  if (!(await hasPagePermission(req.user, "clients", action))) {
    throw new ClientPortalError(
      403,
      action === "canView" ? "Sem permissão para ver contatos." : "Sem permissão para mandar o portal do cliente.",
    );
  }
  if (
    opts.opensPortal &&
    !(await hasPagePermission(req.user, "proposals", "canView")) &&
    !(await hasPagePermission(req.user, "transactions", "canView"))
  ) {
    throw new ClientPortalError(
      403,
      "O portal mostra as propostas e os pagamentos do cliente: é preciso ver Propostas ou Lançamentos.",
    );
  }
  return { tenantId, uid };
}

/** GET /v1/client-portal/:clientId/link */
export async function getClientPortalLink(req: Request, res: Response) {
  try {
    const { tenantId } = await requireClients(req, "canView");
    return res.json({ link: await getPortalLink(tenantId, String(req.params.clientId)) });
  } catch (error) {
    return fail(res, error, "Erro ao carregar o portal do cliente.", "client_portal_get_failed");
  }
}

/** POST /v1/client-portal/:clientId/link: o link do contato, criado na primeira vez. */
export async function createClientPortalLink(req: Request, res: Response) {
  try {
    const { tenantId, uid } = await requireClients(req, "canEdit");
    return res.json({ link: await ensurePortalLink(tenantId, String(req.params.clientId), uid) });
  } catch (error) {
    return fail(res, error, "Erro ao criar o portal do cliente.", "client_portal_create_failed");
  }
}

/** POST /v1/client-portal/:clientId/link/rotate: link novo; o anterior para de abrir. */
export async function rotateClientPortalLink(req: Request, res: Response) {
  try {
    const { tenantId, uid } = await requireClients(req, "canEdit");
    return res.json({ link: await rotatePortalLink(tenantId, String(req.params.clientId), uid) });
  } catch (error) {
    return fail(res, error, "Erro ao gerar um novo link.", "client_portal_rotate_failed");
  }
}

/** DELETE /v1/client-portal/:clientId/link */
export async function revokeClientPortalLink(req: Request, res: Response) {
  try {
    const { tenantId } = await requireClients(req, "canEdit", { opensPortal: false });
    await revokePortalLink(tenantId, String(req.params.clientId));
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao desligar o portal.", "client_portal_revoke_failed");
  }
}

/** GET /v1/share/portal/:token (público) */
export async function getPublicClientPortal(req: Request, res: Response) {
  try {
    const view = await publicPortalView(String(req.params.token));
    // Dado pessoal do cliente: nada de cache intermediário.
    res.set("Cache-Control", "no-store");
    return res.json(view);
  } catch (error) {
    return fail(res, error, "Erro ao abrir o portal.", "client_portal_public_failed");
  }
}

const OpenSchema = z
  .object({ kind: z.enum(["proposal", "payment", "project", "service_order", "pmoc"]), id: z.string().trim().min(1).max(128) })
  .strict();

/** POST /v1/share/portal/:token/open (público): o link da página do item. */
export async function openPublicClientPortalItem(req: Request, res: Response) {
  const parsed = OpenSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ message: "Item inválido." });
  try {
    return res.json(await openPortalItem(String(req.params.token), parsed.data.kind, parsed.data.id));
  } catch (error) {
    return fail(res, error, "Erro ao abrir o item.", "client_portal_open_failed");
  }
}
