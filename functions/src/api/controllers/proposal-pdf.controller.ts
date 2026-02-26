import { Request, Response } from "express";
import { getOrGenerateProposalPdfBuffer } from "../services/proposal-pdf.service";

function buildFilename(proposalId: string): string {
  const normalized = proposalId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `proposta-${normalized || "documento"}.pdf`;
}

export async function downloadProposalPdf(req: Request, res: Response) {
  try {
    const proposalId = String(req.params.id || "").trim();
    if (!proposalId) {
      return res.status(400).json({ message: "ID da proposta invalido" });
    }

    const authTenantId = String(req.user?.tenantId || "").trim();
    const authUserId = String(req.user?.uid || "").trim();
    if (!authTenantId || !authUserId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const pdfBuffer = await getOrGenerateProposalPdfBuffer(
      authTenantId,
      proposalId,
      authUserId,
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${buildFilename(proposalId)}"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).send(pdfBuffer);
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

    console.error("downloadProposalPdf Error:", error);
    return res.status(500).json({ message: "Erro ao gerar PDF" });
  }
}
