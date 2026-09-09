import { Router } from "express";
import { joinAppWaitlist } from "../controllers/app-waitlist.controller";

const router = Router();
router.post("/app-waitlist", joinAppWaitlist);
export const appWaitlistRoutes = router;
