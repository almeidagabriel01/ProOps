import { Router } from "express";
import { validateFirebaseIdToken } from "../middleware/auth";
import {
  getFiscalSettingsHandler,
  saveFiscalSettingsHandler,
  lookupCnpjHandler,
  refreshInvoiceHandler,
  registerIssuerHandler,
  retryFiscalWebhooksHandler,
  setFiscalEnvironmentHandler,
  suggestNcmHandler,
  issueInvoiceHandler,
  cancelInvoiceHandler,
  listInvoicesHandler,
  previewFromProposalHandler,
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
import { requirePlanCapability } from "../middleware/require-plan-capability";

const router = Router();

// Modulo fiscal inteiro — emissao, recepcao, cadastro do emitente e sugestao
// de NCM. Ate aqui as 18 rotas so pediam token: qualquer assinante cadastrava
// emitente, subia certificado A1 e emitia NF-e/NFS-e, e cada nota emitida OU
// recebida consome uma unidade paga no Focus NFe.
// Escopado por prefixo de proposito — todos os routers sao montados em "/v1",
// entao um use() sem path pegaria a API inteira.
router.use("/fiscal", requirePlanCapability("fiscal"));

router.get("/fiscal/settings", validateFirebaseIdToken, getFiscalSettingsHandler);
router.put("/fiscal/settings", validateFirebaseIdToken, saveFiscalSettingsHandler);
router.get("/fiscal/cnpj/:cnpj", validateFirebaseIdToken, lookupCnpjHandler);
router.post("/fiscal/issuer", validateFirebaseIdToken, registerIssuerHandler);
// Troca de ambiente tem rota propria: e a mudanca mais consequente do modulo e
// nao pode ser efeito colateral de um "salvar configuracao".
router.put("/fiscal/environment", validateFirebaseIdToken, setFiscalEnvironmentHandler);
// Reenviar gatilhos sem reenviar o certificado — falha de registro e comum e
// recuperavel, e o caminho antigo (recadastrar a empresa) era pesado demais.
router.post("/fiscal/webhooks/retry", validateFirebaseIdToken, retryFiscalWebhooksHandler);

// Reaproveita o rate limiter da geracao de campos por IA — mesmo custo por
// token, mesma necessidade de conter rajada.
router.post(
  "/fiscal/ncm-suggestions",
  validateFirebaseIdToken,
  fieldGenRateLimiter,
  suggestNcmHandler,
);

router.get("/fiscal/invoices", validateFirebaseIdToken, listInvoicesHandler);
// Fica acima de qualquer futura `GET /fiscal/invoices/:id`: declarada depois,
// "preview" seria capturado como identificador de nota.
router.get(
  "/fiscal/invoices/preview/from-proposal/:id",
  validateFirebaseIdToken,
  previewFromProposalHandler,
);
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
