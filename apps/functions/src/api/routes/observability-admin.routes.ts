import { Router } from "express";
import { triageIssue, resolveIdentities, searchIssues } from "../controllers/observability-admin.controller";

const router = Router();

router.get("/issues", searchIssues);
router.put("/issues/:fingerprint/status", triageIssue);
router.post("/resolve-identities", resolveIdentities);

export const observabilityAdminRoutes = router;
