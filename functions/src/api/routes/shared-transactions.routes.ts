import { Router } from "express";
import { getSharedTransaction } from "../controllers/shared-transactions.controller";
import { downloadSharedTransactionPdf } from "../controllers/shared-transaction-pdf.controller";

const router = Router();

// Acesso público a um lançamento via token
router.get("/share/transaction/:token", getSharedTransaction);
router.get("/share/transaction/:token/pdf", downloadSharedTransactionPdf);

export const sharedTransactionsRoutes = router;
