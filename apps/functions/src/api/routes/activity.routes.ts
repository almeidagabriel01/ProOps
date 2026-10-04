import { Router } from "express";
import { ingestActivityEvents } from "../controllers/activity.controller";

const router = Router();

router.post("/events", ingestActivityEvents);

export const activityRoutes = router;
