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

const protectedRouter = Router();
const publicRouter = Router();

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
