import { Router } from "express";
import * as SharedProposalsController from "../controllers/shared-proposals.controller";
import { downloadSharedProposalPdf } from "../controllers/shared-proposal-pdf.controller";
import { pdfRateLimiter } from "../middleware/pdf-rate-limiter";
import { approveSharedProposal } from "../controllers/proposal-online-approval.controller";

const router = Router();

/**
 * Rota pública para acessar proposta via token
 * Sem middleware de autenticação
 */
router.get("/share/:token", SharedProposalsController.getSharedProposal);

/**
 * Rota pública para baixar PDF de proposta compartilhada via token
 * Sem middleware de autenticação — o token é a autenticação
 */
router.get("/share/:token/pdf", pdfRateLimiter, downloadSharedProposalPdf);

/**
 * Aprovação online: o cliente final aceita a proposta pelo link (nome,
 * CPF/CNPJ e aceite). Pública como as demais; o token é a credencial e o
 * `publicShareLimiter` do `api/index.ts` vale para ela também.
 */
router.post("/share/:token/approve", approveSharedProposal);

export default router;
