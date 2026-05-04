import { Request, Response } from "express";
import { buildPdfContentDisposition, buildPdfFilename } from "../services/pdf-filename";
import { generateSharedTransactionPdf } from "../services/transaction-pdf.service";

/**
 * GET /v1/share/transaction/:token/pdf
 * Public endpoint - downloads a shared transaction receipt PDF.
 * Query param ?refresh=1 bypasses cache (useful for debugging blank PDFs).
 */
export async function downloadSharedTransactionPdf(req: Request, res: Response) {
  try {
    const token = String(req.params.token || "").trim();
    const forceRefresh = req.query.refresh === "1";
    if (!token) {
      return res.status(400).json({ message: "Token invalido" });
    }

    console.log("[shared-transaction-pdf] Download solicitado", {
      tokenPreview: token.slice(0, 8),
      forceRefresh,
    });

    const result = await generateSharedTransactionPdf(token, forceRefresh);
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

    if (message === "EXPIRED_LINK") {
      return res.status(410).json({
        message: "Este link expirou. Solicite um novo link ao responsavel.",
        code: "EXPIRED_LINK",
      });
    }
    if (
      message === "SHARED_TRANSACTION_NOT_FOUND" ||
      message === "TRANSACTION_NOT_FOUND"
    ) {
      return res.status(404).json({ message: "Link nao encontrado ou invalido" });
    }
    if (message === "INVALID_PDF_HEADER" || message.startsWith("PDF_SUSPICIOUSLY_SMALL")) {
      const bufSize = message.includes(":") ? Number(message.split(":")[1]) : undefined;
      console.error("[shared-transaction-pdf] PDF inválido gerado", { message, bufSize });
      return res.status(500).json({
        message: "PDF gerado está inválido. Tente novamente.",
        code: message.startsWith("PDF_SUSPICIOUSLY_SMALL") ? "PDF_SUSPICIOUSLY_SMALL" : "INVALID_PDF_HEADER",
        debug: { bufferSize: bufSize },
      });
    }

    console.error("downloadSharedTransactionPdf Error:", error);
    return res.status(500).json({ message: "Erro ao gerar PDF" });
  }
}
