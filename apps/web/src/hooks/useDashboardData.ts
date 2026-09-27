"use client";

import * as React from "react";
import {
  TransactionService,
  Transaction,
  type CommissionReport,
} from "@/services/transaction-service";
import { ProposalService, Proposal } from "@/services/proposal-service";
import { ClientService } from "@/services/client-service";
import { WalletService } from "@/services/wallet-service";
import { Wallet } from "@/types";
import {
  KanbanService,
  KanbanStatusColumn,
  getDefaultProposalColumns,
} from "@/services/kanban-service";
import { useTenant } from "@/providers/tenant-provider";
import { toast } from "@/lib/toast";
import {
  computeFinanceOverview,
  computeMonthStats,
  toMonthKey,
  type MonthStats,
} from "@/lib/dashboard-metrics";

interface ProposalStats {
  approved: number;
  pending: number;
  total: number;
  conversionRate: number;
}

/**
 * Cada bloco do painel carrega sozinho. Antes era um `Promise.all` só: uma
 * consulta lenta (ou o relatório de comissões) segurava a tela inteira no
 * skeleton.
 */
export interface DashboardLoading {
  finance: boolean;
  proposals: boolean;
  clients: boolean;
  month: boolean;
}

const EMPTY_MONTH_STATS: MonthStats = {
  expensesByCategory: {},
  incomeByWallet: {},
  expensesByWallet: {},
};

/**
 * Conjuntos de status para as contagens server-side de propostas — espelha a
 * classificação por coluna do kanban usada na listagem (id OU mappedStatus da
 * coluna + statuses legados).
 */
