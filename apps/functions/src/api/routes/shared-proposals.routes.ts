import { Router } from "express";
import * as SharedProposalsController from "../controllers/shared-proposals.controller";
import { downloadSharedProposalPdf } from "../controllers/shared-proposal-pdf.controller";
import { pdfRateLimiter } from "../middleware/pdf-rate-limiter";
import {
  acceptSharedProposal,
  createSharedProposalPaymentLink,
  requestSharedProposalChanges,
} from "../controllers/proposal-online-approval.controller";

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
 * Aceite online: o cliente final aceita a proposta pelo link (nome, CPF/CNPJ e
 * aceite). O aceite fica pendente até a empresa confirmar a aprovação no ERP.
 * Pública como as demais; o token é a credencial e o `publicShareLimiter` do
 * `api/index.ts` vale para ela também.
 */
router.post("/share/:token/accept", acceptSharedProposal);

/** Pedido de mudanças: o cliente diz o que não ficou como o combinado. */
router.post("/share/:token/request-changes", requestSharedProposalChanges);

/** Proposta aprovada: link de pagamento da entrada ou da próxima parcela. */
router.post("/share/:token/payment-link", createSharedProposalPaymentLink);

export default router;
