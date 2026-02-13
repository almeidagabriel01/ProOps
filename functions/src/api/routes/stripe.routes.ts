import { Router } from "express";
import {
  createCheckoutSession,
  confirmCheckoutSession,
  createAddonCheckoutSession,
  createPortalSession,
  getPlans,
  syncSubscription,
  syncAllSubscriptions,
  cancelAddon,
  cancelSubscription,
} from "../controllers/stripe.controller";

const router = Router();
const publicRouter = Router();

router.post("/checkout", createCheckoutSession);
router.post("/confirm-checkout", confirmCheckoutSession);
router.post("/checkout-addon", createAddonCheckoutSession);
router.post("/cancel", cancelAddon);
router.post("/cancel-subscription", cancelSubscription);
router.post("/portal", createPortalSession);
router.post("/sync", syncSubscription);
router.post("/sync-all", syncAllSubscriptions);

publicRouter.get("/plans", getPlans);

export const stripeRoutes = router;
export const publicStripeRoutes = publicRouter;
