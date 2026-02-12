import { Router } from "express";
import {
  createTransaction,
  updateTransaction,
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

const router = Router();

// Transactions
router.post("/transactions", createTransaction);
router.post("/transactions/status-batch", updateTransactionsStatusBatch);
router.put("/transactions/:id", updateTransaction);
router.delete("/transactions/:id", deleteTransaction);

// Wallets
router.post("/wallets", createWallet);
router.put("/wallets/:id", updateWallet);
router.delete("/wallets/:id", deleteWallet);
router.post("/wallets/transfer", transferValues);
router.post("/wallets/adjust", adjustBalance);

export const financeRoutes = router;
