// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { replaceUrlSearchParams } from "../url-state";

beforeEach(() => {
  window.history.replaceState(null, "", "/proposals?view=grouped");
});

describe("replaceUrlSearchParams", () => {
  it("acrescenta e troca chaves sem perder as outras", () => {
    replaceUrlSearchParams({ q: "casa joão", status: "sent" });
    const params = new URLSearchParams(window.location.search);
    expect(params.get("view")).toBe("grouped");
    expect(params.get("q")).toBe("casa joão");
    expect(params.get("status")).toBe("sent");
    expect(window.location.pathname).toBe("/proposals");
  });

  it("valor vazio ou nulo remove a chave", () => {
    replaceUrlSearchParams({ q: "x" });
    replaceUrlSearchParams({ q: "", view: null });
    expect(window.location.search).toBe("");
  });

  it("não reescreve o histórico quando nada mudou", () => {
    const spy = vi.spyOn(window.history, "replaceState");
    replaceUrlSearchParams({ view: "grouped" });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
