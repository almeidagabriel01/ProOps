"use client";

import * as React from "react";
import {
  TransactionService,
  type CommissionReport,
} from "@/services/transaction-service";
import { useTenant } from "@/providers/tenant-provider";

/** "2026-10" do mês corrente, no fuso local. */
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Desloca um "YYYY-MM" em N meses, sem depender de biblioteca de data. */
export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  // Date normaliza mês 12 e mês -1 sozinho, então virada de ano sai de graça.
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const label = new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString(
    "pt-BR",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

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
