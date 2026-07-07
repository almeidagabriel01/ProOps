/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { installChunkErrorRecovery } from "../chunk-error-recovery";
import { CHUNK_RELOAD_STORAGE_KEY } from "../decide-chunk-error-recovery";

function makeFakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

function chunkError(): Error {
  const err = new Error("Loading chunk 4823 failed.");
  err.name = "ChunkLoadError";
  return err;
}

function dispatchErrorEvent(error: unknown) {
  window.dispatchEvent(new ErrorEvent("error", { error }));
}

function dispatchRejectionEvent(reason: unknown) {
  const event = new Event("unhandledrejection") as Event & { reason?: unknown };
  event.reason = reason;
  window.dispatchEvent(event);
}

let uninstall: (() => void) | null = null;

// keeps vitest/jsdom from flagging the dispatched ErrorEvents as uncaught
const markHandled = (event: Event) => event.preventDefault();

beforeEach(() => {
  window.addEventListener("error", markHandled);
});

afterEach(() => {
  window.removeEventListener("error", markHandled);
  uninstall?.();
  uninstall = null;
  vi.restoreAllMocks();
});

describe("installChunkErrorRecovery", () => {
  it("reloads once and records the timestamp on a ChunkLoadError error event", () => {
    const reload = vi.fn();
    const storage = makeFakeStorage();
    const now = 1_800_000_000_000;
    uninstall = installChunkErrorRecovery({ reload, storage, now: () => now });

    dispatchErrorEvent(chunkError());

    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.data.get(CHUNK_RELOAD_STORAGE_KEY)).toBe(String(now));
  });

  it("reloads on an unhandledrejection carrying a chunk error reason", () => {
    const reload = vi.fn();
    uninstall = installChunkErrorRecovery({
      reload,
      storage: makeFakeStorage(),
      now: () => 1_800_000_000_000,
    });

    dispatchRejectionEvent(
      new TypeError("Failed to fetch dynamically imported module: /_next/static/chunks/page.js"),
    );

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload again for a second chunk error within the cooldown", () => {
    const reload = vi.fn();
    const storage = makeFakeStorage();
    let now = 1_800_000_000_000;
    uninstall = installChunkErrorRecovery({ reload, storage, now: () => now });

    dispatchErrorEvent(chunkError());
    now += 1_000;
    dispatchErrorEvent(chunkError());

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("never reloads for non-chunk errors", () => {
    const reload = vi.fn();
    uninstall = installChunkErrorRecovery({
      reload,
      storage: makeFakeStorage(),
      now: () => 1_800_000_000_000,
    });

    dispatchErrorEvent(new Error("boom"));
    dispatchRejectionEvent(new TypeError("Failed to fetch"));

    expect(reload).not.toHaveBeenCalled();
  });

  it("does not reload when the loop-guard timestamp cannot be persisted", () => {
    const reload = vi.fn();
    uninstall = installChunkErrorRecovery({
      reload,
      storage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      },
      now: () => 1_800_000_000_000,
    });

    dispatchErrorEvent(chunkError());

    expect(reload).not.toHaveBeenCalled();
  });

  it("stops reacting to events after uninstall", () => {
    const reload = vi.fn();
    const install = installChunkErrorRecovery({
      reload,
      storage: makeFakeStorage(),
      now: () => 1_800_000_000_000,
    });
    install();

    dispatchErrorEvent(chunkError());

    expect(reload).not.toHaveBeenCalled();
  });
});
