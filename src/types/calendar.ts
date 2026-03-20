export type CalendarEventStatus = "scheduled" | "completed" | "canceled";
export type GoogleCalendarSyncStatus =
  | "disabled"
  | "synced"
  | "error"
  | "removed";
export type GoogleCalendarSyncOrigin = "local" | "imported";

export interface GoogleCalendarSyncMetadata {
  enabled: boolean;
  provider: "google";
  status: GoogleCalendarSyncStatus;
  origin?: GoogleCalendarSyncOrigin;
  calendarId?: string | null;
  externalEventId?: string | null;
  lastAttemptAt?: string | null;
  lastSyncedAt?: string | null;
  lastError?: string | null;
}

export interface CalendarEvent {
  id: string;
  tenantId: string;
  ownerUserId: string;
  createdByUserId: string;
  updatedByUserId: string;
  title: string;
  description: string | null;
  location: string | null;
  status: CalendarEventStatus;
  color: string;
  isAllDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  startDate: string | null;
  endDate: string | null;
  startMs: number;
  endMs: number;
  googleSync: GoogleCalendarSyncMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventFormValues {
  title: string;
  description: string;
  location: string;
  status: CalendarEventStatus;
  color: string;
  isAllDay: boolean;
  startsAt: string;
  endsAt: string;
  startDate: string;
  endDate: string;
}

export interface CalendarEventPayload {
  title: string;
  description?: string | null;
  location?: string | null;
  status: CalendarEventStatus;
  color: string;
  isAllDay: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface GoogleCalendarConnectionStatus {
  connected: boolean;
  email?: string | null;
  calendarId?: string | null;
  connectedAt?: string | null;
  lastSuccessfulSyncAt?: string | null;
  lastSyncError?: string | null;
}
