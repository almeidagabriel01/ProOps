/**
 * Debug-only internal routes — mounted BEFORE Firebase auth middleware.
 *
 * These endpoints are guarded exclusively by the x-cron-secret header. They
 * exist for E2E test fixtures and operational cache invalidation in scenarios
 * where a Firebase ID token is impractical to obtain (Playwright afterEach).
 *
 * Each handler MUST verify x-cron-secret as its first action.
 */
import { Router } from "express";
import {
  invalidateTenantPlanCacheManual,
  cleanupTrialFieldsManual,
  markOverdueTransactionsManual,
} from "../controllers/internal.controller";

const router = Router();

router.post("/debug/invalidate-tenant-plan-cache", invalidateTenantPlanCacheManual);
router.post("/admin/cleanup-trial-fields", cleanupTrialFieldsManual);
router.post("/cron/mark-overdue", markOverdueTransactionsManual);

export { router as internalDebugRoutes };
