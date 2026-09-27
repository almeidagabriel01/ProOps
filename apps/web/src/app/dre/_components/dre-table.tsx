"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";
import { formatMonthShort } from "@/lib/finance/dre-period";
import type { DreGroup, DreResult, DreSubtotalKey } from "@/services/finance-reports-service";

interface DreTableProps {
  dre: DreResult;
}

type Row =
  | { kind: "group"; group: DreGroup; sign: "+" | "-" }
  | { kind: "subtotal"; key: DreSubtotalKey; label: string; final?: boolean };

/** A ordem do DRE: cada grupo com o sinal, e os subtotais entre eles. */
const ROWS: Row[] = [
  { kind: "group", group: "revenue", sign: "+" },
  { kind: "group", group: "deduction", sign: "-" },
  { kind: "subtotal", key: "netRevenue", label: "Receita líquida" },
  { kind: "group", group: "cost", sign: "-" },
  { kind: "subtotal", key: "grossProfit", label: "Lucro bruto" },
  { kind: "group", group: "operating", sign: "-" },
  { kind: "subtotal", key: "operatingResult", label: "Resultado operacional" },
  { kind: "group", group: "other_income", sign: "+" },
  { kind: "group", group: "other_expense", sign: "-" },
  { kind: "subtotal", key: "result", label: "Resultado do período", final: true },
];

function Amount({
  value,
  negative,
  strong,
  total,
}: {
  value: number;
  negative?: boolean;
  strong?: boolean;
  /**
   * A coluna Total: em negrito e presa à direita, visível mesmo quando os
   * meses rolam. O fundo é o da linha, sólido, senão o texto que rola por
   * baixo aparece através dela.
   */
  total?: "bg-card" | "bg-muted";
}) {
  const shown = negative && value !== 0 ? -value : value;
  return (
    <td
      className={cn(
        "min-w-[120px] whitespace-nowrap px-3 py-2 text-right tabular-nums",
        (strong || total) && "font-semibold",
        total && cn("sticky right-0 z-10 border-l", total),
        shown < 0 && "text-destructive",
        value === 0 && "text-muted-foreground",
      )}
    >
      {formatCurrency(shown)}
    </td>
  );
}

/**
 * O DRE em tabela: uma coluna por mês e o total. Despesa aparece com sinal de
 * menos; os subtotais mostram quanto sobrou em cada degrau. Cada grupo abre as
 * categorias dele.
 */
export function DreTable({ dre }: DreTableProps) {
  const [collapsed, setCollapsed] = React.useState<Set<DreGroup>>(new Set());
  const showMonths = dre.months.length > 1;

  const toggle = (group: DreGroup) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  return (
    // Largura fixa: a tabela ocupa sempre a largura da página, com qualquer
    // quantidade de meses (decisão do produto); passando dela, rola por dentro,
    // com Linha e Total presos nas pontas.
    <div className="w-full overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <th className="sticky left-0 z-10 min-w-[240px] bg-muted px-3 py-2 text-left font-medium">Linha</th>
            {showMonths &&
              dre.months.map((m) => (
                <th key={m} className="px-3 py-2 text-right font-medium">
                  {formatMonthShort(m)}
                </th>
              ))}
            <th className="sticky right-0 z-10 border-l bg-muted px-3 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => {
            if (row.kind === "subtotal") {
              const values = dre.totals[row.key];
              return (
                <tr
                  key={row.key}
                  className={cn("border-b bg-muted", row.final && "text-base")}
                >
                  <th scope="row" className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-semibold">
                    = {row.label}
                  </th>
                  {showMonths && dre.months.map((m) => <Amount key={m} value={values.byMonth[m] ?? 0} strong />)}
                  <Amount value={values.total} strong total="bg-muted" />
                </tr>
              );
            }
            const block = dre.groups[row.group];
            const negative = row.sign === "-";
            const isOpen = !collapsed.has(row.group);
            const hasLines = block.categories.length > 0;
            return (
              <React.Fragment key={row.group}>
                <tr className="border-b">
                  <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium">
                    <button
                      type="button"
                      onClick={() => hasLines && toggle(row.group)}
                      aria-expanded={hasLines ? isOpen : undefined}
                      disabled={!hasLines}
                      className="inline-flex items-center gap-1 disabled:cursor-default"
                    >
                      {hasLines ? (
                        isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <span className="w-3.5" />
                      )}
                      ({row.sign === "+" ? "+" : "−"}) {block.label}
                    </button>
                  </th>
                  {showMonths &&
                    dre.months.map((m) => <Amount key={m} value={block.byMonth[m] ?? 0} negative={negative} />)}
                  <Amount value={block.total} negative={negative} total="bg-card" />
                </tr>
                {isOpen &&
                  block.categories.map((line) => (
                    <tr key={`${row.group}:${line.name}`} className="border-b text-muted-foreground">
                      <th scope="row" className="sticky left-0 z-10 bg-card py-1.5 pl-10 pr-3 text-left font-normal">
                        {line.name}
                      </th>
                      {showMonths &&
                        dre.months.map((m) => <Amount key={m} value={line.byMonth[m] ?? 0} negative={negative} />)}
                      <Amount value={line.total} negative={negative} total="bg-card" />
                    </tr>
                  ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
