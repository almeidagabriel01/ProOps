// @vitest-environment jsdom
/**
 * Editar o estoque, excluir um produto ou receber um aviso de auto-save
 * chamava `reset()`, que limpa a tabela, mostra skeleton e volta ao topo. As
 * duas saídas novas mantêm as linhas na tela.
 */
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

vi.mock("@/providers/scroll-container-provider", () => ({
  useScrollContainer: () => null,
}));

import { useAsyncInfiniteScroll } from "../useInfiniteScroll";

type Row = { id: string; stock: number };

function setup(pages: Row[][]) {
  const fetchPage = vi.fn();
  pages.forEach((data) =>
    fetchPage.mockResolvedValueOnce({ data, lastDoc: null, hasMore: false }),
  );
  const hook = renderHook(() => useAsyncInfiniteScroll<Row>({ fetchPage }));
  return { hook, fetchPage };
}

describe("useAsyncInfiniteScroll: atualizações locais", () => {
  it("updateItems edita a linha sem nova busca e sem voltar a carregar", async () => {
    const { hook, fetchPage } = setup([[{ id: "a", stock: 1 }, { id: "b", stock: 2 }]]);
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    act(() => {
      hook.result.current.updateItems((items) =>
        items.map((r) => (r.id === "a" ? { ...r, stock: 9 } : r)),
      );
    });

    expect(hook.result.current.items).toEqual([{ id: "a", stock: 9 }, { id: "b", stock: 2 }]);
    expect(hook.result.current.isLoading).toBe(false);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("updateItems remove item excluído", async () => {
    const { hook } = setup([[{ id: "a", stock: 1 }, { id: "b", stock: 2 }]]);
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    act(() => hook.result.current.updateItems((items) => items.filter((r) => r.id !== "a")));
    expect(hook.result.current.items).toEqual([{ id: "b", stock: 2 }]);
  });

  it("refresh mantém as linhas atuais até a resposta e nunca liga o skeleton", async () => {
    let resolveSecond: (v: unknown) => void = () => {};
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: "a", stock: 1 }], lastDoc: null, hasMore: false })
      .mockImplementationOnce(() => new Promise((r) => (resolveSecond = r)));
    const hook = renderHook(() => useAsyncInfiniteScroll<Row>({ fetchPage }));
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    act(() => hook.result.current.refresh());
    expect(hook.result.current.items).toEqual([{ id: "a", stock: 1 }]);
    expect(hook.result.current.isLoading).toBe(false);

    await act(async () => {
      resolveSecond({ data: [{ id: "n", stock: 0 }, { id: "a", stock: 1 }], lastDoc: null, hasMore: false });
    });
    expect(hook.result.current.items.map((r) => r.id)).toEqual(["n", "a"]);
    expect(hook.result.current.isLoading).toBe(false);
  });

  it("reset continua limpando e recarregando (comportamento antigo preservado)", async () => {
    const { hook, fetchPage } = setup([[{ id: "a", stock: 1 }], [{ id: "b", stock: 2 }]]);
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    act(() => hook.result.current.reset());
    expect(hook.result.current.items).toEqual([]);
    expect(hook.result.current.isLoading).toBe(true);
    await waitFor(() => expect(hook.result.current.items).toEqual([{ id: "b", stock: 2 }]));
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
});
