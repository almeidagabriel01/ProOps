// apps/functions/src/lib/observability/__tests__/ingest-rate-guard.test.ts
import { IngestRateGuard } from "../ingest-rate-guard";

describe("IngestRateGuard", () => {
  it("allows up to maxPerWindow within the window, then blocks", () => {
    const guard = new IngestRateGuard(2, 10_000);
    expect(guard.allow("fp", 0)).toBe(true);
    expect(guard.allow("fp", 1)).toBe(true);
    expect(guard.allow("fp", 2)).toBe(false);
  });

  it("resets after the window elapses", () => {
    const guard = new IngestRateGuard(1, 10_000);
    expect(guard.allow("fp", 0)).toBe(true);
    expect(guard.allow("fp", 5_000)).toBe(false);
    expect(guard.allow("fp", 10_001)).toBe(true);
  });

  it("tracks fingerprints independently", () => {
    const guard = new IngestRateGuard(1, 10_000);
    expect(guard.allow("a", 0)).toBe(true);
    expect(guard.allow("b", 0)).toBe(true);
    expect(guard.allow("a", 0)).toBe(false);
  });
});
