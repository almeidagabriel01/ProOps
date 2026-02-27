import { Router } from "express";
import { getSharedTransaction } from "../controllers/shared-transactions.controller";
import { downloadSharedTransactionPdf } from "../controllers/shared-transaction-pdf.controller";
import { pdfRateLimiter } from "../middleware/pdf-rate-limiter";

const router = Router();

// Acesso público a um lançamento via token
router.get("/share/transaction/:token", getSharedTransaction);
router.get("/share/transaction/:token/pdf", pdfRateLimiter, downloadSharedTransactionPdf);

export const sharedTransactionsRoutes = router;
