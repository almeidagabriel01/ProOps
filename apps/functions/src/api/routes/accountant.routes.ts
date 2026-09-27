import { Router } from "express";
import {
  getAccountantDocumentHandler,
  getAccountantDreHandler,
  getAccountantInvoicesHandler,
  getAccountantOverviewHandler,
  getAccountantReceivedHandler,
  getAccountantTransactionsHandler,
} from "../controllers/accountant.controller";

/**
 * Link do contador, público: montado em `/v1/share/accountant` ANTES da
 * autenticação (que libera `/v1/share/`). O plano é conferido pela empresa do
 * token (`resolveAccountantToken`): não há usuário logado aqui.
 */
const publicRouter = Router();
publicRouter.get("/:token", getAccountantOverviewHandler);
publicRouter.get("/:token/dre", getAccountantDreHandler);
publicRouter.get("/:token/transactions", getAccountantTransactionsHandler);
publicRouter.get("/:token/invoices", getAccountantInvoicesHandler);
publicRouter.get("/:token/received", getAccountantReceivedHandler);
publicRouter.get("/:token/documents/:source/:id", getAccountantDocumentHandler);
export const publicAccountantRoutes = publicRouter;
