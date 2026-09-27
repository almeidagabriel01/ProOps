import { describe, expect, it } from "vitest";
import { toCsv, type SheetColumn } from "../sheet";
import { buildDreSheet } from "@/lib/finance/dre-export";
import type { DreResult } from "@/services/finance-reports-service";

type Row = { nome: string; valor: number; data: Date | null; obs: string };

const COLUMNS: SheetColumn<Row>[] = [
  { header: "Nome", key: "nome" },
  { header: "Valor", key: "valor", kind: "money" },
  { header: "Data", key: "data", kind: "date" },
  { header: "Obs", key: "obs" },
];

describe("CSV para o Excel em português", () => {
  it("ponto e vírgula, vírgula decimal e data dd/mm/aaaa", () => {
    const csv = toCsv(COLUMNS, [{ nome: "Ana", valor: -1234.5, data: new Date(2026, 8, 3), obs: "" }]);
    expect(csv).toBe("Nome;Valor;Data;Obs\r\nAna;-1234,50;03/09/2026;");
  });

  it("texto com ponto e vírgula, aspas ou quebra de linha vai entre aspas", () => {
    const csv = toCsv(COLUMNS, [{ nome: 'Loja "Centro"; filial', valor: 0, data: null, obs: "linha1\nlinha2" }]);
    expect(csv.split("\r\n")[1]).toBe('"Loja ""Centro""; filial";0,00;;"linha1\nlinha2"');
  });
});

describe("DRE em planilha", () => {
  const empty = { byMonth: { "2026-09": 0 }, total: 0, categories: [] };
  const dre = {
    basis: "cash",
    months: ["2026-09"],
    count: 2,
    truncated: false,
    groups: {
      revenue: { group: "revenue", label: "Receita bruta", byMonth: { "2026-09": 1000 }, total: 1000, categories: [{ name: "Propostas", byMonth: { "2026-09": 1000 }, total: 1000 }] },
      other_income: { group: "other_income", label: "Outras receitas", ...empty },
      deduction: { group: "deduction", label: "Impostos e deduções", ...empty },
      cost: { group: "cost", label: "Custos", byMonth: { "2026-09": 300 }, total: 300, categories: [{ name: "Materiais", byMonth: { "2026-09": 300 }, total: 300 }] },
      operating: { group: "operating", label: "Despesas operacionais", ...empty },
      other_expense: { group: "other_expense", label: "Outras despesas", ...empty },
    },
    totals: {
      netRevenue: { byMonth: { "2026-09": 1000 }, total: 1000 },
      grossProfit: { byMonth: { "2026-09": 700 }, total: 700 },
      operatingResult: { byMonth: { "2026-09": 700 }, total: 700 },
      result: { byMonth: { "2026-09": 700 }, total: 700 },
    },
  } as unknown as DreResult;

  it("mesma ordem da tela, despesa negativa e subtotais em negrito", () => {
    const { columns, rows, boldRows } = buildDreSheet(dre);
    expect(columns.map((c) => c.header)).toEqual(["Linha", "set/26", "Total"]);
    const byLabel = Object.fromEntries(rows.map((r) => [String(r.linha).trim(), r.total]));
    expect(byLabel["(-) Custos"]).toBe(-300);
    expect(byLabel["Materiais"]).toBe(-300);
    expect(byLabel["= Lucro bruto"]).toBe(700);
    expect(rows.at(-1)).toMatchObject({ linha: "= Resultado do período", total: 700 });
    // Grupos e subtotais em negrito; categorias não.
    const materiais = rows.findIndex((r) => String(r.linha).trim() === "Materiais");
    expect(boldRows).not.toContain(materiais);
    expect(boldRows).toContain(rows.length - 1);
  });
});
