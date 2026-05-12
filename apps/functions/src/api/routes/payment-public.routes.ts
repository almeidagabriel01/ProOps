import { Router } from "express";
import { createPayment, getPaymentStatus, getPaymentConfig } from "../controllers/payment-public.controller";
import { paymentPublicRateLimiter } from "../middleware/payment-public-rate-limiter";

const router = Router();

router.post("/share/transaction/:token/payment", paymentPublicRateLimiter, createPayment);
router.get("/share/transaction/:token/payment/:paymentId/status", getPaymentStatus);
router.get("/share/transaction/:token/payment-config", getPaymentConfig);

export { router as paymentPublicRoutes };
