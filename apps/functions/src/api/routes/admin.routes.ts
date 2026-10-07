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
  endManualAccess,
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
import {
  getTenantModules,
  grantCourtesyAddon,
  revokeCourtesyAddon,
  getTenantsIndex,
} from "../controllers/admin-tenant-modules.controller";
import { listTenantActivity } from "../controllers/admin-activity.controller";
import { listTenantMembers } from "../controllers/admin-tenant-members.controller";
import {
  listMemberAudit,
  reactivateMember,
  revokeMemberSessions,
  suspendMember,
} from "../controllers/member-access.controller";

const router = Router();

router.get("/tenants/billing", getAllTenantsBilling);
router.get("/tenants/index", getTenantsIndex);
router.get("/tenants/:tenantId/modules", getTenantModules);
router.get("/tenants/:tenantId/members", listTenantMembers);
router.post("/tenants/:tenantId/addons/:addonId", grantCourtesyAddon);
router.delete("/tenants/:tenantId/addons/:addonId", revokeCourtesyAddon);
router.get("/audit-events", getAuditEvents);
router.get("/activity", listTenantActivity);
router.post("/impersonation/start", startImpersonation);
router.post("/impersonation/stop", stopImpersonation);
router.post("/members", createMember);
// IMPORTANT: Specific routes must come BEFORE parameterized routes
router.put("/members/permissions", updatePermissions);
// Histórico e acesso da equipe (dono e administradores).
router.get("/members/audit", listMemberAudit);
router.post("/members/:id/suspend", suspendMember);
router.post("/members/:id/reactivate", reactivateMember);
router.post("/members/:id/revoke-sessions", revokeMemberSessions);
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
router.post("/tenants/:tenantId/end-manual-access", endManualAccess);
router.post("/tenants/:tenantId/purge", purgeTenant);
router.post("/tenants/:tenantId/recompute-features", recomputeTenantFeatures);
router.post("/tenants/:tenantId/force-set-plan", forceSetTenantPlan);
router.post("/tenants/:tenantId/sync-billing", syncTenantBilling);


export const adminRoutes = router;
