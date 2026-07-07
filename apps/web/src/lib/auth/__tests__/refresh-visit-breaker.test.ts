import { describe, expect, it } from "vitest";
import {
  decideRefreshVisit,
  parseRefreshVisitRecord,
} from "../refresh-visit-breaker";

describe("decideRefreshVisit", () => {
  const T0 = 1_000_000;

  it("first redirect starts a fresh record and does not break", () => {
    const { shouldBreak, record } = decideRefreshVisit(null, T0);
    expect(shouldBreak).toBe(false);
    expect(record).toEqual({ count: 1, firstAt: T0 });
  });

  it("second redirect within the window does not break", () => {
    const { shouldBreak, record } = decideRefreshVisit(
      { count: 1, firstAt: T0 },
      T0 + 1_000,
    );
    expect(shouldBreak).toBe(false);
    expect(record).toEqual({ count: 2, firstAt: T0 });
  });

  it("third redirect within the window breaks the loop", () => {
    const { shouldBreak, record } = decideRefreshVisit(
      { count: 2, firstAt: T0 },
      T0 + 2_000,
    );
    expect(shouldBreak).toBe(true);
    expect(record.count).toBe(3);
  });

  it("record older than the window resets to count 1 (no break)", () => {
    const { shouldBreak, record } = decideRefreshVisit(
      { count: 2, firstAt: T0 },
      T0 + 31_000,
    );
    expect(shouldBreak).toBe(false);
    expect(record).toEqual({ count: 1, firstAt: T0 + 31_000 });
  });

  it("honors custom window and max", () => {
    const { shouldBreak } = decideRefreshVisit(
      { count: 1, firstAt: T0 },
      T0 + 100,
      { maxVisits: 2 },
    );
    expect(shouldBreak).toBe(true);
  });
});

describe("parseRefreshVisitRecord", () => {
  it("parses a valid record", () => {
    expect(
      parseRefreshVisitRecord(JSON.stringify({ count: 2, firstAt: 123 })),
    ).toEqual({ count: 2, firstAt: 123 });
  });

  it("returns null for null, corrupt JSON, and invalid fields", () => {
    expect(parseRefreshVisitRecord(null)).toBeNull();
    expect(parseRefreshVisitRecord("not-json")).toBeNull();
    expect(parseRefreshVisitRecord(JSON.stringify({ count: "2" }))).toBeNull();
    expect(
      parseRefreshVisitRecord(JSON.stringify({ count: 0, firstAt: 1 })),
    ).toBeNull();
    expect(
      parseRefreshVisitRecord(JSON.stringify({ count: 1, firstAt: -5 })),
    ).toBeNull();
    expect(
      parseRefreshVisitRecord(JSON.stringify({ count: NaN, firstAt: 1 })),
    ).toBeNull();
  });
});
