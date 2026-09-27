import { Request, Response } from "express";
import { z } from "zod";
import { logger } from "../../lib/logger";
import { isTenantAdminRole } from "../../lib/auth-context";
import { DreError } from "../services/finance-reports/dre.service";
import {
  AccountantError,
  accountantDocument,
  accountantDre,
  accountantInvoices,
  accountantOverview,
  accountantReceived,
  accountantTransactions,
  ensureAccountantLink,
  getAccountantLink,
  revokeAccountantLink,
  rotateAccountantLink,
} from "../services/accountant/accountant.service";

/**
 * Link do contador. Gerar, trocar e desligar é só do dono e dos
 * administradores (o link abre o financeiro inteiro para alguém de fora); as
 * rotas ficam sob `/transactions` e herdam o gate `financial`. As públicas
 * resolvem a empresa pelo token.
 */

function fail(res: Response, error: unknown, fallback: string, event: string) {
  if (error instanceof AccountantError || error instanceof DreError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error(event, { error: error instanceof Error ? error.message : String(error) });
  return res.status(500).json({ message: fallback });
}

function requireAdmin(req: Request): { tenantId: string; uid: string } {
  const tenantId = req.user?.tenantId;
  const uid = req.user?.uid;
  if (!tenantId || !uid) throw new AccountantError(403, "Tenant não identificado.");
  if (!isTenantAdminRole(String(req.user?.role || "").toUpperCase())) {
    throw new AccountantError(403, "Só o administrador gerencia o link do contador.");
  }
  return { tenantId, uid };
}

/** GET /v1/transactions/accountant-link */
export async function getAccountantLinkHandler(req: Request, res: Response) {
  try {
    const { tenantId } = requireAdmin(req);
    return res.json({ link: await getAccountantLink(tenantId) });
  } catch (error) {
    return fail(res, error, "Erro ao carregar o link do contador.", "accountant_link_get_failed");
  }
}

/** POST /v1/transactions/accountant-link */
export async function createAccountantLinkHandler(req: Request, res: Response) {
  try {
    const { tenantId, uid } = requireAdmin(req);
    return res.json({ link: await ensureAccountantLink(tenantId, uid) });
  } catch (error) {
    return fail(res, error, "Erro ao criar o link do contador.", "accountant_link_create_failed");
  }
}

/** POST /v1/transactions/accountant-link/rotate */
export async function rotateAccountantLinkHandler(req: Request, res: Response) {
  try {
    const { tenantId, uid } = requireAdmin(req);
    return res.json({ link: await rotateAccountantLink(tenantId, uid) });
  } catch (error) {
    return fail(res, error, "Erro ao gerar um novo link.", "accountant_link_rotate_failed");
  }
}

/** DELETE /v1/transactions/accountant-link */
export async function revokeAccountantLinkHandler(req: Request, res: Response) {
  try {
    const { tenantId } = requireAdmin(req);
    await revokeAccountantLink(tenantId);
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao desligar o link.", "accountant_link_revoke_failed");
  }
}

const PeriodSchema = z.object({ from: z.string(), to: z.string() });
const DreSchema = PeriodSchema.extend({ basis: z.enum(["cash", "accrual"]).default("cash") });

function token(req: Request): string {
  return String(req.params.token || "");
}

function publicHandler<T>(
  schema: z.ZodType<T> | null,
  run: (token: string, params: T) => Promise<unknown>,
  event: string,
) {
  return async (req: Request, res: Response) => {
    let params = undefined as T;
    if (schema) {
      const parsed = schema.safeParse(req.query ?? {});
      if (!parsed.success) return res.status(400).json({ message: "Período inválido." });
      params = parsed.data;
    }
    try {
      const result = await run(token(req), params);
      // Dado financeiro da empresa: nada de cache intermediário.
      res.set("Cache-Control", "no-store");
      return res.json(result);
    } catch (error) {
      return fail(res, error, "Erro ao abrir o link do contador.", event);
    }
  };
}

/** GET /v1/share/accountant/:token */
export const getAccountantOverviewHandler = publicHandler(null, (t) => accountantOverview(t), "accountant_overview_failed");
/** GET /v1/share/accountant/:token/dre */
export const getAccountantDreHandler = publicHandler(DreSchema, (t, p) => accountantDre(t, p), "accountant_dre_failed");
/** GET /v1/share/accountant/:token/transactions */
export const getAccountantTransactionsHandler = publicHandler(
  PeriodSchema,
  (t, p) => accountantTransactions(t, p),
  "accountant_transactions_failed",
);
/** GET /v1/share/accountant/:token/invoices */
export const getAccountantInvoicesHandler = publicHandler(PeriodSchema, (t, p) => accountantInvoices(t, p), "accountant_invoices_failed");
/** GET /v1/share/accountant/:token/received */
export const getAccountantReceivedHandler = publicHandler(PeriodSchema, (t, p) => accountantReceived(t, p), "accountant_received_failed");

const DocumentSchema = z.object({ kind: z.enum(["pdf", "xml"]) });

/**
 * GET /v1/share/accountant/:token/documents/:source/:id?kind=pdf|xml
 *
 * O tipo vai na query, e não no fim do caminho: o proxy do Next manda todo
 * caminho terminado em `/pdf` para a função de PDF, que não tem esta rota.
 */
export async function getAccountantDocumentHandler(req: Request, res: Response) {
  const parsed = DocumentSchema.safeParse(req.query ?? {});
  const source = req.params.source;
  if (!parsed.success || (source !== "invoice" && source !== "received")) {
    return res.status(400).json({ message: "Documento inválido." });
  }
  try {
    const result = await accountantDocument(token(req), source, String(req.params.id || ""), parsed.data.kind);
    res.set("Cache-Control", "no-store");
    if ("redirect" in result) return res.redirect(302, result.redirect);
    res.set("Content-Type", parsed.data.kind === "pdf" ? "application/pdf" : "application/xml");
    res.set("Content-Disposition", `attachment; filename="${result.fileName}"`);
    return res.send(result.buffer);
  } catch (error) {
    return fail(res, error, "Erro ao baixar o documento.", "accountant_document_failed");
  }
}
