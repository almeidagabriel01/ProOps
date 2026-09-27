"use client";

import * as React from "react";
import {
  TransactionService,
  type CommissionReport,
} from "@/services/transaction-service";
import { useTenant } from "@/providers/tenant-provider";

// Helpers de mês moraram aqui primeiro; o dashboard também os usa.
export { currentMonthKey, shiftMonth, formatMonthLabel } from "@/lib/month-key";
import { currentMonthKey, shiftMonth } from "@/lib/month-key";

/**
 * Relatório mensal de comissões.
 *
 * Uma chamada agregada por mês; a tela nunca varre `transactions`. O `month` é
 * estado local e não é persistido: o mês que interessa é quase sempre o
 * corrente, e lembrar o último escolhido faria a tela abrir no passado.
 */
export function useCommissionsReport() {
  const { tenant, isLoading: isTenantLoading } = useTenant();
  const [month, setMonth] = React.useState(currentMonthKey);
  const [report, setReport] = React.useState<CommissionReport | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    if (isTenantLoading) return;
    if (!tenant?.id) {
      setReport(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    TransactionService.getCommissionReport(tenant.id, month)
      .then((data) => {
        if (cancelled) return;
        setReport(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setReport(null);
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar as comissões.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tenant?.id, isTenantLoading, month, reloadToken]);

  return {
    month,
    setMonth,
    goToPreviousMonth: () => setMonth((m) => shiftMonth(m, -1)),
    goToNextMonth: () => setMonth((m) => shiftMonth(m, 1)),
    goToCurrentMonth: () => setMonth(currentMonthKey()),
    report,
    isLoading: isLoading || isTenantLoading,
    error,
    reload: () => setReloadToken((t) => t + 1),
  };
}
