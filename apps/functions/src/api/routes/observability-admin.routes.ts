import { Router } from "express";
import { triageIssue } from "../controllers/observability-admin.controller";

const router = Router();

router.put("/issues/:fingerprint/status", triageIssue);

export const observabilityAdminRoutes = router;
