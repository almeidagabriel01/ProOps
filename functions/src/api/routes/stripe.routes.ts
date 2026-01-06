import { Router } from "express";
import {
  createCheckoutSession,
  createPortalSession,
  getPlans,
} from "../controllers/stripe.controller";

const router = Router();

router.post("/checkout", createCheckoutSession);
router.post("/portal", createPortalSession);
router.get("/plans", getPlans);

export const stripeRoutes = router;
