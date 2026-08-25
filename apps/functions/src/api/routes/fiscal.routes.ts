import { Router } from "express";
import { validateFirebaseIdToken } from "../middleware/auth";
import {
  getFiscalSettingsHandler,
  saveFiscalSettingsHandler,
  lookupCnpjHandler,
  registerIssuerHandler,
  suggestNcmHandler,
  issueInvoiceHandler,
  cancelInvoiceHandler,
  listInvoicesHandler,
  issueFromProposalHandler,
  issueFromTransactionHandler,
} from "../controllers/fiscal.controller";
import { fieldGenRateLimiter } from "../../ai/field-gen-rate-limiter";

const router = Router();

router.get("/fiscal/settings", validateFirebaseIdToken, getFiscalSettingsHandler);
router.put("/fiscal/settings", validateFirebaseIdToken, saveFiscalSettingsHandler);
router.get("/fiscal/cnpj/:cnpj", validateFirebaseIdToken, lookupCnpjHandler);
router.post("/fiscal/issuer", validateFirebaseIdToken, registerIssuerHandler);

// Reaproveita o rate limiter da geracao de campos por IA — mesmo custo por
// token, mesma necessidade de conter rajada.
router.post(
  "/fiscal/ncm-suggestions",
  validateFirebaseIdToken,
  fieldGenRateLimiter,
  suggestNcmHandler,
);

router.get("/fiscal/invoices", validateFirebaseIdToken, listInvoicesHandler);
router.post("/fiscal/invoices", validateFirebaseIdToken, issueInvoiceHandler);
router.post("/fiscal/invoices/:id/cancel", validateFirebaseIdToken, cancelInvoiceHandler);

// Emissao a partir do documento de negocio — o caminho que os botoes usam.
router.post(
  "/fiscal/invoices/from-proposal/:id",
  validateFirebaseIdToken,
  issueFromProposalHandler,
);
router.post(
  "/fiscal/invoices/from-transaction/:id",
  validateFirebaseIdToken,
  issueFromTransactionHandler,
);

export { router as fiscalRoutes };
