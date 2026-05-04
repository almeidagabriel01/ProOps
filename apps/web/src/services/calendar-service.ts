"use client";

import { callApi } from "@/lib/api-client";
import type {
  CalendarEvent,
  CalendarEventPayload,
  GoogleCalendarConnectionStatus,
} from "@/types/calendar";

type Unsubscribe = () => void;
const CALENDAR_POLL_INTERVAL_MS = 15_000;

export const CalendarService = {
  async fetchEvents(options: {
    rangeStartMs: number;
    rangeEndMs: number;
  }): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
      startMs: String(options.rangeStartMs),
      endMs: String(options.rangeEndMs),
    });

    const response = await callApi<{
      success: boolean;
      events: CalendarEvent[];
    }>(`/v1/calendar/events?${params.toString()}`, "GET");

    return response.events;
  },

  subscribeToEvents(options: {
    rangeStartMs: number;
    rangeEndMs: number;
    callback: (events: CalendarEvent[]) => void;
    onError?: (error: unknown) => void;
  }): Unsubscribe {
    let disposed = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const loadEvents = async () => {
      try {
        const events = await CalendarService.fetchEvents({
          rangeStartMs: options.rangeStartMs,
          rangeEndMs: options.rangeEndMs,
        });

        if (!disposed) {
          options.callback(events);
        }
      } catch (error) {
        if (!disposed) {
          options.onError?.(error);
        }
      }
    };

    void loadEvents();
    intervalId = setInterval(() => {
      void loadEvents();
    }, CALENDAR_POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  },

  async createEvent(payload: CalendarEventPayload): Promise<CalendarEvent> {
    const response = await callApi<{ success: boolean; event: CalendarEvent }>(
      "/v1/calendar/events",
      "POST",
      payload,
    );
    return response.event;
  },

  async updateEvent(
    eventId: string,
    payload: CalendarEventPayload,
  ): Promise<CalendarEvent> {
    const response = await callApi<{ success: boolean; event: CalendarEvent }>(
      `/v1/calendar/events/${eventId}`,
      "PUT",
      payload,
    );
    return response.event;
  },

  async deleteEvent(eventId: string): Promise<void> {
    await callApi(`/v1/calendar/events/${eventId}`, "DELETE");
  },

  async getGoogleConnectionStatus(): Promise<GoogleCalendarConnectionStatus> {
    const response = await callApi<
      { success: boolean } & GoogleCalendarConnectionStatus
    >("/v1/calendar/google/status", "GET");

    return {
      enabled: response.enabled ?? true,
      connected: Boolean(response.connected),
      email: response.email || null,
      calendarId: response.calendarId || null,
      connectedAt: response.connectedAt || null,
      lastSuccessfulSyncAt: response.lastSuccessfulSyncAt || null,
      lastSyncError: response.lastSyncError || null,
    };
  },

  async getGoogleAuthUrl(): Promise<string> {
    const response = await callApi<{ success: boolean; authUrl: string }>(
      "/v1/calendar/google/auth-url",
      "GET",
    );
    return response.authUrl;
  },

  async disconnectGoogleCalendar(): Promise<void> {
    await callApi("/v1/calendar/google/status", "DELETE");
  },
};
