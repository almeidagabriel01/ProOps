/**
 * O relatório de execução do PMOC: o período (padrão e limites), as visitas
 * que entram e o que conta como item feito.
 */

import { itemExecutions, normalizeReportPeriod, reportVisits, visitDay } from "./pmoc-report";
import type { PmocItem } from "../../../shared/pmoc";

const TODAY = "2026-10-03";

describe("período", () => {
  it("sem datas, os últimos 12 meses", () => {
    expect(normalizeReportPeriod(undefined, undefined, TODAY)).toEqual({ from: "2025-10-04", to: TODAY });
  });

  it("período válido vale como pedido", () => {
    expect(normalizeReportPeriod("2026-01-01", "2026-06-30", TODAY)).toEqual({ from: "2026-01-01", to: "2026-06-30" });
  });

  it.each([
    ["invertido", "2026-06-30", "2026-01-01"],
    ["fora do formato", "01/01/2026", "2026-06-30"],
    ["mais de dois anos", "2023-01-01", "2026-06-30"],
    ["lista em vez de texto", ["2026-01-01"], "2026-06-30"],
  ])("%s cai no padrão", (_label, from, to) => {
    expect(normalizeReportPeriod(from, to, TODAY)).toEqual({ from: "2025-10-04", to: TODAY });
  });
});

describe("dia da visita", () => {
  it("a conclusão manda, no fuso de Brasília", () => {
    expect(visitDay({ completedAt: "2026-10-03T01:30:00.000Z", scheduledStart: "2026-09-30T11:00:00.000Z" })).toBe(
      "2026-10-02",
    );
  });

  it("sem conclusão, a saída; sem saída, o agendado; sem nada, nenhum", () => {
    expect(visitDay({ checkOutAt: "2026-10-03T15:00:00.000Z" })).toBe("2026-10-03");
    expect(visitDay({ scheduledStart: "2026-10-09T11:00:00.000Z" })).toBe("2026-10-09");
    expect(visitDay({})).toBeNull();
  });
});

const ITEMS: PmocItem[] = [
  { id: "split_filtros", category: "split", text: "Limpar os filtros", frequency: "monthly" },
  { id: "split_gas", category: "split", text: "Testar vazamentos", frequency: "semiannual" },
];

const order = (over: Record<string, unknown>) => ({
  code: "OS-0001",
  status: "completed",
  completedAt: "2026-03-10T14:00:00.000Z",
  technicianName: "Téo",
  checklist: [
    { id: "pmoc_split_filtros", text: "Split: Limpar os filtros", done: true },
    { id: "pmoc_split_gas", text: "Split: Testar vazamentos", done: false },
  ],
  ...over,
});

describe("visitas do período", () => {
  const period = { from: "2026-01-01", to: "2026-06-30" };

  it("entram as do período, em ordem, sem as canceladas", () => {
    const visits = reportVisits(
      [
        order({ code: "OS-3", completedAt: "2026-05-10T14:00:00.000Z" }),
        order({ code: "OS-1", completedAt: "2026-02-10T14:00:00.000Z" }),
        order({ code: "OS-X", status: "canceled", completedAt: "2026-03-10T14:00:00.000Z" }),
        order({ code: "OS-fora", completedAt: "2026-08-10T14:00:00.000Z" }),
      ],
      period,
    );
    expect(visits.map((v) => v.code)).toEqual(["OS-1", "OS-3"]);
    expect(visits[0]).toMatchObject({ day: "2026-02-10", doneCount: 1, technicianName: "Téo" });
  });

  it("a visita agendada ainda aberta aparece, sem contar item feito", () => {
    const visits = reportVisits(
      [order({ status: "scheduled", completedAt: undefined, scheduledStart: "2026-06-20T11:00:00.000Z" })],
      period,
    );
    expect(visits).toHaveLength(1);
    expect(itemExecutions(ITEMS, [order({ status: "scheduled", completedAt: undefined })], period)[0].timesDone).toBe(
      0,
    );
  });

  it("a visita não leva ids nem caminho de arquivo, só o que o relatório mostra", () => {
    const [visit] = reportVisits([order({ signature: { name: "Ana", storagePath: "x", ip: "1.2.3.4" } })], period);
    expect(visit.signedBy).toBe("Ana");
    expect(JSON.stringify(visit)).not.toMatch(/storagePath|1\.2\.3\.4|pmoc_split/);
  });
});

describe("execução por item", () => {
  const period = { from: "2026-01-01", to: "2026-12-31" };

  it("conta quantas vezes cada item foi marcado e a última data", () => {
    const executions = itemExecutions(
      ITEMS,
      [
        order({ completedAt: "2026-02-10T14:00:00.000Z" }),
        order({ completedAt: "2026-05-10T14:00:00.000Z" }),
        order({
          completedAt: "2026-07-10T14:00:00.000Z",
          checklist: [{ id: "pmoc_split_gas", text: "", done: true }],
        }),
      ],
      period,
    );
    expect(executions).toEqual([
      expect.objectContaining({ id: "split_filtros", timesDone: 2, lastDoneOn: "2026-05-10", frequency: "Mensal" }),
      expect.objectContaining({ id: "split_gas", timesDone: 1, lastDoneOn: "2026-07-10", category: "Split" }),
    ]);
  });

  it("item de checklist comum (sem o prefixo do PMOC) não conta", () => {
    const executions = itemExecutions(
      ITEMS,
      [order({ checklist: [{ id: "visit_0", text: "Limpar os filtros", done: true }] })],
      period,
    );
    expect(executions.every((e) => e.timesDone === 0)).toBe(true);
  });
});
