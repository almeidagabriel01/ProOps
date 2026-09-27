// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBeforeUnloadWarning } from "../use-before-unload-warning";

function dispararSaida() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

describe("useBeforeUnloadWarning", () => {
  it("bloqueia o fechamento da aba enquanto ativo", () => {
    renderHook(() => useBeforeUnloadWarning(true));
    expect(dispararSaida().defaultPrevented).toBe(true);
  });

  it("não interfere quando inativo", () => {
    renderHook(() => useBeforeUnloadWarning(false));
    expect(dispararSaida().defaultPrevented).toBe(false);
  });

  it("solta o aviso ao desativar e ao desmontar", () => {
    const { rerender, unmount } = renderHook(
      ({ ativo }) => useBeforeUnloadWarning(ativo),
      { initialProps: { ativo: true } },
    );
    rerender({ ativo: false });
    expect(dispararSaida().defaultPrevented).toBe(false);

    rerender({ ativo: true });
    unmount();
    expect(dispararSaida().defaultPrevented).toBe(false);
  });
});
