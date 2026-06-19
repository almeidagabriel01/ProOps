import { callApi } from "@/lib/api-client";
import type { ErrorIssueStatus } from "@/types/observability";

export const ObservabilityService = {
  triageIssue: async (fingerprint: string, status: ErrorIssueStatus): Promise<void> => {
    await callApi(`/v1/admin/observability/issues/${fingerprint}/status`, "PUT", { status });
  },
};
