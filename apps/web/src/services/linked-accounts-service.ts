import { callApi } from "@/lib/api-client";

/**
 * Contas vinculadas: o resumo de toda conta externa ligada à empresa (e do
 * WhatsApp do próprio usuário). Só leitura; conectar e reconectar acontecem na
 * tela de cada integração, apontada por `manageHref`.
 */

export type LinkedAccountId =
  | "google_calendar"
  | "google_drive"
  | "asaas"
  | "fiscal"
  | "whatsapp";

export type LinkedAccountStatus =
  | "connected"
  | "attention"
  | "needs_reconnect"
  | "disconnected"
  | "not_in_plan"
  | "platform_unavailable";

export type LinkedAccountPlanTier = "free" | "starter" | "pro" | "enterprise";

export interface LinkedAccount {
  id: LinkedAccountId;
  scope: "tenant" | "user";
  status: LinkedAccountStatus;
  accountLabel: string | null;
  accountDetail: string | null;
  connectedAt: string | null;
  lastActivityAt: string | null;
  issue: string | null;
  plan: {
    availableInPlan: boolean;
    minimumTier: LinkedAccountPlanTier | null;
    addonAvailable: boolean;
  };
  canManage: boolean;
  manageHref: string;
}

export const LinkedAccountsService = {
  list: async (): Promise<LinkedAccount[]> => {
    const response = await callApi<{ accounts: LinkedAccount[] }>(
      "/v1/linked-accounts",
      "GET",
    );
    return response.accounts ?? [];
  },
};
