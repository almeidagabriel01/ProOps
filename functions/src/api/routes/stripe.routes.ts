import { Router } from "express";
import {
  createCheckoutSession,
  createAddonCheckoutSession,
  createPortalSession,
  getPlans,
  syncSubscription,
  cancelAddon,
  cancelSubscription,
} from "../controllers/stripe.controller";

const router = Router();

router.post("/checkout", createCheckoutSession);
router.post("/checkout-addon", createAddonCheckoutSession);
router.post("/cancel", cancelAddon);
router.post("/cancel-subscription", cancelSubscription);
router.post("/portal", createPortalSession);
router.post("/sync", syncSubscription);
router.get("/plans", getPlans);

export const stripeRoutes = router;
