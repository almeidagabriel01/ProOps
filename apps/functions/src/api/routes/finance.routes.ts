import { Router } from "express";
import {
  createTransaction,
  updateTransaction,
  updateTransactionWithInstallments,
  updateTransactionsBatch,
  updateTransactionsStatusBatch,
  updateGroupStatus,
  deleteTransaction,
  deleteTransactionGroup,
  registerPartialPayment,
  getTransactionsSummary,
  getCommissionReport,
} from "../controllers/transactions.controller";
import {
  createWallet,
  updateWallet,
  deleteWallet,
  transferValues,
  adjustBalance,
} from "../controllers/wallets.controller";
import { listWalletOptions } from "../controllers/wallet-options.controller";
import {
  createShareLink as createTransactionShareLink,
  getShareLinkInfo,
} from "../controllers/shared-transactions.controller";
import { downloadTransactionPdf } from "../controllers/transaction-pdf.controller";
import {
  createTransactionCategory,
  deleteTransactionCategory,
  getDre,
  getTransactionCategories,
  updateTransactionCategory,
} from "../controllers/finance-reports.controller";
import {
  createAccountantLinkHandler,
  getAccountantLinkHandler,
  revokeAccountantLinkHandler,
  rotateAccountantLinkHandler,
} from "../controllers/accountant.controller";
import { pdfRateLimiter } from "../middleware/pdf-rate-limiter";
import { requirePlanCapability } from "../middleware/require-plan-capability";

const router = Router();

// Gate de modulo. Escopado por PREFIXO, nunca `router.use(mw)` sem path: todos
// os routers sao montados em `app.use("/v1", ...)`, entao um use() sem path
// rodaria em toda request de /v1 — propostas e clientes inclusive.
const financialGate = requirePlanCapability("financial");
router.use("/transactions", financialGate);
router.use("/wallets", financialGate);

// Transactions
// Summary agregado (aggregation queries) — substitui o cálculo no browser.
// Registrado antes das rotas /:id para o path literal "summary" não colidir.
router.get("/transactions/summary", getTransactionsSummary);
// Relatorio mensal de comissoes. Tambem antes das rotas /:id, e sob
// /transactions para herdar o gate de plano e o prefixo do modo demo.
router.get("/transactions/commissions", getCommissionReport);
// DRE e categorias (com o grupo do DRE de cada uma): sob /transactions pelo
// mesmo motivo, e antes das rotas /:id.
router.get("/transactions/dre", getDre);
router.get("/transactions/categories", getTransactionCategories);
router.post("/transactions/categories", createTransactionCategory);
router.put("/transactions/categories/:id", updateTransactionCategory);
router.delete("/transactions/categories/:id", deleteTransactionCategory);
// Link do contador (só dono e administradores).
router.get("/transactions/accountant-link", getAccountantLinkHandler);
router.post("/transactions/accountant-link", createAccountantLinkHandler);
router.post("/transactions/accountant-link/rotate", rotateAccountantLinkHandler);
router.delete("/transactions/accountant-link", revokeAccountantLinkHandler);
router.post("/transactions", createTransaction);
router.post("/transactions/:id/share-link", createTransactionShareLink);
router.get("/transactions/:id/share-link", getShareLinkInfo);
router.post("/transactions/status-batch", updateTransactionsStatusBatch);
router.put("/transactions/batch", updateTransactionsBatch);
router.put("/transactions/group/:groupId/status", updateGroupStatus);
router.put("/transactions/:id", updateTransaction);
router.put("/transactions/:id/installments", updateTransactionWithInstallments);
router.delete("/transactions/group/:groupId", deleteTransactionGroup);
router.delete("/transactions/:id", deleteTransaction);
// Seletor de carteira da proposta e do contrato: nome sem saldo, para quem
// nao ve o financeiro. Antes das rotas /wallets/:id.
router.get("/wallets/options", listWalletOptions);
router.post("/transactions/:id/partial-payment", registerPartialPayment);
// Download autenticado do PDF de recibo (não cria share link público)
router.get("/transactions/:id/pdf", pdfRateLimiter, downloadTransactionPdf);

// Wallets
router.post("/wallets", createWallet);
router.put("/wallets/:id", updateWallet);
router.delete("/wallets/:id", deleteWallet);
router.post("/wallets/transfer", transferValues);
router.post("/wallets/adjust", adjustBalance);

export const financeRoutes = router;
