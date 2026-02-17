
import { callApi } from "@/lib/api-client";
import { Transaction } from "./transaction-service";

export interface ReconciliationRule {
  id: string;
  tenantId: string;
  keyword: string;
  targetCategory: string;
  targetType?: "income" | "expense";
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const ReconciliationRuleService = {
  getRules: async (): Promise<ReconciliationRule[]> => {
    try {
      return await callApi<ReconciliationRule[]>("v1/reconciliation-rules");
    } catch (error) {
      console.error("Error fetching rules:", error);
      throw error;
    }
  },

  createRule: async (
    data: Omit<ReconciliationRule, "id" | "tenantId" | "createdAt" | "updatedAt">
  ): Promise<ReconciliationRule> => {
    try {
      const response = await callApi<{ success: boolean; id: string; message: string }>(
        "v1/reconciliation-rules",
        "POST",
        data
      );
      return { id: response.id, ...data } as ReconciliationRule;
    } catch (error) {
      console.error("Error creating rule:", error);
      throw error;
    }
  },

  updateRule: async (
    id: string,
    data: Partial<Omit<ReconciliationRule, "id" | "tenantId">>
  ): Promise<boolean> => {
    try {
      await callApi(`v1/reconciliation-rules/${id}`, "PUT", data);
      return true;
    } catch (error) {
      console.error("Error updating rule:", error);
      throw error;
    }
  },

  deleteRule: async (id: string): Promise<boolean> => {
    try {
      await callApi(`v1/reconciliation-rules/${id}`, "DELETE");
      return true;
    } catch (error) {
      console.error("Error deleting rule:", error);
      throw error;
    }
  },
};
