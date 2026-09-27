"use client";

import * as React from "react";
import { ProposalService } from "@/services/proposal-service";
import { useClientResponses } from "@/hooks/use-client-responses";
import { shiftMonth } from "@/lib/month-key";
import { monthWindowUtc } from "@/lib/sales/sales-month";
import {
  negotiationStatuses,
  summarizeSales,
  type SalesSummary,
} from "@/lib/sales/dashboard-sales";
import {
  buildAttentionItems,
  EXPIRING_WITHIN_DAYS,
  STALE_AFTER_DAYS,
  type AttentionResult,
} from "@/lib/sales/proposal-attention";

const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * "Vendas do mês" do Dashboard: o vendido no mês escolhido (e no anterior,
 * para a comparação) e o que está em negociação. `openStatuses` vem das
 * colunas do kanban; enquanto for null, nada é buscado.
 */
export function useSalesSummary(
  tenantId: string | undefined,
  month: string,
  openStatuses: string[] | null,
  enabled: boolean,
): { summary: SalesSummary | null; loading: boolean } {
  const [summary, setSummary] = React.useState<SalesSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const statusKey = openStatuses?.join("|") ?? null;

  React.useEffect(() => {
    if (!enabled || !tenantId || statusKey === null) {
      // Sem os status do kanban ainda: segue carregando; desligado: nada a esperar.
      setLoading(enabled);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const current = monthWindowUtc(month);
    const previous = monthWindowUtc(shiftMonth(month, -1));
    const negotiating = negotiationStatuses(statusKey ? statusKey.split("|") : []);
    Promise.all([
      ProposalService.getApprovedBetween(tenantId, current.start, current.end),
      ProposalService.getApprovedBetween(tenantId, previous.start, previous.end),
      ProposalService.sumProposalsByStatuses(tenantId, negotiating),
    ])
      .then(([sold, soldBefore, open]) => {
        if (!cancelled) setSummary(summarizeSales(sold, soldBefore, open));
      })
      .catch((error) => {
        console.error("[dashboard] vendas do mês:", error);
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, tenantId, month, statusKey]);

  return { summary, loading };
}

/**
 * "Precisa de atenção": aceites e pedidos de mudança (ao vivo, o mesmo
 * listener da lista de propostas), propostas que vencem em breve e as paradas.
 */
export function useProposalAttention(
  tenantId: string | undefined,
  openStatuses: string[] | null,
  enabled: boolean,
): { result: AttentionResult | null; loading: boolean } {
  const responses = useClientResponses(enabled ? tenantId : null);
  const [lists, setLists] = React.useState<{
    expiring: Awaited<ReturnType<typeof ProposalService.getExpiringProposals>>;
    stale: Awaited<ReturnType<typeof ProposalService.getStaleProposals>>;
  } | null>(null);
  const statusKey = openStatuses?.join("|") ?? null;

  React.useEffect(() => {
    if (!enabled || !tenantId || statusKey === null) return;
    let cancelled = false;
    setLists(null);
    const today = new Date();
    const negotiating = negotiationStatuses(statusKey ? statusKey.split("|") : []);
    Promise.all([
      ProposalService.getExpiringProposals(
        tenantId,
        negotiating,
        isoDay(today),
        isoDay(new Date(today.getTime() + (EXPIRING_WITHIN_DAYS - 1) * DAY_MS)),
      ),
      ProposalService.getStaleProposals(
        tenantId,
        negotiating,
        new Date(today.getTime() - STALE_AFTER_DAYS * DAY_MS),
      ),
    ])
      .then(([expiring, stale]) => {
        if (!cancelled) setLists({ expiring, stale });
      })
      .catch((error) => {
        console.error("[dashboard] propostas que pedem atenção:", error);
        if (!cancelled) setLists({ expiring: [], stale: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, tenantId, statusKey]);

  const result = React.useMemo(() => {
    if (!lists || !responses.ready) return null;
    return buildAttentionItems({
      acceptances: Array.from(responses.acceptances.values()),
      changeRequests: Array.from(responses.changeRequests.values()),
      expiring: lists.expiring,
      stale: lists.stale,
      today: new Date(),
    });
  }, [lists, responses]);

  return { result, loading: enabled && result === null };
}
