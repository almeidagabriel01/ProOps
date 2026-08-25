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

export { router as fiscalRoutes };
