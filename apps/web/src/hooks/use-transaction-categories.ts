"use client";

import * as React from "react";
import { FinanceReportsService, type TransactionCategory } from "@/services/finance-reports-service";
import type { TransactionType } from "@/services/transaction-service";

/**
 * A lista de categorias de lançamento da empresa. Guardada no módulo: o
 * formulário e a tela do DRE leem a mesma cópia, e abrir um lançamento atrás
 * do outro não busca a lista de novo.
 */
let cache: TransactionCategory[] | null = null;
let inflight: Promise<TransactionCategory[]> | null = null;
const listeners = new Set<(items: TransactionCategory[]) => void>();

function publish(items: TransactionCategory[]) {
  cache = items;
  for (const listener of listeners) listener(items);
}

async function load(force = false): Promise<TransactionCategory[]> {
  if (cache && !force) return cache;
  if (!inflight) {
    inflight = FinanceReportsService.listCategories()
      .then((items) => {
        publish(items);
        return items;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Só para teste: esquece a lista guardada. */
export function resetTransactionCategoriesCache() {
  cache = null;
  inflight = null;
}

export function useTransactionCategories(enabled = true) {
  const [categories, setCategories] = React.useState<TransactionCategory[]>(cache ?? []);
  const [loading, setLoading] = React.useState(enabled && !cache);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    listeners.add(setCategories);
    let cancelled = false;
    load()
      .then((items) => {
        if (!cancelled) setCategories(items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar as categorias.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      listeners.delete(setCategories);
    };
  }, [enabled]);

  const create = React.useCallback(async (name: string, kind: TransactionType) => {
    const created = await FinanceReportsService.createCategory({ name, kind });
    publish([...(cache ?? []), created]);
    return created;
  }, []);

  const reload = React.useCallback(() => load(true), []);

  return { categories, loading, error, create, reload, replace: publish };
}
