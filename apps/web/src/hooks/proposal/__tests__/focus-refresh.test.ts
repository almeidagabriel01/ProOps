import { describe, expect, it } from "vitest";
import { PROPOSAL_FOCUS_REFRESH_MIN_INTERVAL_MS, shouldRefreshOnFocus } from "../focus-refresh";

describe("shouldRefreshOnFocus", () => {
  it("sem carga anterior, recarrega", () => {
    expect(shouldRefreshOnFocus(null, 1000)).toBe(true);
  });
  it("troca de aba logo depois de carregar não baixa o catálogo de novo", () => {
    expect(shouldRefreshOnFocus(0, 30_000)).toBe(false);
    expect(shouldRefreshOnFocus(0, PROPOSAL_FOCUS_REFRESH_MIN_INTERVAL_MS - 1)).toBe(false);
  });
  it("depois do intervalo, recarrega", () => {
    expect(shouldRefreshOnFocus(0, PROPOSAL_FOCUS_REFRESH_MIN_INTERVAL_MS)).toBe(true);
  });
});
