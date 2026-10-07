// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

/**
 * O aviso de presença: a cada minuto, dizendo se a pessoa está em uso. É o
 * que separa "entrou 10:15 e continua" de "entrou 10:15 e saiu".
 */

const callApi = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/api-client", () => ({ callApi: (...args: unknown[]) => callApi(...args) }));

import { HEARTBEAT_INTERVAL_MS, IDLE_AFTER_MS, isActiveNow, usePresenceHeartbeat } from "../use-presence-heartbeat";

let visibility: DocumentVisibilityState = "visible";

beforeEach(() => {
  vi.useFakeTimers();
  callApi.mockClear();
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
});

afterEach(() => {
  vi.useRealTimers();
});

const sentActive = () => callApi.mock.calls.map((call) => (call[2] as { active: boolean }).active);

describe("isActiveNow", () => {
  it("em uso: aba à vista e mexeu há menos de 5 minutos", () => {
    expect(isActiveNow({ visible: true, lastInteractionMs: 0, nowMs: IDLE_AFTER_MS - 1 })).toBe(true);
    expect(isActiveNow({ visible: true, lastInteractionMs: 0, nowMs: IDLE_AFTER_MS })).toBe(false);
    expect(isActiveNow({ visible: false, lastInteractionMs: 0, nowMs: 1 })).toBe(false);
  });
});

describe("usePresenceHeartbeat", () => {
  it("avisa ao abrir e a cada minuto", () => {
    renderHook(() => usePresenceHeartbeat({ id: "ana", role: "member" }));
    expect(callApi).toHaveBeenCalledWith("/v1/session/heartbeat", "POST", { active: true });
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 3);
    expect(callApi).toHaveBeenCalledTimes(4);
  });

  it("sem mexer por 5 minutos, os avisos passam a dizer que não está em uso", () => {
    renderHook(() => usePresenceHeartbeat({ id: "ana", role: "member" }));
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 6);
    expect(sentActive().at(-1)).toBe(false);
    expect(sentActive()[0]).toBe(true);
  });

  it("voltar a mexer depois de ausente avisa na hora", () => {
    renderHook(() => usePresenceHeartbeat({ id: "ana", role: "member" }));
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 6 + 20_000);
    const before = callApi.mock.calls.length;
    window.dispatchEvent(new Event("keydown"));
    expect(callApi.mock.calls.length).toBe(before + 1);
    expect(sentActive().at(-1)).toBe(true);
  });

  it("aba em segundo plano avisa que não está em uso, mas continua avisando", () => {
    renderHook(() => usePresenceHeartbeat({ id: "ana", role: "member" }));
    visibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    expect(sentActive().at(-1)).toBe(false);
  });

  it("mexer logo depois de um aviso espera 15 s, para trocar de aba sem parar não virar uma escrita por troca", () => {
    renderHook(() => usePresenceHeartbeat({ id: "ana", role: "member" }));
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 6);
    const before = callApi.mock.calls.length;
    window.dispatchEvent(new Event("keydown"));
    expect(callApi.mock.calls.length).toBe(before);
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    expect(sentActive().at(-1)).toBe(true);
  });

  it("super admin não avisa", () => {
    renderHook(() => usePresenceHeartbeat({ id: "root", role: "superadmin" }));
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 2);
    expect(callApi).not.toHaveBeenCalled();
  });

  it("fechou a aba (desmontou): para de avisar", () => {
    const view = renderHook(() => usePresenceHeartbeat({ id: "ana", role: "member" }));
    view.unmount();
    callApi.mockClear();
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 3);
    expect(callApi).not.toHaveBeenCalled();
  });
});
