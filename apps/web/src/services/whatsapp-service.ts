import { callApi } from "@/lib/api-client";

export interface WhatsAppInfo {
  displayPhoneNumber: string | null;
  waLink: string | null;
  monthlyLimit: number;
  currentUsage: {
    month: string;
    totalMessages: number;
    includedMessages: number;
    overageMessages: number;
  };
}

export async function getWhatsAppInfo(): Promise<WhatsAppInfo> {
  return callApi<WhatsAppInfo>("/v1/whatsapp/info", "GET");
}
