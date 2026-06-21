import { Router } from "express";
import { ingestClientError } from "../controllers/observability.controller";

const router = Router();

// Phase 1: client error ingestion only. Read/triage endpoints land in Phase 2.
router.post("/client-error", ingestClientError);

export const observabilityRoutes = router;
