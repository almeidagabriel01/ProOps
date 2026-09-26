import { describe, expect, it } from "vitest";
import { currentBrazilMonth, formatMonthShort, marginOf, presetRange } from "../dre-period";

// 01/01/2027 às 01:00 UTC ainda é 31/12/2026 em Brasília.
const VIRADA = Date.UTC(2027, 0, 1, 1, 0);
const MEIO_DO_ANO = Date.UTC(2026, 8, 26, 15, 0);

describe("períodos do DRE", () => {
  it("o mês atual é o de Brasília, não o de UTC", () => {
    expect(currentBrazilMonth(VIRADA)).toEqual({ year: 2026, month: 12 });
  });

  it.each([
    ["this_month", { from: "2026-09", to: "2026-09" }],
    ["last_month", { from: "2026-08", to: "2026-08" }],
    ["last_3", { from: "2026-07", to: "2026-09" }],
    ["last_6", { from: "2026-04", to: "2026-09" }],
    ["this_year", { from: "2026-01", to: "2026-09" }],
    ["last_12", { from: "2025-10", to: "2026-09" }],
  ] as const)("%s", (preset, expected) => {
    expect(presetRange(preset, MEIO_DO_ANO)).toEqual(expected);
  });

  it("mês passado em janeiro volta para dezembro do ano anterior", () => {
    expect(presetRange("last_month", Date.UTC(2027, 0, 15, 12))).toEqual({ from: "2026-12", to: "2026-12" });
  });

  it("rótulo curto do mês e margem", () => {
    expect(formatMonthShort("2026-09")).toBe("set/26");
    expect(marginOf(250, 1000)).toBe(25);
    expect(marginOf(1, 3)).toBe(33.3);
    expect(marginOf(10, 0)).toBeNull();
  });
});
