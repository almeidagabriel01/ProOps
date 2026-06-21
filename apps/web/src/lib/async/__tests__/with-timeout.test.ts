import { afterEach, describe, expect, it, vi } from "vitest";
import { TimeoutError, withTimeout } from "../with-timeout";

afterEach(() => {
  vi.useRealTimers();
});

describe("withTimeout", () => {
  it("resolves with the value when the promise settles before the timeout", async () => {
    await expect(withTimeout(Promise.resolve(42), 1000)).resolves.toBe(42);
  });

  it("propagates the original rejection when it settles before the timeout", async () => {
    const boom = new Error("boom");
    await expect(withTimeout(Promise.reject(boom), 1000)).rejects.toBe(boom);
  });

  it("rejects with a TimeoutError when the promise hangs past the deadline", async () => {
    vi.useFakeTimers();
    // A promise that never settles — the only way out is the timeout.
    const pending = withTimeout(new Promise<number>(() => {}), 1000);
    const assertion = expect(pending).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });
});
