// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

/**
 * O aviso de presenca dispara por EVENTO (abriu a plataforma autenticado), uma
 * vez por navegador por dia. A primeira versao gravava a cada request, com
 * janela de 15 min: barata, porem imprecisa por construcao.
 */

const callApi = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/api-client", () => ({ callApi: (...a: unknown[]) => callApi(...a) }));

import { useSessionPing, shouldPing, buildPingMark } from "../use-session-ping";

const HOJE = new Date("2026-09-23T09:00:00.000Z");
const AMANHA = new Date("2026-09-24T09:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("shouldPing", () => {
  it("sem marca nenhuma, avisa", () => {
    expect(shouldPing(null, "u1", HOJE)).toBe(true);
  });

  it("ja avisou hoje por este usuario: nao repete", () => {
    expect(shouldPing(buildPingMark("u1", HOJE), "u1", HOJE)).toBe(false);
  });

  it("aba aberta desde ontem avisa de novo no dia seguinte", () => {
    expect(shouldPing(buildPingMark("u1", HOJE), "u1", AMANHA)).toBe(true);
  });

  it("outro usuario no mesmo navegador conta como acesso novo", () => {
    expect(shouldPing(buildPingMark("u1", HOJE), "u2", HOJE)).toBe(true);
  });

  it("sem usuario nao avisa", () => {
    expect(shouldPing(null, "", HOJE)).toBe(false);
  });
});

describe("useSessionPing", () => {
  it("avisa uma vez ao abrir a plataforma e nao repete no mesmo dia", () => {
    const { rerender } = renderHook(() => useSessionPing({ id: "u1", role: "master" }));
    expect(callApi).toHaveBeenCalledTimes(1);
    expect(callApi).toHaveBeenCalledWith("/v1/session/ping", "POST", {});

    rerender();
    expect(callApi).toHaveBeenCalledTimes(1);
  });

  it("conta gratuita tambem avisa: e a empresa que criou e nao assinou", () => {
    renderHook(() => useSessionPing({ id: "u1", role: "free" }));
    expect(callApi).toHaveBeenCalledTimes(1);
  });

  it("super admin nao avisa: seria marcar como acesso da empresa algo do suporte", () => {
    renderHook(() => useSessionPing({ id: "root", role: "superadmin" }));
    expect(callApi).not.toHaveBeenCalled();
  });

  it("sem usuario nao avisa", () => {
    renderHook(() => useSessionPing(null));
    expect(callApi).not.toHaveBeenCalled();
  });

  it("falha do aviso nao chega na tela", async () => {
    callApi.mockRejectedValueOnce(new Error("offline"));
    expect(() => renderHook(() => useSessionPing({ id: "u1", role: "master" }))).not.toThrow();
  });
});
