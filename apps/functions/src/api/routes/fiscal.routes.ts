import { Router } from "express";
import { validateFirebaseIdToken } from "../middleware/auth";
import {
  getFiscalSettingsHandler,
  saveFiscalSettingsHandler,
  lookupCnpjHandler,
  refreshInvoiceHandler,
  registerIssuerHandler,
  setFiscalEnvironmentHandler,
  suggestNcmHandler,
  issueInvoiceHandler,
  cancelInvoiceHandler,
  listInvoicesHandler,
  issueFromProposalHandler,
  issueFromTransactionHandler,
  correctInvoiceHandler,
  replayNotificationHandler,
  listNaturezasHandler,
  disconnectFiscalHandler,
} from "../controllers/fiscal.controller";
import {
  listReceivedInvoicesHandler,
  getReceivedInvoiceHandler,
  syncReceivedInvoicesHandler,
  manifestReceivedInvoiceHandler,
} from "../controllers/received-invoice.controller";
import { fieldGenRateLimiter } from "../../ai/field-gen-rate-limiter";

const router = Router();

router.get("/fiscal/settings", validateFirebaseIdToken, getFiscalSettingsHandler);
router.put("/fiscal/settings", validateFirebaseIdToken, saveFiscalSettingsHandler);
router.get("/fiscal/cnpj/:cnpj", validateFirebaseIdToken, lookupCnpjHandler);
router.post("/fiscal/issuer", validateFirebaseIdToken, registerIssuerHandler);
// Troca de ambiente tem rota propria: e a mudanca mais consequente do modulo e
// nao pode ser efeito colateral de um "salvar configuracao".
router.put("/fiscal/environment", validateFirebaseIdToken, setFiscalEnvironmentHandler);

// Reaproveita o rate limiter da geracao de campos por IA — mesmo custo por
// token, mesma necessidade de conter rajada.
router.post(
  "/fiscal/ncm-suggestions",
  validateFirebaseIdToken,
  fieldGenRateLimiter,
  suggestNcmHandler,
);

router.get("/fiscal/invoices", validateFirebaseIdToken, listInvoicesHandler);
// Consulta sob demanda: o cron so olha 15 min depois, e quem esta na tela nao
// deveria precisar abrir o painel do provedor para saber o estado da propria nota.
router.post(
  "/fiscal/invoices/:id/refresh",
  validateFirebaseIdToken,
  refreshInvoiceHandler,
);
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

router.post("/fiscal/invoices/:id/correction", validateFirebaseIdToken, correctInvoiceHandler);
router.post(
  "/fiscal/invoices/:id/replay-notification",
  validateFirebaseIdToken,
  replayNotificationHandler,
);
router.get("/fiscal/naturezas", validateFirebaseIdToken, listNaturezasHandler);
router.delete("/fiscal/settings", validateFirebaseIdToken, disconnectFiscalHandler);

// Notas de ENTRADA — emitidas contra o CNPJ do tenant. Modulo complementar ao
// de emissao e independente dele.
router.get("/fiscal/received-invoices", validateFirebaseIdToken, listReceivedInvoicesHandler);
router.post(
  "/fiscal/received-invoices/sync",
  validateFirebaseIdToken,
  syncReceivedInvoicesHandler,
);
router.get(
  "/fiscal/received-invoices/:chave",
  validateFirebaseIdToken,
  getReceivedInvoiceHandler,
);
router.post(
  "/fiscal/received-invoices/:chave/manifestacao",
  validateFirebaseIdToken,
  manifestReceivedInvoiceHandler,
);

export { router as fiscalRoutes };
