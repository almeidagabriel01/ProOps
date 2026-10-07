"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, EyeOff, RotateCcw } from "lucide-react";
import { PageViewSwitcher } from "@/components/layout/page-view-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { SelectTenantState } from "@/components/shared/select-tenant-state";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";
import { formatMonthShort } from "@/lib/finance/dre-period";
import {
  DEFAULT_SCENARIOS,
  DELAY_OPTIONS,
  SCENARIO_LABELS,
  brazilToday,
  computeCashFlow,
  type CashFlowResult,
  type CashFlowScenarioId,
} from "@/lib/finance/cash-flow";
import { useCashFlowData } from "./_hooks/use-cash-flow-data";
import { useCashFlowScenarios } from "./_hooks/use-cash-flow-scenarios";
import { CashFlowSkeleton } from "./_components/cash-flow-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { usePageScope } from "@/hooks/usePermission";

// O gráfico (Recharts) chega depois do resto; o placeholder ocupa o lugar.
const CashFlowChart = dynamic(() => import("./_components/cash-flow-chart").then((m) => m.CashFlowChart), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-xl bg-muted/40" />,
});

const SCENARIO_ORDER: CashFlowScenarioId[] = ["pessimistic", "realistic", "optimistic"];
const HORIZONS = [3, 6, 12];

/**
 * Fluxo de caixa projetado: o saldo das carteiras hoje, mais o que está para
 * entrar e menos o que está para sair, em três cenários. Mesma permissão de
 * Lançamentos e mesmo plano do financeiro.
 */
