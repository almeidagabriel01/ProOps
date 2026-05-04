import { Request, Response } from "express";
import { resolveUserAndTenant } from "../../lib/auth-helpers";
import { buildPdfContentDisposition, buildPdfFilename } from "../services/pdf-filename";
import { generateAuthenticatedTransactionPdf } from "../services/transaction-pdf.service";

/**
 * GET /v1/transactions/:id/pdf
 *
 * Endpoint PRIVADO (requer Bearer token) para download do PDF de recibo de um
 * lançamento financeiro.
 *
 * Diferença do endpoint público (/share/transaction/:token/pdf):
 *  - Autenticado: verifica identidade e tenant ownership via Firebase Auth.
 *  - Não cria share links públicos para o usuário final.
 *  - Padrão idêntico ao de propostas (GET /v1/proposals/:id/pdf).
 */
export async function downloadTransactionPdf(req: Request, res: Response) {
  try {
    const transactionId = String(req.params.id || "").trim();
    if (!transactionId) {
      return res.status(400).json({ message: "ID do lancamento invalido" });
    }

    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { tenantId } = await resolveUserAndTenant(userId, req.user);
    if (!tenantId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const result = await generateAuthenticatedTransactionPdf(tenantId, transactionId);

    const filename = buildPdfFilename(result.transactionDescription, {
      prefix: "Recibo",
      fallbackName: "Recibo.pdf",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", buildPdfContentDisposition(filename));
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).send(result.buffer);
  } catch (error) {
    if (res.headersSent) {
      return;
    }

    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    if (message === "TRANSACTION_NOT_FOUND") {
      return res.status(404).json({ message: "Lancamento nao encontrado" });
    }
    if (message === "FORBIDDEN_TENANT_MISMATCH") {
      return res.status(403).json({ message: "Acesso negado" });
    }

    console.error("downloadTransactionPdf Error:", error);
    return res.status(500).json({ message: "Erro ao gerar PDF" });
  }
}
