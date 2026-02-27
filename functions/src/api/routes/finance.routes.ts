import { Router } from "express";
import {
  createTransaction,
  updateTransaction,
  updateTransactionWithInstallments,
  updateTransactionsStatusBatch,
  deleteTransaction,
} from "../controllers/transactions.controller";
import {
  createWallet,
  updateWallet,
  deleteWallet,
  transferValues,
  adjustBalance,
} from "../controllers/wallets.controller";
import { createShareLink as createTransactionShareLink } from "../controllers/shared-transactions.controller";
import { downloadTransactionPdf } from "../controllers/transaction-pdf.controller";

const router = Router();

// Transactions
router.post("/transactions", createTransaction);
router.post("/transactions/:id/share-link", createTransactionShareLink);
router.post("/transactions/status-batch", updateTransactionsStatusBatch);
router.put("/transactions/:id", updateTransaction);
router.put("/transactions/:id/installments", updateTransactionWithInstallments);
router.delete("/transactions/:id", deleteTransaction);
// Download autenticado do PDF de recibo (não cria share link público)
router.get("/transactions/:id/pdf", downloadTransactionPdf);

// Wallets
router.post("/wallets", createWallet);
router.put("/wallets/:id", updateWallet);
router.delete("/wallets/:id", deleteWallet);
router.post("/wallets/transfer", transferValues);
router.post("/wallets/adjust", adjustBalance);

export const financeRoutes = router;