export default function CashFlowPage() {
  const { tenant, isLoading: isTenantLoading } = useTenant();
  const { user } = useAuth();
  const { hasFinancial, isLoading: planLoading } = usePlanLimits();
  // O fluxo parte do saldo de todas as carteiras: é de quem vê todos os lançamentos.
  const { scope: transactionsScope, isLoading: scopeLoading } = usePageScope("transactions");
  const seesAll = !scopeLoading && transactionsScope === "all";
  const { items, startingBalance, walletCount, loading, error } = useCashFlowData(
    tenant?.id,
    hasFinancial && seesAll,
  );
  const { scenarios, update, reset } = useCashFlowScenarios();
  const [selected, setSelected] = React.useState<CashFlowScenarioId>("realistic");
  const [horizon, setHorizon] = React.useState(6);

  const results = React.useMemo(() => {
    const today = brazilToday();
    return Object.fromEntries(
      SCENARIO_ORDER.map((id) => [
        id,
        computeCashFlow({ items, startingBalance, horizonMonths: horizon, scenario: scenarios[id], today }),
      ]),
    ) as Record<CashFlowScenarioId, CashFlowResult>;
  }, [items, startingBalance, horizon, scenarios]);

  if (!isTenantLoading && !tenant && user?.role === "superadmin") return <SelectTenantState />;

  if (!planLoading && !hasFinancial) {
    return (
      <UpgradeRequired
        feature="Fluxo de caixa"
        description="O fluxo de caixa projetado mostra quanto você vai ter em caixa nos próximos meses, em cenários pessimista, realista e otimista. Faça upgrade para o plano Profissional ou adquira o módulo Financeiro."
      />
    );
  }

  if (!scopeLoading && transactionsScope !== "all") {
    return (
      <EmptyState
        icon={EyeOff}
        title="Disponível para quem vê todos os lançamentos"
        description="Seu acesso a Lançamentos mostra só uma parte deles (só receitas ou só os das suas vendas). Este relatório soma a empresa inteira, então fica com quem vê tudo."
      />
    );
  }

  const result = results[selected];
  const scenario = scenarios[selected];
  const isDefault =
    scenario.receiveRate === DEFAULT_SCENARIOS[selected].receiveRate &&
    scenario.delayDays === DEFAULT_SCENARIOS[selected].delayDays;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Fluxo de caixa</h1>
        <p className="mt-1 text-muted-foreground">Quanto você vai ter em caixa nos próximos meses</p>
        <PageViewSwitcher className="mt-3" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div role="group" aria-label="Cenário" className="inline-flex w-full rounded-xl border p-1 sm:w-auto">
          {SCENARIO_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={selected === id}
              onClick={() => setSelected(id)}
              className={cn(
                "flex-1 rounded-lg px-4 py-1.5 text-sm transition sm:flex-none",
                selected === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {SCENARIO_LABELS[id]}
            </button>
          ))}
        </div>
        <Select
          aria-label="Horizonte"
          value={String(horizon)}
          onChange={(e) => setHorizon(Number(e.target.value))}
          disableSort
          className="sm:w-44"
        >
          {HORIZONS.map((h) => (
            <option key={h} value={h}>
              Próximos {h} meses
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <p className="text-sm text-muted-foreground sm:basis-full">
          No cenário {SCENARIO_LABELS[selected].toLowerCase()}, entra esta parte do que está a receber, este tempo
          depois do vencimento. O que está a pagar entra inteiro, no vencimento.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="cash-flow-rate">Recebe (%)</Label>
          <Input
            id="cash-flow-rate"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={scenario.receiveRate}
            onChange={(e) => update(selected, { receiveRate: Number(e.target.value) })}
            className="sm:w-28"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cash-flow-delay">Atraso</Label>
          <Select
            id="cash-flow-delay"
            value={String(scenario.delayDays)}
            onChange={(e) => update(selected, { delayDays: Number(e.target.value) })}
            disableSort
            className="sm:w-40"
          >
            {[...new Set([...DELAY_OPTIONS, scenario.delayDays])]
              .sort((a, b) => a - b)
              .map((d) => (
                <option key={d} value={d}>
                  {d === 0 ? "No vencimento" : `${d} dias depois`}
                </option>
              ))}
          </Select>
        </div>
        {!isDefault && (
          <Button type="button" variant="ghost" onClick={() => reset(selected)}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Voltar ao padrão
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
      )}

      {loading ? (
        <CashFlowSkeleton withHeader={false} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Tile
              label="Saldo hoje"
              value={result.startingBalance}
              hint={walletCount === 1 ? "Em 1 carteira" : `Somando ${walletCount} carteiras`}
            />
            <Tile
              label={`Saldo em ${formatMonthShort(result.months.at(-1)?.key ?? "")}`}
              value={result.endBalance}
              emphasis
            />
            <Tile
              label="Menor saldo"
              value={result.lowest.balance}
              hint={`Em ${formatMonthShort(result.lowest.key)}`}
            />
          </div>

          {result.firstNegative && (
            <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              No cenário {SCENARIO_LABELS[selected].toLowerCase()} o caixa fica negativo em{" "}
              {formatMonthShort(result.firstNegative)}.
            </p>
          )}
          {result.overdueReceivable > 0 && (
            <p className="text-sm text-muted-foreground">
              {formatCurrency(result.overdueReceivable)} a receber já venceu. A projeção conta como se entrasse a
              partir de hoje, com o atraso do cenário.
            </p>
          )}

          <div className="rounded-xl border bg-card p-2 sm:p-4">
            <CashFlowChart results={results} selected={selected} />
          </div>

          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Mês</th>
                  <th className="px-3 py-2 text-right font-medium">Entradas</th>
                  <th className="px-3 py-2 text-right font-medium">Saídas</th>
                  <th className="px-3 py-2 text-right font-medium">Resultado do mês</th>
                  <th className="px-3 py-2 text-right font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {result.months.map((m) => (
                  <tr key={m.key} className="border-b last:border-0">
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      {formatMonthShort(m.key)}
                    </th>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(m.income)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-rose-700 dark:text-rose-400">
                      {formatCurrency(-m.expense)}
                    </td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", m.net < 0 && "text-destructive")}>
                      {formatCurrency(m.net)}
                    </td>
                    <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", m.balance < 0 && "text-destructive")}>
                      {formatCurrency(m.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            A projeção parte do saldo das carteiras e dos lançamentos pendentes e vencidos. Uma recorrência entra quando
            os lançamentos dela já existem.
          </p>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, hint, emphasis }: { label: string; value: number; hint?: string; emphasis?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", emphasis && "border-primary/40")}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", value < 0 && "text-destructive")}>
        {formatCurrency(value)}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
