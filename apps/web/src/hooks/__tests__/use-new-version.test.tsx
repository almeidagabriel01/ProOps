// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

/**
 * Aba aberta numa versão antiga do ERP. O dono da AWA passou um dia inteiro
 * voltando para a mesma aba, aberta antes da publicação do aviso de presença,
 * e a empresa nunca apareceu online: o código da aba só muda ao recarregar.
 */

let pathname = "/dashboard";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const fetchLive = vi.fn<() => Promise<string | null>>();
const reloadPage = vi.fn();
vi.mock("@/lib/app-version", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/app-version")>();
  return {
    ...actual,
    fetchLiveDeploymentId: () => fetchLive(),
    reloadPage: () => reloadPage(),
  };
});

import { useNewVersion, VERSION_CHECK_INTERVAL_MS, VERSION_CHECK_MIN_GAP_MS } from "../use-new-version";

let visibility: DocumentVisibilityState = "visible";

function setVisibility(next: DocumentVisibilityState) {
  visibility = next;
  document.dispatchEvent(new Event("visibilitychange"));
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  pathname = "/dashboard";
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  fetchLive.mockReset().mockResolvedValue("dpl_nova");
  reloadPage.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useNewVersion", () => {
  it("não consulta ao abrir: a aba acabou de carregar na versão publicada", () => {
    renderHook(() => useNewVersion("dpl_antiga"));
    expect(fetchLive).not.toHaveBeenCalled();
  });

  it("voltar para a aba depois de 5 min com outra publicação no ar mostra o aviso", async () => {
    const { result } = renderHook(() => useNewVersion("dpl_antiga"));
    vi.advanceTimersByTime(VERSION_CHECK_MIN_GAP_MS);
    act(() => setVisibility("hidden"));
    act(() => setVisibility("visible"));
    await flush();
    expect(fetchLive).toHaveBeenCalledTimes(1);
    expect(result.current.showBanner).toBe(true);
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it("parada na mesma tela com a aba à vista, consulta a cada 15 min", async () => {
    const { result } = renderHook(() => useNewVersion("dpl_antiga"));
    await act(async () => {
      vi.advanceTimersByTime(VERSION_CHECK_INTERVAL_MS);
    });
    await flush();
    expect(result.current.showBanner).toBe(true);
  });

  it("aba escondida não consulta pelo intervalo", async () => {
    renderHook(() => useNewVersion("dpl_antiga"));
    visibility = "hidden";
    await act(async () => {
      vi.advanceTimersByTime(VERSION_CHECK_INTERVAL_MS);
    });
    expect(fetchLive).not.toHaveBeenCalled();
  });

  it("mesma versão no ar: nada de aviso, nada de recarregar", async () => {
    fetchLive.mockResolvedValue("dpl_antiga");
    const { result, rerender } = renderHook(() => useNewVersion("dpl_antiga"));
    vi.advanceTimersByTime(VERSION_CHECK_MIN_GAP_MS);
    act(() => setVisibility("visible"));
    await flush();
    expect(result.current.showBanner).toBe(false);
    pathname = "/proposals";
    rerender();
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it("a troca de tela seguinte recarrega sozinha, mesmo com o aviso dispensado", async () => {
    const { result, rerender } = renderHook(() => useNewVersion("dpl_antiga"));
    vi.advanceTimersByTime(VERSION_CHECK_MIN_GAP_MS);
    act(() => setVisibility("visible"));
    await flush();
    act(() => result.current.dismiss());
    expect(result.current.showBanner).toBe(false);

    pathname = "/proposals";
    rerender();
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it("troca de tela sem saber da versão nova só consulta, sem recarregar", async () => {
    const { rerender } = renderHook(() => useNewVersion("dpl_antiga"));
    vi.advanceTimersByTime(VERSION_CHECK_MIN_GAP_MS);
    pathname = "/proposals";
    rerender();
    await flush();
    expect(fetchLive).toHaveBeenCalledTimes(1);
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it("no máximo uma consulta a cada 5 min", async () => {
    fetchLive.mockResolvedValue("dpl_antiga");
    renderHook(() => useNewVersion("dpl_antiga"));
    vi.advanceTimersByTime(VERSION_CHECK_MIN_GAP_MS);
    act(() => setVisibility("visible"));
    await flush();
    act(() => setVisibility("visible"));
    await flush();
    expect(fetchLive).toHaveBeenCalledTimes(1);
  });

  it("o botão do aviso recarrega", () => {
    const { result } = renderHook(() => useNewVersion("dpl_antiga"));
    act(() => result.current.reload());
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it("fora da Vercel (sem versão embutida) não faz nada", async () => {
    const { rerender } = renderHook(() => useNewVersion(""));
    vi.advanceTimersByTime(VERSION_CHECK_INTERVAL_MS);
    act(() => setVisibility("visible"));
    pathname = "/proposals";
    rerender();
    await flush();
    expect(fetchLive).not.toHaveBeenCalled();
    expect(reloadPage).not.toHaveBeenCalled();
  });
});
