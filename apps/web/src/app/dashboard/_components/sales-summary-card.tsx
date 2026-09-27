"use client";

import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMonthLabel, shiftMonth } from "@/lib/month-key";
import { cn } from "@/lib/utils";
import type { SalesSummary } from "@/lib/sales/dashboard-sales";

interface SalesSummaryCardProps {
  month: string;
  summary: SalesSummary | null;
  /** Conversão geral das propostas enviadas (as contagens do kanban). */
  conversionRate: number;
  loading: boolean;
  isDemo?: boolean;
}

/** A conta de demonstração não tem vendas no mês: mostra um exemplo, rotulado. */
export const DEMO_SALES_SUMMARY: SalesSummary = {
  sold: 84200,
  soldCount: 5,
  ticket: 16840,
  previousSold: 75100,
  deltaPercent: 12,
  openValue: 132000,
  openCount: 9,
};

function money(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1 rounded-xl border border-border/50 bg-background/60 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-2xl font-bold tracking-tight">{value}</p>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

/**
 * Vendas do mês escolhido, pelas propostas aprovadas nele: a mesma regra das
 * Metas, então "Vendido" e o progresso da meta batem.
 */
export function SalesSummaryCard({ month, summary, conversionRate, loading, isDemo }: SalesSummaryCardProps) {
  const monthName = formatMonthLabel(month).split(" ")[0].toLocaleLowerCase("pt-BR");
  const previousName = formatMonthLabel(shiftMonth(month, -1)).split(" ")[0].toLocaleLowerCase("pt-BR");
  const data = isDemo ? DEMO_SALES_SUMMARY : summary;

  return (
    <Card className="border border-border/50 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5" />
          Vendas de {monthName}
        </CardTitle>
        <CardDescription>
          {isDemo ? "Exemplo da conta de demonstração." : "Pelas propostas aprovadas no mês."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Mesma grade no carregando e no pronto: nada muda de altura ao chegar. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {loading && !isDemo ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[98px] rounded-xl" />)
          ) : !data ? (
            <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
              Não foi possível carregar as vendas agora. Tente de novo em alguns minutos.
            </p>
          ) : (
            <>
              <Kpi
                label="Vendido"
                value={money(data.sold)}
                hint={
                  data.deltaPercent === null ? (
                    `Sem vendas em ${previousName}`
                  ) : (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 font-medium",
                        data.deltaPercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
                      )}
                    >
                      {data.deltaPercent >= 0 ? (
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5" />
                      )}
                      {Math.abs(data.deltaPercent)}% contra {previousName}
                    </span>
                  )
                }
              />
              <Kpi
                label="Em negociação"
                value={money(data.openValue)}
                hint={`${plural(data.openCount, "proposta", "propostas")} com o cliente`}
              />
              <Kpi label="Conversão" value={`${conversionRate}%`} hint="Das propostas enviadas" />
              <Kpi
                label="Ticket médio"
                value={money(data.ticket)}
                hint={plural(data.soldCount, "venda no mês", "vendas no mês")}
              />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
