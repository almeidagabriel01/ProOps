// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

/**
 * O aviso de presenca dispara por EVENTO: abriu a plataforma (uma vez por aba
 * por usuario) ou voltou para a aba, com pelo menos 5 min desde o ultimo aviso.
 * A versao anterior avisava uma vez por DIA, e quem entrava as 9h e voltava as
 * 14h ficava registrado as 9h, justamente o horario que a tela passou a mostrar.
 */

const callApi = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/api-client", () => ({ callApi: (...a: unknown[]) => callApi(...a) }));

import {
  RETURN_AFTER_MS,
  parsePingMark,
  shouldPingOnOpen,
  shouldPingOnReturn,
  useSessionPing,
} from "../use-session-ping";

const T0 = Date.parse("2026-09-23T12:00:00.000Z");

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("regras puras", () => {
  it("abrir sem marca avisa; com marca do mesmo usuario nao repete", () => {
    expect(shouldPingOnOpen(null, "u1")).toBe(true);
    expect(shouldPingOnOpen({ uid: "u1", at: T0 }, "u1")).toBe(false);
  });

  it("outro usuario na mesma aba conta como acesso novo", () => {
    expect(shouldPingOnOpen({ uid: "u1", at: T0 }, "u2")).toBe(true);
    expect(shouldPingOnReturn({ uid: "u1", at: T0 }, "u2", T0)).toBe(true);
  });

  it("voltar para a aba so avisa passados 5 min do ultimo aviso", () => {
    expect(shouldPingOnReturn({ uid: "u1", at: T0 }, "u1", T0 + RETURN_AFTER_MS - 1)).toBe(false);
    expect(shouldPingOnReturn({ uid: "u1", at: T0 }, "u1", T0 + RETURN_AFTER_MS)).toBe(true);
  });

  it("sem usuario nunca avisa", () => {
    expect(shouldPingOnOpen(null, "")).toBe(false);
    expect(shouldPingOnReturn(null, "", T0)).toBe(false);
  });

  it("marca corrompida vira ausencia de marca", () => {
    expect(parsePingMark("lixo")).toBeNull();
    expect(parsePingMark(JSON.stringify({ uid: 1 }))).toBeNull();
  });
});

describe("useSessionPing", () => {
  it("avisa ao abrir a plataforma e nao repete ao re-renderizar", () => {
    const { rerender } = renderHook(() => useSessionPing({ id: "u1", role: "master" }));
    expect(callApi).toHaveBeenCalledTimes(1);
    expect(callApi).toHaveBeenCalledWith("/v1/session/ping", "POST", {});
    rerender();
    expect(callApi).toHaveBeenCalledTimes(1);
  });

  it("recarregar a mesma aba nao conta de novo", () => {
    const first = renderHook(() => useSessionPing({ id: "u1", role: "master" }));
    first.unmount();
    renderHook(() => useSessionPing({ id: "u1", role: "master" }));
    expect(callApi).toHaveBeenCalledTimes(1);
  });

  it("voltar para a aba horas depois registra o horario novo (o caso 9h/14h)", () => {
    renderHook(() => useSessionPing({ id: "u1", role: "master" }));
    expect(callApi).toHaveBeenCalledTimes(1);

    setVisibility("hidden");
    vi.setSystemTime(T0 + 5 * 60 * 60 * 1000);
    setVisibility("visible");
    expect(callApi).toHaveBeenCalledTimes(2);
  });

  it("alt-tab rapido nao gera aviso", () => {
    renderHook(() => useSessionPing({ id: "u1", role: "master" }));
    setVisibility("hidden");
    vi.setSystemTime(T0 + 30 * 1000);
    setVisibility("visible");
    expect(callApi).toHaveBeenCalledTimes(1);
  });

  it("conta gratuita tambem avisa: e a empresa que criou e nao assinou", () => {
    renderHook(() => useSessionPing({ id: "u1", role: "free" }));
    expect(callApi).toHaveBeenCalledTimes(1);
  });

  it("super admin nao avisa, nem ao abrir nem ao voltar", () => {
    renderHook(() => useSessionPing({ id: "root", role: "superadmin" }));
    vi.setSystemTime(T0 + 60 * 60 * 1000);
    setVisibility("visible");
    expect(callApi).not.toHaveBeenCalled();
  });

  it("sem usuario nao avisa", () => {
    renderHook(() => useSessionPing(null));
    expect(callApi).not.toHaveBeenCalled();
  });

  it("para de escutar a aba ao sair da area logada", () => {
    const { unmount } = renderHook(() => useSessionPing({ id: "u1", role: "master" }));
    unmount();
    vi.setSystemTime(T0 + 60 * 60 * 1000);
    setVisibility("visible");
    expect(callApi).toHaveBeenCalledTimes(1);
  });
});
