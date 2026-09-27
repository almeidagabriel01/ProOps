"use client";

import { callApi } from "@/lib/api-client";
import type { TransactionType } from "@/services/transaction-service";

export type DreGroup = "revenue" | "other_income" | "deduction" | "cost" | "operating" | "other_expense";
export type DreBasis = "cash" | "accrual";

export interface TransactionCategory {
  id: string;
  name: string;
  kind: TransactionType;
  group: DreGroup;
}

export interface DreCategoryLine {
  name: string;
  byMonth: Record<string, number>;
  total: number;
}

export interface DreGroupBlock {
  group: DreGroup;
  label: string;
  byMonth: Record<string, number>;
  total: number;
  categories: DreCategoryLine[];
}

export type DreSubtotalKey = "netRevenue" | "grossProfit" | "operatingResult" | "result";

export interface DreResult {
  basis: DreBasis;
  months: string[];
  groups: Record<DreGroup, DreGroupBlock>;
  totals: Record<DreSubtotalKey, { byMonth: Record<string, number>; total: number }>;
  count: number;
  truncated: boolean;
}

/** DRE e categorias de lançamento (com o grupo do DRE de cada uma). */
export const FinanceReportsService = {
  async listCategories(): Promise<TransactionCategory[]> {
    const response = await callApi<{ categories: TransactionCategory[] }>("/v1/transactions/categories", "GET");
    return response.categories ?? [];
  },

  async createCategory(input: { name: string; kind: TransactionType; group?: DreGroup }): Promise<TransactionCategory> {
    const response = await callApi<{ category: TransactionCategory }>("/v1/transactions/categories", "POST", input);
    return response.category;
  },

  async updateCategory(
    id: string,
    input: { name?: string; group?: DreGroup },
  ): Promise<{ category: TransactionCategory; renamed: number }> {
    return callApi(`/v1/transactions/categories/${encodeURIComponent(id)}`, "PUT", input);
  },

  async deleteCategory(id: string): Promise<void> {
    await callApi(`/v1/transactions/categories/${encodeURIComponent(id)}`, "DELETE");
  },

  async dre(params: { from: string; to: string; basis: DreBasis }): Promise<DreResult> {
    const query = new URLSearchParams(params).toString();
    const response = await callApi<{ dre: DreResult }>(`/v1/transactions/dre?${query}`, "GET");
    return response.dre;
  },
};
