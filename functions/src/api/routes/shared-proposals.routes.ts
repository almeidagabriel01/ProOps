import { Router } from "express";
import * as SharedProposalsController from "../controllers/shared-proposals.controller";

const router = Router();

/**
 * Rota pública para acessar proposta via token
 * Sem middleware de autenticação
 */
router.get("/share/:token", SharedProposalsController.getSharedProposal);

export default router;
