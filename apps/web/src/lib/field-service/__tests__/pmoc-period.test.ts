import { describe, expect, it } from "vitest";
import { pmocPeriod } from "../pmoc-period";

describe("períodos do relatório do PMOC", () => {
  it.each([
    ["last12", "2026-10-03", { from: "2025-10-04", to: "2026-10-03" }],
    ["last6", "2026-10-03", { from: "2026-04-04", to: "2026-10-03" }],
    ["thisYear", "2026-10-03", { from: "2026-01-01", to: "2026-10-03" }],
    ["lastYear", "2026-10-03", { from: "2025-01-01", to: "2025-12-31" }],
    ["last12", "2028-02-29", { from: "2027-03-02", to: "2028-02-29" }],
  ] as const)("%s em %s", (preset, today, expected) => {
    expect(pmocPeriod(preset, today)).toEqual(expected);
  });

  it("o mais longo cabe no teto de dois anos do backend", () => {
    const { from, to } = pmocPeriod("last12", "2026-10-03");
    expect((Date.parse(to) - Date.parse(from)) / 86_400_000).toBeLessThanOrEqual(731);
  });
});
