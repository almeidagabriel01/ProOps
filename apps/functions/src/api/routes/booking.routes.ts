import { Router } from "express";
import {
  confirmBooking,
  declineBooking,
  getBookingSettings,
  getPublicBooking,
  listBookingRequests,
  submitPublicBooking,
  updateBookingSettings,
} from "../controllers/booking.controller";
import { requirePlanCapability } from "../middleware/require-plan-capability";

/**
 * Rotas da empresa, montadas em `/v1` com as demais. Gate por prefixo, nunca
 * `router.use(gate)` sem path.
 */
const router = Router();
router.use("/booking", requirePlanCapability("bookingLink"));
router.get("/booking/settings", getBookingSettings);
router.put("/booking/settings", updateBookingSettings);
router.get("/booking/requests", listBookingRequests);
router.post("/booking/requests/:id/confirm", confirmBooking);
router.post("/booking/requests/:id/decline", declineBooking);
export const bookingRoutes = router;

/**
 * Rotas públicas, montadas em `/v1/public/booking` ANTES da autenticação. O
 * plano é conferido pela empresa do token (`resolveBookingToken`), não por
 * middleware: não há usuário logado aqui.
 */
const publicRouter = Router();
publicRouter.get("/:token", getPublicBooking);
publicRouter.post("/:token", submitPublicBooking);
export const publicBookingRoutes = publicRouter;
