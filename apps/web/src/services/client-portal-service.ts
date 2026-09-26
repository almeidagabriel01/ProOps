"use client";

import { callApi, callPublicApi } from "@/lib/api-client";

export interface ClientPortalLink {
  url: string | null;
  createdAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
}

export type PortalProposalState = "approved" | "rejected" | "open";
export type PortalPaymentStatus = "paid" | "pending" | "overdue";
export type PortalItemKind = "proposal" | "payment" | "project";

export interface PortalView {
  company: { name: string; logoUrl: string | null; primaryColor: string | null };
  client: { firstName: string };
  proposals: Array<{
    id: string;
    title: string;
    code: string | null;
    state: PortalProposalState;
    value: number;
    createdAt: string | null;
    validUntil: string | null;
  }>;
  payments: Array<{
    id: string;
    description: string;
    amount: number;
    dueDate: string | null;
    status: PortalPaymentStatus;
    isDownPayment: boolean;
  }>;
  canPayOnline: boolean;
  projects: Array<{
    id: string;
    title: string;
    status: "active" | "completed";
    stagesDone: number;
    stagesTotal: number;
    deliveryAccepted: boolean;
  }>;
  invoices: Array<{
    id: string;
    type: "nfe" | "nfse";
    number: string | null;
    amount: number;
    issuedAt: string | null;
    pdfUrl: string;
  }>;
}

const base = (clientId: string) => `/v1/client-portal/${encodeURIComponent(clientId)}/link`;

/** Portal do cliente: o link do contato (empresa) e a página pública. */
export const ClientPortalService = {
  async getLink(clientId: string): Promise<ClientPortalLink> {
    return (await callApi<{ link: ClientPortalLink }>(base(clientId), "GET")).link;
  },

  async createLink(clientId: string): Promise<ClientPortalLink> {
    return (await callApi<{ link: ClientPortalLink }>(base(clientId), "POST")).link;
  },

  async rotateLink(clientId: string): Promise<ClientPortalLink> {
    return (await callApi<{ link: ClientPortalLink }>(`${base(clientId)}/rotate`, "POST")).link;
  },

  async revokeLink(clientId: string): Promise<void> {
    await callApi(base(clientId), "DELETE");
  },

  async publicView(token: string): Promise<PortalView> {
    return callPublicApi<PortalView>(`/v1/share/portal/${encodeURIComponent(token)}`, "GET");
  },

  async openItem(token: string, kind: PortalItemKind, id: string): Promise<string> {
    const response = await callPublicApi<{ url: string }>(
      `/v1/share/portal/${encodeURIComponent(token)}/open`,
      "POST",
      { kind, id },
    );
    return response.url;
  },
};