function buildProposalStatusSets(columns: KanbanStatusColumn[]): {
  won: string[];
  open: string[];
} {
  const won = new Set<string>(["approved"]);
  const open = new Set<string>(["sent", "in_progress", "draft"]);
  columns.forEach((column) => {
    const target =
      column.category === "won" ? won : column.category === "open" ? open : null;
    if (!target) return;
    if (column.id) target.add(column.id);
    if (column.mappedStatus) target.add(column.mappedStatus);
  });
  return { won: Array.from(won), open: Array.from(open) };
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function monthBounds(month: string): { start: Date; end: Date } {
  const [year, m] = month.split("-").map(Number);
  return { start: new Date(year, m - 1, 1), end: new Date(year, m, 1) };
}

function mergeTransactions(...lists: Transaction[][]): Transaction[] {
  const byId = new Map<string, Transaction>();
  for (const t of lists.flat()) {
    if (!byId.has(t.id)) byId.set(t.id, t);
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export function useDashboardData() {
  const { tenant, isLoading: isTenantLoading, isDemo } = useTenant();
  const tenantId = tenant?.id;
  const currentMonth = toMonthKey(new Date());
  const [selectedMonth, setSelectedMonth] = React.useState(currentMonth);

  const [finance, setFinance] = React.useState({
    transactions: [] as Transaction[],
    wallets: [] as Wallet[],
  });
  const [proposalsData, setProposalsData] = React.useState({
    proposalStats: { approved: 0, pending: 0, total: 0, conversionRate: 0 } as ProposalStats,
    recentProposals: [] as Proposal[],
  });
  const [clientsData, setClientsData] = React.useState({
    totalClients: 0,
    newClientsThisMonth: 0,
  });
  const [monthData, setMonthData] = React.useState({
    // Lançamentos de um mês que não é o corrente (buscados à parte).
    transactions: null as Transaction[] | null,
    commissionReport: null as CommissionReport | null,
  });
  const [loading, setLoading] = React.useState<DashboardLoading>({
    finance: true,
    proposals: true,
    clients: true,
    month: true,
  });
  const setGroupLoading = (group: keyof DashboardLoading, value: boolean) =>
    setLoading((prev) => (prev[group] === value ? prev : { ...prev, [group]: value }));

  // Tenant carregado e vazio (ex.: superadmin sem empresa escolhida): nada a
  // buscar, e nenhum bloco pode ficar preso no skeleton.
  React.useEffect(() => {
    if (!isTenantLoading && !tenantId) {
      setLoading({ finance: false, proposals: false, clients: false, month: false });
    }
  }, [isTenantLoading, tenantId]);

  // Financeiro: janela do mês atual até +12 meses (gráficos, projeção, alertas).
  React.useEffect(() => {
    if (isTenantLoading || !tenantId) return;
    let cancelled = false;
    setGroupLoading("finance", true);
    (async () => {
      try {
        const now = new Date();
        const { start, end } = monthBounds(toMonthKey(now));
        const horizonEnd = new Date(now.getFullYear(), now.getMonth() + 12, 0);
        const [scoped, paidThisMonth, recent, wallets] = await Promise.all([
          TransactionService.getTransactionsScoped(tenantId, {
            start: isoDay(start),
            end: isoDay(horizonEnd),
          }),
          // Pago NESTE mês de lançamento antigo (date/dueDate fora da janela)
          // — entra no bucket do mês atual via paidAt.
          TransactionService.getTransactionsPaidBetween(
            tenantId,
            start.toISOString(),
            end.toISOString(),
          ),
          TransactionService.getRecentTransactions(tenantId, 5),
          WalletService.getWallets(tenantId),
        ]);
        if (!cancelled) {
          setFinance({
            transactions: mergeTransactions(scoped, paidThisMonth, recent),
            wallets,
          });
        }
      } catch (error) {
        console.error("Error fetching dashboard finance:", error);
        if (!cancelled) {
          toast.error(
            "Não foi possível carregar os dados financeiros do painel. Verifique sua conexão.",
            { title: "Erro ao carregar" },
          );
        }
      } finally {
        if (!cancelled) setGroupLoading("finance", false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, isTenantLoading]);

  // Propostas: recentes e contagens (dependem das colunas do kanban).
  React.useEffect(() => {
    if (isTenantLoading || !tenantId) return;
    let cancelled = false;
    setGroupLoading("proposals", true);
    (async () => {
      try {
        const [kanbanColumnsRaw, recentProposals] = await Promise.all([
          KanbanService.getStatuses(tenantId),
          ProposalService.getRecentProposals(tenantId, 5),
        ]);
        const kanbanColumns =
          kanbanColumnsRaw.length > 0
            ? kanbanColumnsRaw
            : getDefaultProposalColumns().map(
                (c, i) => ({ ...c, id: `default_${i}` }) as KanbanStatusColumn,
              );
        const statusSets = buildProposalStatusSets(kanbanColumns);
        const [approved, pending, allProposals, drafts] = await Promise.all([
          ProposalService.countProposalsByStatuses(tenantId, statusSets.won),
          ProposalService.countProposalsByStatuses(tenantId, statusSets.open),
          ProposalService.countProposals(tenantId),
          ProposalService.countProposalsByStatuses(tenantId, ["draft"]),
        ]);
        const total = Math.max(0, allProposals - drafts); // conversão exclui rascunhos
        const conversionRate = total > 0 ? Math.round((approved / total) * 100) : 0;
        if (!cancelled) {
          setProposalsData({
            proposalStats: { approved, pending, total, conversionRate },
            recentProposals,
          });
        }
      } catch (error) {
        console.error("Error fetching dashboard proposals:", error);
      } finally {
        if (!cancelled) setGroupLoading("proposals", false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, isTenantLoading]);

  // Clientes: total e novos no mês corrente (contagens por aggregation).
  React.useEffect(() => {
    if (isTenantLoading || !tenantId) return;
    let cancelled = false;
    setGroupLoading("clients", true);
    (async () => {
      try {
        const { start, end } = monthBounds(toMonthKey(new Date()));
        const [totalClients, newClientsThisMonth] = await Promise.all([
          ClientService.countClients(tenantId),
          ClientService.countClientsCreatedBetween(tenantId, start, end),
        ]);
        if (!cancelled) setClientsData({ totalClients, newClientsThisMonth });
      } catch (error) {
        console.error("Error fetching dashboard clients:", error);
      } finally {
        if (!cancelled) setGroupLoading("clients", false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, isTenantLoading]);

  // Mês escolhido: comissões e, fora do mês corrente, os lançamentos pagos
  // nele. O mês corrente reaproveita o que o grupo financeiro já trouxe.
  React.useEffect(() => {
    if (isTenantLoading || !tenantId) return;
    let cancelled = false;
    setGroupLoading("month", true);
    (async () => {
      const isCurrent = selectedMonth === currentMonth;
      const { start, end } = monthBounds(selectedMonth);
      const lastDay = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      const [transactions, commissionReport] = await Promise.all([
        isCurrent
          ? Promise.resolve(null)
          : Promise.all([
              TransactionService.getTransactionsScoped(tenantId, {
                start: isoDay(start),
                end: isoDay(lastDay),
              }),
              TransactionService.getTransactionsPaidBetween(
                tenantId,
                start.toISOString(),
                end.toISOString(),
              ),
            ])
              .then(([scoped, paid]) => mergeTransactions(scoped, paid))
              .catch((error) => {
                console.error("Error fetching dashboard month:", error);
                return [] as Transaction[];
              }),
        // Agregado no backend (uma chamada). A conta demo é rejeitada pelo
        // backend, então resolve nulo em vez de derrubar o painel.
        isDemo
          ? Promise.resolve(null)
          : TransactionService.getCommissionReport(
              tenantId,
              isCurrent ? "" : selectedMonth,
            ).catch(() => null),
      ]);
      if (!cancelled) {
        setMonthData({ transactions, commissionReport });
        setGroupLoading("month", false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, isTenantLoading, isDemo, selectedMonth, currentMonth]);

  const overview = React.useMemo(
    () => computeFinanceOverview(finance.transactions, finance.wallets),
    [finance],
  );

  const isCurrentMonth = selectedMonth === currentMonth;
  const monthStats = React.useMemo(() => {
    const source = isCurrentMonth ? finance.transactions : monthData.transactions;
    return source ? computeMonthStats(source, selectedMonth) : EMPTY_MONTH_STATS;
  }, [isCurrentMonth, finance.transactions, monthData.transactions, selectedMonth]);

  return {
    ...overview,
    wallets: finance.wallets,
    transactions: finance.transactions,
    ...proposalsData,
    ...clientsData,
    currentMonthStats: monthStats,
    commissionReport: monthData.commissionReport,
    selectedMonth,
    setSelectedMonth,
    isCurrentMonth,
    loading: {
      ...loading,
      // O mês corrente vem do grupo financeiro.
      month: loading.month || (isCurrentMonth && loading.finance),
    },
    /** Só o tenant: a partir dele, cada bloco mostra o próprio carregamento. */
    isLoading: isTenantLoading,
  };
}
