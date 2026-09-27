"use client";

import { callApi } from "@/lib/api-client";

export interface SalesGoalsPerson {
  id: string;
  name: string;
}

export interface SalesGoalsConfig {
  month: string;
  companyTarget: number | null;
  targets: Record<string, number>;
  people: SalesGoalsPerson[];
}

export interface CompanyGoalProgress {
  month: string;
  scope: "company";
  companyTarget: number | null;
  companyAchieved: number;
  companyCount: number;
  people: Array<{ id: string; name: string; target: number | null; achieved: number; count: number }>;
  unassignedAchieved: number;
}

export interface MyGoalProgress {
  month: string;
  scope: "mine";
  target: number | null;
  achieved: number;
  count: number;
}

export type GoalProgress = CompanyGoalProgress | MyGoalProgress;

/** Metas de vendas (Pro e Enterprise). Tudo pela API: a coleção é fechada nas rules. */
export const SalesGoalsService = {
  async getConfig(month: string): Promise<SalesGoalsConfig> {
    return callApi<SalesGoalsConfig>(`/v1/sales-goals?month=${month}`, "GET");
  },

  async save(input: { month: string; companyTarget: number | null; targets: Record<string, number> }) {
    return callApi<{ month: string; companyTarget: number | null; targets: Record<string, number> }>(
      "/v1/sales-goals",
      "PUT",
      input,
    );
  },

  async progress(month: string): Promise<GoalProgress> {
    return callApi<GoalProgress>(`/v1/sales-goals/progress?month=${month}`, "GET");
  },

  async sellers(): Promise<SalesGoalsPerson[]> {
    const response = await callApi<{ people: SalesGoalsPerson[] }>("/v1/sales-goals/sellers", "GET");
    return response.people ?? [];
  },
};
