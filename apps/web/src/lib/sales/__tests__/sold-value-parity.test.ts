import { describe, expect, it } from "vitest";
import { soldValue as front } from "../sold-value";
import { soldValue as backend } from "../../../../../functions/src/shared/sold-value";
import { monthWindowUtc as frontWindow } from "../sales-month";
import { monthWindowUtc as backendWindow } from "../../../../../functions/src/shared/sales-month";

/** "Vendido" no Dashboard e o progresso das Metas saem da mesma conta. */
const CASES: Array<{ closedValue?: unknown; totalValue?: unknown }> = [
  { closedValue: 9000, totalValue: 10000 },
  { closedValue: 0, totalValue: 10000 },
  { closedValue: null, totalValue: 10000 },
  { totalValue: 10000 },
  { closedValue: "8500", totalValue: 10000 },
  { closedValue: -5, totalValue: 10000 },
  { closedValue: Number.NaN, totalValue: 10000 },
  { totalValue: -1 },
  { totalValue: undefined },
  {},
];

describe("soldValue: front e backend", () => {
  it.each(CASES)("%o", (proposal) => {
    expect(front(proposal)).toBe(backend(proposal));
  });

  it("usa o valor fechado quando houver", () => {
    expect(front({ closedValue: 9000, totalValue: 10000 })).toBe(9000);
    expect(front({ closedValue: 0, totalValue: 10000 })).toBe(10000);
  });
});

describe("janela do mês: front e backend", () => {
  it.each(["2026-01", "2026-09", "2026-12", "2027-02"])("%s", (month) => {
    expect(frontWindow(month)).toEqual(backendWindow(month));
  });

  it("vira o ano em dezembro, no fuso de Brasília", () => {
    expect(frontWindow("2026-12")).toEqual({
      start: "2026-12-01T03:00:00.000Z",
      end: "2027-01-01T03:00:00.000Z",
    });
  });
});
