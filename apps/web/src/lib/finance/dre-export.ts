import { MONEY_FORMAT, type SheetCell, type SheetColumn } from "@/lib/export/sheet";
import { formatMonthShort } from "@/lib/finance/dre-period";
import type { DreGroup, DreResult, DreSubtotalKey } from "@/services/finance-reports-service";

type Line =
  | { kind: "group"; group: DreGroup; sign: "+" | "-" }
  | { kind: "subtotal"; key: DreSubtotalKey; label: string };

/** A ordem da tela: cada grupo com o sinal, e os subtotais entre eles. */
export const DRE_LINES: Line[] = [
  { kind: "group", group: "revenue", sign: "+" },
  { kind: "group", group: "deduction", sign: "-" },
  { kind: "subtotal", key: "netRevenue", label: "Receita líquida" },
  { kind: "group", group: "cost", sign: "-" },
  { kind: "subtotal", key: "grossProfit", label: "Lucro bruto" },
  { kind: "group", group: "operating", sign: "-" },
  { kind: "subtotal", key: "operatingResult", label: "Resultado operacional" },
  { kind: "group", group: "other_income", sign: "+" },
  { kind: "group", group: "other_expense", sign: "-" },
  { kind: "subtotal", key: "result", label: "Resultado do período" },
];

export type DreSheetRow = Record<string, SheetCell>;

/**
 * O DRE em planilha: uma linha por grupo, as categorias dele logo abaixo
 * (recuadas), e os subtotais em negrito. Despesa sai com sinal de menos, como
 * na tela, para a soma da coluna bater com o resultado.
 */
export function buildDreSheet(dre: DreResult): {
  columns: SheetColumn<DreSheetRow>[];
  rows: DreSheetRow[];
  boldRows: number[];
} {
  const columns: SheetColumn<DreSheetRow>[] = [
    { header: "Linha", key: "linha", width: 34, kind: "text" },
    ...dre.months.map((m) => ({ header: formatMonthShort(m), key: m, width: 14, numFmt: MONEY_FORMAT, kind: "money" as const })),
    { header: "Total", key: "total", width: 16, numFmt: MONEY_FORMAT, kind: "money" },
  ];
  const rows: DreSheetRow[] = [];
  const boldRows: number[] = [];
  const values = (byMonth: Record<string, number>, total: number, negative: boolean) => {
    const sign = negative ? -1 : 1;
    const row: DreSheetRow = {};
    for (const m of dre.months) row[m] = (byMonth[m] ?? 0) * sign || 0;
    row.total = total * sign || 0;
    return row;
  };

  for (const line of DRE_LINES) {
    if (line.kind === "subtotal") {
      const t = dre.totals[line.key];
      boldRows.push(rows.length);
      rows.push({ linha: `= ${line.label}`, ...values(t.byMonth, t.total, false) });
      continue;
    }
    const block = dre.groups[line.group];
    const negative = line.sign === "-";
    boldRows.push(rows.length);
    rows.push({ linha: `(${line.sign === "+" ? "+" : "-"}) ${block.label}`, ...values(block.byMonth, block.total, negative) });
    for (const category of block.categories) {
      rows.push({ linha: `    ${category.name}`, ...values(category.byMonth, category.total, negative) });
    }
  }
  return { columns, rows, boldRows };
}
