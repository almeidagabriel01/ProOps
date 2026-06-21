import { describe, it, expect } from "vitest";
import { rangeToFrom, isQueryMode, applyClientFilters } from "../issue-filtering";
import { DEFAULT_ISSUE_FILTERS } from "@/types/observability";
import type { ErrorIssue } from "@/types/observability";

const NOW = Date.parse("2026-06-20T12:00:00Z");

describe("rangeToFrom", () => {
  it("returns null for all", () => {
    expect(rangeToFrom("all", NOW)).toBeNull();
  });
  it("returns now-24h for 24h", () => {
    expect(rangeToFrom("24h", NOW)).toBe("2026-06-19T12:00:00.000Z");
  });
});

describe("isQueryMode", () => {
  it("is false for defaults", () => {
    expect(isQueryMode(DEFAULT_ISSUE_FILTERS)).toBe(false);
  });
  it("is true when a range is set", () => {
    expect(isQueryMode({ ...DEFAULT_ISSUE_FILTERS, range: "7d" })).toBe(true);
  });
  it("is true when q is set", () => {
    expect(isQueryMode({ ...DEFAULT_ISSUE_FILTERS, q: "boom" })).toBe(true);
  });
  it("is true when sort is non-default", () => {
    expect(isQueryMode({ ...DEFAULT_ISSUE_FILTERS, sort: "frequent" })).toBe(true);
  });
  it("stays false for status/severity/source/errorType chips", () => {
    expect(isQueryMode({ ...DEFAULT_ISSUE_FILTERS, status: "unresolved", severity: "critical" })).toBe(false);
  });
});

describe("applyClientFilters", () => {
  const mk = (over: Partial<ErrorIssue>): ErrorIssue =>
    ({
      fingerprint: "f", errorType: "TypeError", title: "Boom happened", normalizedMessage: "boom",
      source: "web", route: "/x", method: "GET", severity: "error", status: "unresolved",
      count: 1, firstSeen: "", lastSeen: "", resolvedAt: null, affectedUsers: 0, affectedTenants: 0,
      tenantIds: [], sampleStack: "", why: null, fix: null, link: null, ...over,
    }) as ErrorIssue;

  it("filters by status and q", () => {
    const issues = [mk({ status: "resolved", title: "Boom" }), mk({ status: "unresolved", title: "Quiet" })];
    const out = applyClientFilters(issues, { ...DEFAULT_ISSUE_FILTERS, status: "unresolved" });
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Quiet");
    const byQ = applyClientFilters(issues, { ...DEFAULT_ISSUE_FILTERS, q: "boom" });
    expect(byQ).toHaveLength(1);
    expect(byQ[0].title).toBe("Boom");
  });
});
