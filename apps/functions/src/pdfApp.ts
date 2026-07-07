import express from "express";
import { validateFirebaseIdToken } from "./api/middleware/auth";
import { pdfRateLimiter } from "./api/middleware/pdf-rate-limiter";
import { downloadSharedProposalPdf } from "./api/controllers/shared-proposal-pdf.controller";
import { downloadSharedTransactionPdf } from "./api/controllers/shared-transaction-pdf.controller";
import { downloadProposalPdf } from "./api/controllers/proposal-pdf.controller";
import { downloadTransactionPdf } from "./api/controllers/transaction-pdf.controller";
import { logger } from "./lib/logger";

/**
 * App Express da função `pdf` — renderização de PDF isolada do monolito.
 *
 * Motivo: cada render abre um Chromium headless (@sparticuz/chromium). No
 * monolito (concurrency 80, 1GiB), N PDFs simultâneos disputavam memória com
 * o tráfego normal — risco real de OOM. Aqui a config PDF_OPTIONS limita a
 * 2 renders por instância. Lock de geração (Firestore) e cache (Storage) são
 * compartilhados com o monolito, então o fluxo interno WhatsApp→PDF continua
 * funcionando lá sem duplicação.
 *
 * As mesmas rotas seguem montadas no monolito como fallback de transição —
 * o proxy Next.js roteia paths terminados em /pdf para esta função.
 */

export const pdfApp = express();

// CORS de plataforma (PDF_OPTIONS.cors: true) cobre preflight; caller
// esperado é o proxy Next.js (same-origin para o browser).

// Públicas — o token do share link É a autenticação (mesma semântica do monolito)
pdfApp.get("/v1/share/:token/pdf", pdfRateLimiter, downloadSharedProposalPdf);
pdfApp.get(
  "/v1/share/transaction/:token/pdf",
  pdfRateLimiter,
  downloadSharedTransactionPdf,
);

// Autenticadas
pdfApp.use(validateFirebaseIdToken);
pdfApp.get("/v1/proposals/:id/pdf", pdfRateLimiter, downloadProposalPdf);
pdfApp.get("/v1/transactions/:id/pdf", pdfRateLimiter, downloadTransactionPdf);

// Fallback de erro — controllers tratam os próprios erros; isto cobre throws
// síncronos inesperados para a resposta não ficar pendurada.
pdfApp.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    logger.error("pdfApp unhandled error", {
      error: err instanceof Error ? err.message : String(err),
    });
    if (!res.headersSent) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
);
