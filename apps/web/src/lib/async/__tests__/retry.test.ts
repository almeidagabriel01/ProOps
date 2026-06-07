import { describe, it, expect, vi } from "vitest";
import { retryUntil } from "../retry";

describe("retryUntil", () => {
  it("returns immediately when the first result is already done", async () => {
    const fn = vi.fn(async () => ({ exists: true }));
    const result = await retryUntil(fn, (r) => r.exists, {
      attempts: 4,
      delayMs: 1,
    });
    expect(result.exists).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries until the result becomes done (race resolved on a later attempt)", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      // Not found on the first two reads, then the doc appears.
      return { exists: calls >= 3 };
    });

    const result = await retryUntil(fn, (r) => r.exists, {
      attempts: 4,
      delayMs: 1,
    });

    expect(result.exists).toBe(true);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("gives up after attempts and returns the last (not-done) result", async () => {
    const fn = vi.fn(async () => ({ exists: false }));

    const result = await retryUntil(fn, (r) => r.exists, {
      attempts: 3,
      delayMs: 1,
    });

    expect(result.exists).toBe(false);
    // 1 initial call + 3 retries
    expect(fn).toHaveBeenCalledTimes(4);
  });
});
