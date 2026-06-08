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
  cleanupBillingRedundantFieldsManual,
  markOverdueTransactionsManual,
  cleanupSecurityAuditEventsManual,
  remindNoSubscriptionSignupsManual,
} from "../controllers/internal.controller";

const router = Router();

router.post("/debug/invalidate-tenant-plan-cache", invalidateTenantPlanCacheManual);
router.post("/admin/cleanup-trial-fields", cleanupTrialFieldsManual);
router.post("/admin/cleanup-billing-redundant-fields", cleanupBillingRedundantFieldsManual);
router.post("/cron/mark-overdue", markOverdueTransactionsManual);
router.post("/cron/cleanup-security-audit-events", cleanupSecurityAuditEventsManual);
router.post("/cron/remind-no-subscription", remindNoSubscriptionSignupsManual);

export { router as internalDebugRoutes };
