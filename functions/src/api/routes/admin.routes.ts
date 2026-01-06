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
} from "../controllers/admin.controller";

const router = Router();

router.get("/tenants/billing", getAllTenantsBilling);
router.post("/members", createMember);
router.put("/members/:id", updateMember);
router.delete("/members/:id", deleteMember);
router.put("/members/permissions", updatePermissions);

router.post("/credentials", updateCredentials);

router.put("/users/:userId/plan", updateUserPlan);
router.put("/users/:userId/subscription", updateUserSubscription);

export const adminRoutes = router;
