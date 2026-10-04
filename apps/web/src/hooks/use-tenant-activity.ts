"use client";

import * as React from "react";
import { AdminService, type TenantActivityEvent, type TenantActivityQuery } from "@/services/admin-service";

type ActivityFilters = Omit<TenantActivityQuery, "cursor">;

interface UseTenantActivityResult {
  events: TenantActivityEvent[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
}

/**
 * Atividade das empresas no painel do super admin, paginada por cursor
 * ("Carregar mais"). Trocar um filtro recomeça da primeira página; uma
 * resposta que chega depois de o filtro mudar é descartada.
 */
export function useTenantActivity(filters: ActivityFilters, enabled = true): UseTenantActivityResult {
  const [events, setEvents] = React.useState<TenantActivityEvent[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const requestRef = React.useRef(0);

  const { tenantId, category, type, uid, limit } = filters;

  const load = React.useCallback(async () => {
    const requestId = ++requestRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const page = await AdminService.getTenantActivity({ tenantId, category, type, uid, limit });
      if (requestId !== requestRef.current) return;
      setEvents(page.events);
      setCursor(page.nextCursor);
    } catch {
      if (requestId !== requestRef.current) return;
      setEvents([]);
      setCursor(null);
      setError("Não foi possível carregar a atividade.");
    } finally {
      if (requestId === requestRef.current) setIsLoading(false);
    }
  }, [tenantId, category, type, uid, limit]);

  React.useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  const loadMore = React.useCallback(() => {
    if (!cursor || isLoadingMore) return;
    const requestId = requestRef.current;
    setIsLoadingMore(true);
    AdminService.getTenantActivity({ tenantId, category, type, uid, limit, cursor })
      .then((page) => {
        if (requestId !== requestRef.current) return;
        setEvents((current) => [...current, ...page.events]);
        setCursor(page.nextCursor);
      })
      .catch(() => {
        if (requestId === requestRef.current) setError("Não foi possível carregar mais eventos.");
      })
      .finally(() => setIsLoadingMore(false));
  }, [cursor, isLoadingMore, tenantId, category, type, uid, limit]);

  return {
    events,
    isLoading,
    isLoadingMore,
    error,
    hasMore: Boolean(cursor),
    loadMore,
    reload: () => void load(),
  };
}
