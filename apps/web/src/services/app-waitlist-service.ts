"use client";
import { callPublicApi } from "@/lib/api-client";

export interface AppWaitlistPayload {
  email: string;
  /** Honeypot. Always sent empty by the form; anything else is a bot. */
  website: string;
}

export const AppWaitlistService = {
  join: (data: AppWaitlistPayload) =>
    callPublicApi<{ success: boolean }>(
      "/v1/public/app-waitlist",
      "POST",
      data,
    ),
};
