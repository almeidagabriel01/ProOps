"use client";
import { callPublicApi } from "@/lib/api-client";

export interface ContactFormPayload {
  name: string;
  company: string;
  email: string;
  phone?: string;
  segment: string;
  message: string;
  website: string;
}

export const ContactFormService = {
  submit: (data: ContactFormPayload) =>
    callPublicApi<{ success: boolean }>("/v1/public/contact-form", "POST", data),
};
