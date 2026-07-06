// @vitest-environment jsdom
/**
 * O polling de notificações (fallback quando o SDK/listener falha) não deve
 * disparar com a aba oculta, e deve refetchar imediatamente quando a aba
 * volta a ficar visível.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Força o caminho de polling puro: collection() lança → subscribe usa
// startPollingSubscription (API via callApi).
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => {
    throw new Error("sdk init failed");
  }),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
}));
vi.mock("@/lib/firebase", () => ({ db: {} }));

const callApiMock = vi.fn<(...args: unknown[]) => Promise<unknown>>(
  async () => ({ success: true, notifications: [] }),
);
vi.mock("@/lib/api-client", () => ({
  callApi: (...args: unknown[]) => callApiMock(...args),
}));

let visibility: DocumentVisibilityState = "visible";

function setVisibility(value: DocumentVisibilityState) {
  visibility = value;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  callApiMock.mockClear();
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("notification polling visibility guard", () => {
  it("skips ticks while the tab is hidden and refetches on return", async () => {
    const { NotificationService } = await import("../notification-service");

    const unsubscribe = NotificationService.subscribe(
      { kind: "tenant", tenantId: "t1" } as never,
      () => undefined,
    );

    // fetch inicial
    await vi.advanceTimersByTimeAsync(0);
    const initialCalls = callApiMock.mock.calls.length;
    expect(initialCalls).toBeGreaterThanOrEqual(1);

    // aba oculta: 3 ticks de 10s sem nenhum fetch
    visibility = "hidden";
    await vi.advanceTimersByTimeAsync(30_000);
    expect(callApiMock.mock.calls.length).toBe(initialCalls);

    // aba volta: refetch imediato via visibilitychange
    setVisibility("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(callApiMock.mock.calls.length).toBe(initialCalls + 1);

    // e os ticks voltam a rodar
    await vi.advanceTimersByTimeAsync(10_000);
    expect(callApiMock.mock.calls.length).toBe(initialCalls + 2);

    unsubscribe();
  });
});
