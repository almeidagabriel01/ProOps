import { Router } from "express";
import { getLinkedAccountsHandler } from "../controllers/linked-accounts.controller";

const router = Router();

// Sem `requirePlanCapability` de proposito: e um resumo de todas as
// integracoes, e cada item informa se o plano o inclui. Um gate aqui fecharia
// a tela inteira por causa de uma integracao so.
router.get("/linked-accounts", getLinkedAccountsHandler);

export const linkedAccountsRoutes = router;
