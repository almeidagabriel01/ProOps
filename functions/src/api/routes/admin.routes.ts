import { Router } from "express";
import {
  createMember,
  updateMember,
  deleteMember,
  updatePermissions,
  getAllTenantsBilling,
  updateCredentials,
  updateUserPlan,
  updateUserSubscription,
  testWhatsAppBilling,
} from "../controllers/admin.controller";

const router = Router();

router.get("/tenants/billing", getAllTenantsBilling);
router.post("/members", createMember);
// IMPORTANT: Specific routes must come BEFORE parameterized routes
router.put("/members/permissions", updatePermissions);
router.put("/members/:id", updateMember);
router.delete("/members/:id", deleteMember);

router.post("/credentials", updateCredentials);

router.put("/users/:userId/plan", updateUserPlan);
router.put("/users/:userId/subscription", updateUserSubscription);

router.post("/test-whatsapp-billing", testWhatsAppBilling);

export const adminRoutes = router;
