"use client";

import { callApi } from "@/lib/api-client";
import type { PriceTable } from "@/lib/pricing/price-table";

export type { PriceTable } from "@/lib/pricing/price-table";

/** O que o seletor do cadastro do contato precisa: sem os preços. */
export interface PriceTableOption {
  id: string;
  name: string;
  adjustmentPercent: number;
}

export interface PriceTableInput {
  name: string;
  adjustmentPercent: number;
  productPrices: Record<string, number>;
  servicePrices: Record<string, number>;
}

/**
 * Tabelas de preço (`/v1/price-tables`, Pro e Enterprise). A tabela padrão é
 * o catálogo e não passa por aqui.
 *
 * - `list`: a aba de Produtos (pede a permissão de ver Produtos);
 * - `options`: o seletor do contato (qualquer pessoa da empresa);
 * - `get`: a tabela de um cliente, para a proposta (qualquer pessoa da empresa).
 */
export const PriceTableService = {
  list: async (): Promise<PriceTable[]> => {
    const res = await callApi<{ priceTables: PriceTable[] }>("v1/price-tables");
    return res.priceTables;
  },

  options: async (): Promise<PriceTableOption[]> => {
    const res = await callApi<{ options: PriceTableOption[] }>("v1/price-tables/options");
    return res.options;
  },

  get: async (id: string): Promise<PriceTable> => {
    const res = await callApi<{ priceTable: PriceTable }>(
      `v1/price-tables/${encodeURIComponent(id)}`,
    );
    return res.priceTable;
  },

  create: async (input: PriceTableInput): Promise<PriceTable> => {
    const res = await callApi<{ priceTable: PriceTable }>("v1/price-tables", "POST", input);
    return res.priceTable;
  },

  update: async (id: string, input: Partial<PriceTableInput>): Promise<PriceTable> => {
    const res = await callApi<{ priceTable: PriceTable }>(
      `v1/price-tables/${encodeURIComponent(id)}`,
      "PUT",
      input,
    );
    return res.priceTable;
  },

  remove: async (id: string): Promise<void> => {
    await callApi(`v1/price-tables/${encodeURIComponent(id)}`, "DELETE");
  },
};
