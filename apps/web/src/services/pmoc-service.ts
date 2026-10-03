"use client";

import { callApi, callPublicApi } from "@/lib/api-client";
import { downloadPdfFromApiEndpoint } from "@/services/pdf/download-pdf-client";

/** O que a página pública do PMOC mostra (`GET /v1/share/pmoc/:token`). */
export interface PmocView {
  tenant: { name: string | null; logoUrl: string | null; primaryColor: string | null };
  contract: {
    code: string;
    title: string;
    status: string;
    startDate: string | null;
    intervalMonths: number | null;
  };
  client: { name: string; address: string | null };
  building: {
    name: string | null;
    address: string | null;
    occupants: number | null;
    climatizedArea: number | null;
    use: string | null;
  };
  responsible: {
    name: string | null;
    profession: string | null;
    council: string | null;
    registryNumber: string | null;
    artNumber: string | null;
    artValidUntil: string | null;
    artUrl: string | null;
  } | null;
  equipment: Array<{
    name: string;
    type: string | null;
    brand: string | null;
    model: string | null;
    capacity: string | null;
    location: string | null;
  }>;
  groups: Array<{ label: string; items: Array<{ text: string; frequency: string }> }>;
  period: { from: string; to: string };
  visits: Array<{
    code: string;
    day: string | null;
    status: string;
    technicianName: string | null;
    checklist: Array<{ text: string; done: boolean }>;
    doneCount: number;
    report: string | null;
    signedBy: string | null;
  }>;
  executions: Array<{
    id: string;
    category: string;
    text: string;
    frequency: string;
    timesDone: number;
    lastDoneOn: string | null;
  }>;
}

export type PmocDocumentKind = "plan" | "report";

export const PmocService = {
  shareLink: (contractId: string) =>
    callApi<{ url: string }>(`/v1/service-contracts/${encodeURIComponent(contractId)}/pmoc/share-link`, "POST"),

  view: (token: string, period?: { from: string; to: string }) => {
    const query = period ? `?${new URLSearchParams(period).toString()}` : "";
    return callPublicApi<PmocView>(`/v1/share/pmoc/${encodeURIComponent(token)}${query}`, "GET");
  },

  /** PDF do plano ou do relatório (este com o período). */
  downloadPdf: (params: {
    contractId: string;
    code: string;
    kind: PmocDocumentKind;
    period?: { from: string; to: string };
  }) => {
    const query = new URLSearchParams({ kind: params.kind });
    if (params.kind === "report" && params.period) {
      query.set("from", params.period.from);
      query.set("to", params.period.to);
    }
    const label = params.kind === "report" ? "Relatorio PMOC" : "Plano PMOC";
    return downloadPdfFromApiEndpoint({
      endpointPath: `/v1/service-contracts/${encodeURIComponent(params.contractId)}/pmoc/pdf?${query.toString()}`,
      fallbackFilename: `${label} ${params.code || ""}`.trim() + ".pdf",
      requiresAuth: true,
    });
  },
};
