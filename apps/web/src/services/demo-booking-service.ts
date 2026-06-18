"use client";
import { callPublicApi } from "@/lib/api-client";

export interface DemoBookingPayload {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  date: string; // YYYY-MM-DD
  startMinutes: number;
  durationMinutes: 15 | 30 | 60;
  website: string; // honeypot
}

export interface AvailabilityBooking {
  date: string;
  startMinutes: number;
  endMinutes: number;
}

export const DemoBookingService = {
  getAvailability: (month: string) =>
    callPublicApi<{ bookings: AvailabilityBooking[] }>(
      `/v1/public/demo-booking/availability?month=${encodeURIComponent(month)}`,
      "GET",
    ),
  book: (data: DemoBookingPayload) =>
    callPublicApi<{ success: boolean }>("/v1/public/demo-booking", "POST", data),
};
