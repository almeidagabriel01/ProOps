"use client";

import * as React from "react";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useTenant } from "@/providers/tenant-provider";
import {
  PriceTableService,
  type PriceTable,
  type PriceTableInput,
  type PriceTableOption,
} from "@/services/price-table-service";

/**
 * Tabelas de preço no front. Três leituras, cada uma para uma tela:
 *
 * - `usePriceTables`: a aba "Tabelas de preço" de Produtos (lista e CRUD);
 * - `usePriceTableOptions`: o seletor "Tabela de preço" do cadastro do cliente;
 * - `useClientPriceTable`: a tabela de UM cliente, para a proposta. Recebe o
 *   `priceTableId` do contato (campo de `Client`) e devolve a tabela, que vai
 *   para `resolveProductTablePrice` / `resolveServiceTablePrice`
 *   (`lib/pricing/price-table.ts`). Sem o módulo no plano devolve `null`: um
 *   cliente que ficou com tabela depois de um rebaixamento volta ao catálogo.
 *
 * Todas pulam a chamada sem o módulo no plano (a API responderia 402).
 */

export interface UsePriceTablesResult {
  tables: PriceTable[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: PriceTableInput) => Promise<PriceTable>;
  update: (id: string, input: Partial<PriceTableInput>) => Promise<PriceTable>;
  remove: (id: string) => Promise<void>;
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function usePriceTables(enabled = true): UsePriceTablesResult {
  const { tenant } = useTenant();
  const { hasPriceTables } = usePlanLimits();
  const tenantId = tenant?.id;
  const active = enabled && hasPriceTables && Boolean(tenantId);
  const [tables, setTables] = React.useState<PriceTable[]>([]);
  const [isLoading, setIsLoading] = React.useState(active);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!active) return;
    setIsLoading(true);
    try {
      setTables(await PriceTableService.list());
      setError(null);
    } catch (err) {
      setError(messageOf(err, "Não foi possível carregar as tabelas de preço."));
    } finally {
      setIsLoading(false);
    }
  }, [active]);

  React.useEffect(() => {
    if (!active) {
      setTables([]);
      setIsLoading(false);
      return;
    }
    void refresh();
    // O tenant entra nas dependências: o superadmin troca de empresa sem desmontar a tela.
  }, [active, refresh, tenantId]);

  const create = React.useCallback(async (input: PriceTableInput) => {
    const created = await PriceTableService.create(input);
    setTables((prev) =>
      [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    );
    return created;
  }, []);

  const update = React.useCallback(async (id: string, input: Partial<PriceTableInput>) => {
    const saved = await PriceTableService.update(id, input);
    setTables((prev) =>
      prev
        .map((table) => (table.id === id ? saved : table))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    );
    return saved;
  }, []);

  const remove = React.useCallback(async (id: string) => {
    await PriceTableService.remove(id);
    setTables((prev) => prev.filter((table) => table.id !== id));
  }, []);

  return { tables, isLoading, error, refresh, create, update, remove };
}

export function usePriceTableOptions(enabled = true): {
  options: PriceTableOption[];
  isLoading: boolean;
} {
  const { tenant } = useTenant();
  const { hasPriceTables } = usePlanLimits();
  const tenantId = tenant?.id;
  const active = enabled && hasPriceTables && Boolean(tenantId);
  const [options, setOptions] = React.useState<PriceTableOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(active);

  React.useEffect(() => {
    if (!active) {
      setOptions([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    PriceTableService.options()
      .then((list) => {
        if (!cancelled) setOptions(list);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, tenantId]);

  return { options, isLoading };
}

export function useClientPriceTable(priceTableId: string | null | undefined): {
  table: PriceTable | null;
  isLoading: boolean;
} {
  const { tenant } = useTenant();
  const { hasPriceTables } = usePlanLimits();
  const tenantId = tenant?.id;
  const id = hasPriceTables && tenantId && priceTableId ? priceTableId : null;
  const [state, setState] = React.useState<{ id: string | null; table: PriceTable | null }>({
    id: null,
    table: null,
  });

  React.useEffect(() => {
    if (!id) return;
    let cancelled = false;
    PriceTableService.get(id)
      .then((table) => {
        if (!cancelled) setState({ id, table });
      })
      .catch(() => {
        // Tabela apagada ou inacessível: a proposta segue no catálogo.
        if (!cancelled) setState({ id, table: null });
      });
    return () => {
      cancelled = true;
    };
  }, [id, tenantId]);

  if (!id) return { table: null, isLoading: false };
  return { table: state.id === id ? state.table : null, isLoading: state.id !== id };
}
