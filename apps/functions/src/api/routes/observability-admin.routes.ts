import { Router } from "express";
import { triageIssue, resolveIdentities } from "../controllers/observability-admin.controller";

const router = Router();

router.put("/issues/:fingerprint/status", triageIssue);
router.post("/resolve-identities", resolveIdentities);

export const observabilityAdminRoutes = router;
