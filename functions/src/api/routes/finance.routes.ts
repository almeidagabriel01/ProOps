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
import {
  createConnectedAccount,
  updateConnectedAccount,
  deleteConnectedAccount,
  syncAccount,
} from "../controllers/connectedAccounts.controller";
import {
  getReconciliationRules,
  createReconciliationRule,
  updateReconciliationRule,
  deleteReconciliationRule,
} from "../controllers/reconciliation.controller";

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

// Connected Accounts (Open Finance)
router.post("/connected-accounts", createConnectedAccount);
router.put("/connected-accounts/:id", updateConnectedAccount);
router.delete("/connected-accounts/:id", deleteConnectedAccount);
router.post("/connected-accounts/:id/sync", syncAccount);

// Reconciliation Rules
router.get("/reconciliation-rules", getReconciliationRules);
router.post("/reconciliation-rules", createReconciliationRule);
router.put("/reconciliation-rules/:id", updateReconciliationRule);
router.delete("/reconciliation-rules/:id", deleteReconciliationRule);

// Payment Initiation (PIS)
import { handleOpenFinanceWebhook } from "../controllers/webhooks.controller";
import { initiatePayment } from "../controllers/payments.controller";

router.get("/payments/test", (req, res) => res.send("PIS Backend is Working!"));
router.post("/payments/initiate", initiatePayment);

const publicRouter = Router();
publicRouter.post("/webhooks/open-finance", handleOpenFinanceWebhook);

export const financeRoutes = router;
export const publicFinanceRoutes = publicRouter;
