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
} from "../controllers/transactions.controller";
import {
  createWallet,
  updateWallet,
  deleteWallet,
  transferValues,
  adjustBalance,
} from "../controllers/wallets.controller";
import {
  createShareLink as createTransactionShareLink,
  getShareLinkInfo,
} from "../controllers/shared-transactions.controller";
import { downloadTransactionPdf } from "../controllers/transaction-pdf.controller";
import { pdfRateLimiter } from "../middleware/pdf-rate-limiter";

const router = Router();

// Transactions
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
