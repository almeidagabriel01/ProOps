import { Router } from "express";
import { getSharedTransaction } from "../controllers/shared-transactions.controller";

const router = Router();

// Acesso público a um lançamento via token
router.get("/share/transaction/:token", getSharedTransaction);

export const sharedTransactionsRoutes = router;
