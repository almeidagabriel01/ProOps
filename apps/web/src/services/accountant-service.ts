"use client";

import { callApi, callPublicApi } from "@/lib/api-client";
import type { DreBasis, DreResult } from "@/services/finance-reports-service";

export interface AccountantLink {
  url: string | null;
  createdAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
}

export interface AccountantOverview {
  company: { name: string; logoUrl: string | null; primaryColor: string | null };
  sections: { dre: boolean; transactions: boolean; invoices: boolean; received: boolean };
}

export interface AccountantTransaction {
  id: string;
  description: string;
  type: "income" | "expense";
  status: "paid" | "pending" | "overdue";
  date: string | null;
  dueDate: string | null;
  paidAt: string | null;
  amount: number;
  extraCosts: number;
  category: string | null;
  contact: string | null;
  wallet: string | null;
  installment: string | null;
}

export interface AccountantInvoice {
  id: string;
  type: "nfe" | "nfse";
  number: string | null;
  series: string | null;
  status: "authorized" | "cancelled";
  amount: number;
  contact: string | null;
  issuedAt: string | null;
  cancelledAt: string | null;
  hasPdf: boolean;
  hasXml: boolean;
}

export interface AccountantReceivedInvoice {
  id: string;
  issuer: string;
  issuerCnpj: string;
  number: string | null;
  series: string | null;
  issuedAt: string | null;
  amount: number;
  status: "resumo" | "completa" | "cancelada";
  hasXml: boolean;
}

type Period = { from: string; to: string };

const base = (token: string) => `/v1/share/accountant/${encodeURIComponent(token)}`;
const qs = (params: Record<string, string>) => new URLSearchParams(params).toString();

/** Link do contador: o link da empresa (dono e administradores) e a página pública. */
export const AccountantService = {
  async getLink(): Promise<AccountantLink> {
    return (await callApi<{ link: AccountantLink }>("/v1/transactions/accountant-link", "GET")).link;
  },
  async createLink(): Promise<AccountantLink> {
    return (await callApi<{ link: AccountantLink }>("/v1/transactions/accountant-link", "POST")).link;
  },
  async rotateLink(): Promise<AccountantLink> {
    return (await callApi<{ link: AccountantLink }>("/v1/transactions/accountant-link/rotate", "POST")).link;
  },
  async revokeLink(): Promise<void> {
    await callApi("/v1/transactions/accountant-link", "DELETE");
  },

  overview(token: string): Promise<AccountantOverview> {
    return callPublicApi(base(token), "GET");
  },
  async dre(token: string, params: Period & { basis: DreBasis }): Promise<DreResult> {
    return callPublicApi(`${base(token)}/dre?${qs(params)}`, "GET");
  },
  async transactions(token: string, params: Period): Promise<{ transactions: AccountantTransaction[]; truncated: boolean }> {
    return callPublicApi(`${base(token)}/transactions?${qs(params)}`, "GET");
  },
  async invoices(token: string, params: Period): Promise<{ invoices: AccountantInvoice[] }> {
    return callPublicApi(`${base(token)}/invoices?${qs(params)}`, "GET");
  },
  async received(token: string, params: Period): Promise<{ received: AccountantReceivedInvoice[] }> {
    return callPublicApi(`${base(token)}/received?${qs(params)}`, "GET");
  },
  /** Endereço de download (o tipo vai na query; ver o controller do backend). */
  documentUrl(token: string, source: "invoice" | "received", id: string, kind: "pdf" | "xml"): string {
    return `/api/backend${base(token)}/documents/${source}/${encodeURIComponent(id)}?kind=${kind}`;
  },
};
