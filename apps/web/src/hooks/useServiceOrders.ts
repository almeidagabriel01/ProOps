"use client";

import * as React from "react";
import { useAuth } from "@/providers/auth-provider";
import { usePagePermission } from "@/hooks/usePagePermission";
import { FieldService } from "@/services/field-service-service";
import type { ServiceOrder } from "@/types/field-service";

/**
 * Quem vê a equipe inteira (dono, administrador, ou membro com o escopo
 * `service_orders_all`) e quem vê só as OS em que é o técnico. A mesma regra
 * vale nas rules e na API; aqui ela decide a consulta.
 */
export function useServiceOrderScope() {
  const { user } = useAuth();
  const all = usePagePermission("service_orders_all");
  return { seesAll: all.canView, uid: user?.id ?? null, isLoading: all.isLoading };
}

/** As OS do tenant (ou do técnico), em tempo real. */
export function useServiceOrders(tenantId: string | undefined, enabled: boolean) {
  const scope = useServiceOrderScope();
  const [orders, setOrders] = React.useState<ServiceOrder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!tenantId || !enabled || scope.isLoading) return;
    setLoading(true);
    return FieldService.subscribeOrders(
      tenantId,
      { seesAll: scope.seesAll, uid: scope.uid },
      (next) => {
        setOrders(next);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
  }, [tenantId, enabled, scope.isLoading, scope.seesAll, scope.uid]);

  return { orders, loading: loading || scope.isLoading, error, scope };
}
