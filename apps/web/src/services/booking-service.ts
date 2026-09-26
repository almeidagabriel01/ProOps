"use client";

import { callApi, callPublicApi } from "@/lib/api-client";

export interface VisitType {
  id: string;
  label: string;
  durationMin: number;
}

export interface BookingSettings {
  enabled: boolean;
  publicToken: string | null;
  days: number[];
  startMin: number;
  endMin: number;
  leadHours: number;
  horizonDays: number;
  visitTypes: VisitType[];
}

export interface BookingRequest {
  id: string;
  eventId: string;
  visitTypeLabel: string;
  date: string;
  startMin: number;
  durationMin: number;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
}

export interface DaySlots {
  date: string;
  starts: number[];
}

export interface PublicBookingView {
  company: { name: string; logoUrl: string | null; primaryColor: string | null };
  visitTypes: VisitType[];
  slots: Record<string, DaySlots[]>;
}

export interface PublicBookingInput {
  visitTypeId: string;
  date: string;
  startMin: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  website?: string;
  captchaToken?: string;
}

/** Link de agendamento: tudo pela API (as coleções são fechadas nas rules). */
export const BookingService = {
  async getSettings(): Promise<BookingSettings> {
    const response = await callApi<{ settings: BookingSettings }>("/v1/booking/settings", "GET");
    return response.settings;
  },

  async saveSettings(input: Omit<BookingSettings, "publicToken">): Promise<BookingSettings> {
    const response = await callApi<{ settings: BookingSettings }>("/v1/booking/settings", "PUT", {
      enabled: input.enabled,
      days: input.days,
      startMin: input.startMin,
      endMin: input.endMin,
      leadHours: input.leadHours,
      horizonDays: input.horizonDays,
      visitTypes: input.visitTypes.map((t) => ({ id: t.id || undefined, label: t.label, durationMin: t.durationMin })),
    });
    return response.settings;
  },

  async pendingRequests(): Promise<BookingRequest[]> {
    const response = await callApi<{ requests: BookingRequest[] }>("/v1/booking/requests", "GET");
    return response.requests ?? [];
  },

  async confirmRequest(requestId: string): Promise<void> {
    await callApi(`/v1/booking/requests/${requestId}/confirm`, "POST");
  },

  async declineRequest(requestId: string, message?: string): Promise<void> {
    await callApi(`/v1/booking/requests/${requestId}/decline`, "POST", message ? { message } : {});
  },

  async publicView(token: string): Promise<PublicBookingView> {
    return callPublicApi<PublicBookingView>(`/v1/public/booking/${encodeURIComponent(token)}`, "GET");
  },

  async submit(token: string, input: PublicBookingInput): Promise<void> {
    await callPublicApi(`/v1/public/booking/${encodeURIComponent(token)}`, "POST", input);
  },
};
