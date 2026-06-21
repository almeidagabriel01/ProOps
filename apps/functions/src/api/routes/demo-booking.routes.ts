import { Router } from "express";
import {
  submitDemoBooking,
  getDemoBookingAvailability,
} from "../controllers/demo-booking.controller";

const router = Router();
router.get("/demo-booking/availability", getDemoBookingAvailability);
router.post("/demo-booking", submitDemoBooking);
export const demoBookingRoutes = router;
