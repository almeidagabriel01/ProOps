import { Router } from "express";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  disconnectGoogleCalendar,
  getCalendarEvents,
  getGoogleCalendarAuthUrl,
  getGoogleCalendarStatus,
  handleGoogleCalendarCallback,
  updateCalendarEvent,
} from "../controllers/calendar.controller";
import { requirePlanCapability } from "../middleware/require-plan-capability";

const protectedRouter = Router();
const publicRouter = Router();

// So a SINCRONIA com o Google e gateada. A agenda interna (/calendar/events)
// fica em todos os planos: ja esta na dock de todo mundo e e higiene basica.
// O kill-switch global GOOGLE_CALENDAR_SYNC_ENABLED continua valendo por cima
// — ele desliga a integracao para todos os tenants de uma vez, o que e outra
// coisa e nao substitui um gate por plano.
protectedRouter.use("/calendar/google", requirePlanCapability("calendarSync"));

publicRouter.get("/calendar/google/callback", handleGoogleCalendarCallback);

protectedRouter.get("/calendar/google/auth-url", getGoogleCalendarAuthUrl);
protectedRouter.get("/calendar/google/status", getGoogleCalendarStatus);
protectedRouter.delete("/calendar/google/status", disconnectGoogleCalendar);

protectedRouter.get("/calendar/events", getCalendarEvents);
protectedRouter.post("/calendar/events", createCalendarEvent);
protectedRouter.put("/calendar/events/:id", updateCalendarEvent);
protectedRouter.delete("/calendar/events/:id", deleteCalendarEvent);

export const calendarRoutes = protectedRouter;
export const calendarPublicRoutes = publicRouter;
