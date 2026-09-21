import { Router } from "express";
import {
  createMember,
  updateMember,
  deleteMember,
  updatePermissions,
  getAllTenantsBilling,
  syncTenantBilling,
  updateCredentials,
  updateUserPlan,
  updateUserSubscription,
  createTenant,
  deactivateTenant,
  reactivateTenant,
  purgeTenant,
  copyTenantData,
  recomputeTenantFeatures,
  forceSetTenantPlan,
  migrateTenantPrices,
  startImpersonation,
  stopImpersonation,
  getAuditEvents,
  resetMemberMfa,
} from "../controllers/admin.controller";

const router = Router();

router.get("/tenants/billing", getAllTenantsBilling);
router.get("/audit-events", getAuditEvents);
router.post("/impersonation/start", startImpersonation);
router.post("/impersonation/stop", stopImpersonation);
router.post("/members", createMember);
// IMPORTANT: Specific routes must come BEFORE parameterized routes
router.put("/members/permissions", updatePermissions);
router.put("/members/:id", updateMember);
router.delete("/members/:id", deleteMember);
router.post("/members/:uid/reset-mfa", resetMemberMfa);

router.post("/credentials", updateCredentials);

router.put("/users/:userId/plan", updateUserPlan);
router.put("/users/:userId/subscription", updateUserSubscription);
router.post("/tenants", createTenant);
router.post("/tenants/copy-data", copyTenantData);
router.post("/tenants/migrate-prices", migrateTenantPrices);
router.post("/tenants/:tenantId/deactivate", deactivateTenant);
router.post("/tenants/:tenantId/reactivate", reactivateTenant);
router.post("/tenants/:tenantId/purge", purgeTenant);
router.post("/tenants/:tenantId/recompute-features", recomputeTenantFeatures);
router.post("/tenants/:tenantId/force-set-plan", forceSetTenantPlan);
router.post("/tenants/:tenantId/sync-billing", syncTenantBilling);


export const adminRoutes = router;
