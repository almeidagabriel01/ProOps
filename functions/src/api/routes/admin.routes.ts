import { Router } from "express";
import {
  createMember,
  updateMember,
  deleteMember,
  updatePermissions,
  getAllTenantsBilling,
} from "../controllers/admin.controller";

const router = Router();

router.get("/tenants/billing", getAllTenantsBilling);
router.post("/members", createMember);
router.put("/members/:id", updateMember);
router.delete("/members/:id", deleteMember);
router.put("/members/permissions", updatePermissions);

export const adminRoutes = router;
