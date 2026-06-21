import { callApi } from "@/lib/api-client";
import type {
  ErrorIssueStatus,
  IssueFilters,
  IssueSearchResponse,
  ResolveIdentitiesResponse,
} from "@/types/observability";

export interface SearchIssuesParams extends IssueFilters {
  from?: string | null;
  to?: string | null;
  limit?: number;
  cursor?: string | null;
}

export const ObservabilityService = {
  triageIssue: async (fingerprint: string, status: ErrorIssueStatus): Promise<void> => {
    await callApi(`/v1/admin/observability/issues/${fingerprint}/status`, "PUT", { status });
  },

  resolveIdentities: async (
    uids: string[],
    tenantIds: string[],
  ): Promise<ResolveIdentitiesResponse> => {
    return callApi<ResolveIdentitiesResponse>(
      "/v1/admin/observability/resolve-identities",
      "POST",
      { uids, tenantIds },
    );
  },

  searchIssues: async (params: SearchIssuesParams): Promise<IssueSearchResponse> => {
    const qs = new URLSearchParams();
    qs.set("status", params.status);
    qs.set("severity", params.severity);
    qs.set("source", params.source);
    qs.set("errorType", params.errorType);
    qs.set("sort", params.sort);
    if (params.q) qs.set("q", params.q);
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.cursor) qs.set("cursor", params.cursor);
    return callApi<IssueSearchResponse>(`/v1/admin/observability/issues?${qs.toString()}`, "GET");
  },
};
