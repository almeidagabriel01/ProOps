export interface WhatsAppInfo {
  displayPhoneNumber: string;
  waLink: string;
  monthlyLimit: number;
  currentUsage: {
    month: string;
    totalMessages: number;
    includedMessages: number;
    overageMessages: number;
  };
}

export async function getWhatsAppInfo(): Promise<WhatsAppInfo> {
  const res = await fetch("/api/backend/whatsapp/info");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { code?: string }).code ?? "WHATSAPP_INFO_FAILED");
  }
  return res.json() as Promise<WhatsAppInfo>;
}
