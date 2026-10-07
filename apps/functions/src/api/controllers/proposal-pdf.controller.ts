import { Request, Response } from "express";
import { getOrGenerateProposalPdf } from "../services/proposal-pdf.service";
import { hasPagePermission, recordInScope } from "../../lib/auth-helpers";
import { db } from "../../init";
import {
  buildPdfContentDisposition,
  buildPdfFilename,
} from "../services/pdf-filename";

export async function downloadProposalPdf(req: Request, res: Response) {
  try {
    const proposalId = String(req.params.id || "").trim();
    if (!proposalId) {
      return res.status(400).json({ message: "ID da proposta invalido" });
    }

    const isSuperAdmin =
      req.user?.isSuperAdmin || req.user?.role === "SUPERADMIN";
    const authTenantId = String(req.user?.tenantId || "").trim();
    if (!isSuperAdmin && !authTenantId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    // O PDF carrega os valores da proposta: o membro precisa de "Ver" em
    // Propostas, a mesma permissão que as rules cobram na leitura direta.
    if (!(await hasPagePermission(req.user, "proposals", "canView"))) {
      return res
        .status(403)
        .json({ message: "Sem permissão para ver propostas." });
    }
    // "Só as minhas": o PDF da proposta de outro vendedor não sai, como nas rules.
    if (!isSuperAdmin) {
      const snap = await db.collection("proposals").doc(proposalId).get();
      if (snap.exists && !(await recordInScope(req.user, "proposals", snap.data()))) {
        return res.status(404).json({ message: "Proposta nao encontrada" });
      }
    }

    const result = await getOrGenerateProposalPdf(
      authTenantId,
      proposalId,
      isSuperAdmin,
    );
    const filename = buildPdfFilename(result.proposalTitle);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", buildPdfContentDisposition(filename));
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).send(result.buffer);
  } catch (error) {
    if (res.headersSent) {
      return;
    }

    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    if (message === "PROPOSAL_NOT_FOUND") {
      return res.status(404).json({ message: "Proposta nao encontrada" });
    }
    if (message === "FORBIDDEN_TENANT_MISMATCH") {
      return res.status(403).json({ message: "Acesso negado" });
    }
    if (message === "PDF_GENERATION_IN_PROGRESS") {
      return res
        .status(409)
        .json({ message: "PDF em geracao. Tente novamente." });
    }

    console.error("downloadProposalPdf Error:", error);
    return res.status(500).json({ message: message });
  }
}
