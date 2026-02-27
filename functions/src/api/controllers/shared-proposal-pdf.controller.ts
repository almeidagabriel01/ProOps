"use strict";

import { Request, Response } from "express";
import { SharedProposalService } from "../services/shared-proposal.service";
import { getOrGenerateProposalPdf } from "../services/proposal-pdf.service";
import {
  buildPdfContentDisposition,
  buildPdfFilename,
} from "../services/pdf-filename";

/**
 * GET /v1/share/:token/pdf
 * Public endpoint - downloads the PDF for a shared proposal.
 * The share token acts as authentication (no Bearer token required).
 */
export async function downloadSharedProposalPdf(req: Request, res: Response) {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) {
      return res.status(400).json({ message: "Token invalido" });
    }

    const sharedProposal = await SharedProposalService.getSharedProposal(token);
    if (!sharedProposal) {
      return res.status(404).json({ message: "Link nao encontrado ou invalido" });
    }

    const linkPurpose = String(sharedProposal.purpose || "external_share");
    if (linkPurpose === "system_pdf_render") {
      return res.status(404).json({ message: "Link nao encontrado ou invalido" });
    }

    const result = await getOrGenerateProposalPdf(
      sharedProposal.tenantId,
      sharedProposal.proposalId,
    );

    const filename = buildPdfFilename(result.proposalTitle);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      buildPdfContentDisposition(filename),
    );
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).send(result.buffer);
  } catch (error) {
    if (res.headersSent) {
      return;
    }

    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    if (message === "EXPIRED_LINK") {
      return res.status(410).json({
        message: "Este link expirou. Solicite um novo link ao responsavel.",
        code: "EXPIRED_LINK",
      });
    }
    if (message === "PROPOSAL_NOT_FOUND") {
      return res.status(404).json({ message: "Proposta nao encontrada" });
    }
    if (message === "PDF_GENERATION_IN_PROGRESS") {
      return res.status(409).json({ message: "PDF em geracao. Tente novamente." });
    }

    console.error("downloadSharedProposalPdf Error:", error);
    return res.status(500).json({ message: "Erro ao gerar PDF" });
  }
}
