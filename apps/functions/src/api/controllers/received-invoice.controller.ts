import { Request, Response } from "express";
import {
  checkPermission,
  resolveUserAndTenant,
  type PermissionAction,
} from "../../lib/auth-helpers";
import { logger } from "../../lib/logger";
import { describeFocusError } from "../services/fiscal/focus-error";
import {
  getReceivedInvoice,
  listReceivedInvoices,
  manifestReceivedInvoice,
  syncReceivedInvoices,
} from "../services/fiscal/received-invoice.service";
import { createTransactionFromReceivedInvoice } from "../services/fiscal/received-invoice-transaction.service";
import {
  MANIFESTATION_JUSTIFICATION_MAX_LENGTH,
  MANIFESTATION_JUSTIFICATION_MIN_LENGTH,
  requiresJustification,
  type ManifestationType,
} from "../services/fiscal/received-invoice.types";

const VALID_MANIFESTATIONS: ManifestationType[] = [
  "ciencia",
  "confirmacao",
  "desconhecimento",
  "nao_realizada",
];

/**
 * Notas de entrada sao a outra metade do modulo de notas, entao usam a mesma
 * pagina de permissao ("invoices") da emissao. A manifestacao e declaracao
 * formal perante a Receita — exige canEdit, nao so canView.
 */
async function requireTenant(
  req: Request,
  res: Response,
  action: PermissionAction,
): Promise<{ tenantId: string } | null> {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ message: "Não autenticado" });
    return null;
  }
  const { tenantId, isMaster, isSuperAdmin } = await resolveUserAndTenant(userId, req.user);
  if (!isMaster && !isSuperAdmin) {
    if (!(await checkPermission(userId, "invoices", action))) {
      res.status(403).json({ message: "Sem permissão para acessar notas de entrada" });
      return null;
    }
  }
  return { tenantId };
}

// GET /v1/fiscal/received-invoices
export const listReceivedInvoicesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const ctx = await requireTenant(req, res, "canView");
    if (!ctx) return;

    const invoices = await listReceivedInvoices(ctx.tenantId, {
      limit: Math.min(Number(req.query.limit) || 50, 200),
    });
    res.status(200).json({ invoices });
  } catch (error) {
    const err = error as Error;
    logger.error("Falha ao listar notas de entrada", { error: err.message });
    res.status(500).json({ message: err.message });
  }
};

// POST /v1/fiscal/received-invoices/sync
//
// Sincronizacao sob demanda. A automatica roda no cron; esta existe para o
// usuario que acabou de comprar e nao quer esperar o proximo ciclo.
export const syncReceivedInvoicesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const ctx = await requireTenant(req, res, "canEdit");
    if (!ctx) return;

    res.status(200).json(await syncReceivedInvoices(ctx.tenantId));
  } catch (error) {
    const err = error as Error;
    logger.error("Falha ao sincronizar notas de entrada", { error: err.message });
    res.status(500).json({ message: err.message });
  }
};

// POST /v1/fiscal/received-invoices/:chave/manifestacao
//
// Manifestacao do destinatario. Nunca automatica: confirmar uma nota e uma
// declaracao formal da empresa perante a Receita.
export const manifestReceivedInvoiceHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const ctx = await requireTenant(req, res, "canEdit");
    if (!ctx) return;

    const chave = String(req.params.chave || "").replace(/\D/g, "");
    if (chave.length !== 44) {
      res.status(400).json({ message: "Chave de acesso inválida" });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const tipo = String(body.tipo || "") as ManifestationType;
    if (!VALID_MANIFESTATIONS.includes(tipo)) {
      res.status(400).json({
        message: "Manifestação inválida (ciencia, confirmacao, desconhecimento, nao_realizada)",
      });
      return;
    }

    const justificativa = typeof body.justificativa === "string" ? body.justificativa.trim() : "";
    if (requiresJustification(tipo)) {
      if (justificativa.length < MANIFESTATION_JUSTIFICATION_MIN_LENGTH) {
        res.status(400).json({
          message: `A justificativa deve ter ao menos ${MANIFESTATION_JUSTIFICATION_MIN_LENGTH} caracteres.`,
        });
        return;
      }
      if (justificativa.length > MANIFESTATION_JUSTIFICATION_MAX_LENGTH) {
        res.status(400).json({
          message: `A justificativa deve ter no máximo ${MANIFESTATION_JUSTIFICATION_MAX_LENGTH} caracteres.`,
        });
        return;
      }
    }

    const updated = await manifestReceivedInvoice(
      ctx.tenantId,
      chave,
      tipo,
      justificativa || undefined,
    );
    res.status(200).json(updated);
  } catch (error) {
    const err = error as Error;
    if (err.message === "NOTA_RECEBIDA_NAO_ENCONTRADA") {
      res.status(404).json({ message: "Nota de entrada não encontrada" });
      return;
    }
    if (err.message === "FISCAL_NAO_CONFIGURADO") {
      res.status(422).json({ message: "Configure os dados fiscais primeiro", code: err.message });
      return;
    }
    const detail = describeFocusError(error);
    logger.error("Falha ao manifestar nota de entrada", { error: detail.message });
    res.status(detail.httpStatus && detail.httpStatus < 500 ? 422 : 502).json({
      message: detail.message,
    });
  }
};

/**
 * POST /v1/fiscal/received-invoices/:chave/lancamento
 *
 * Transforma a nota do fornecedor em despesa. Nunca automatico: quem compra
 * costuma ja ter lancado a compra a mao quando pagou, e lancar de novo nao e um
 * registro a mais — e o saldo da carteira errado.
 *
 * Tres desfechos, e nenhum deles e erro do usuario:
 *   200 criado
 *   200 already_launched — a nota ja tem lancamento; devolve o id para a UI ligar
 *   409 needs_confirmation — ha despesa parecida no periodo; `force` prossegue
 */
export const launchReceivedInvoiceHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const ctx = await requireTenant(req, res, "canEdit");
    if (!ctx) return;

    const chave = String(req.params.chave || "").replace(/\D/g, "");
    if (chave.length !== 44) {
      res.status(400).json({ message: "Chave de acesso inválida" });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const result = await createTransactionFromReceivedInvoice(
      ctx.tenantId,
      chave,
      req.user!.uid,
      req.user,
      {
        force: body.force === true,
        wallet: typeof body.wallet === "string" ? body.wallet : undefined,
        category: typeof body.category === "string" ? body.category : undefined,
      },
    );

    if (result.outcome === "needs_confirmation") {
      res.status(409).json({
        code: "LANCAMENTO_POSSIVEL_DUPLICADO",
        message: "Já existe despesa de valor parecido neste período.",
        candidates: result.candidates,
      });
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    const err = error as Error;
    if (err.message === "NOTA_RECEBIDA_NAO_ENCONTRADA") {
      res.status(404).json({ message: "Nota de entrada não encontrada" });
      return;
    }
    if (err.message === "NOTA_CANCELADA_NAO_VIRA_DESPESA") {
      res.status(422).json({
        message: "Esta nota foi cancelada pelo fornecedor e não vira despesa.",
        code: err.message,
      });
      return;
    }
    logger.error("Falha ao lançar nota de entrada", { error: err.message });
    // A permissao financeira e checada dentro do TransactionService, e a
    // mensagem dele e mais util que um 500 generico.
    const negado = /permiss|FORBIDDEN/i.test(err.message);
    res.status(negado ? 403 : 500).json({ message: err.message });
  }
};

// GET /v1/fiscal/received-invoices/:chave
export const getReceivedInvoiceHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const ctx = await requireTenant(req, res, "canView");
    if (!ctx) return;

    const invoice = await getReceivedInvoice(
      ctx.tenantId,
      String(req.params.chave || "").replace(/\D/g, ""),
    );
    if (!invoice) {
      res.status(404).json({ message: "Nota de entrada não encontrada" });
      return;
    }
    res.status(200).json(invoice);
  } catch (error) {
    const err = error as Error;
    logger.error("Falha ao buscar nota de entrada", { error: err.message });
    res.status(500).json({ message: err.message });
  }
};
