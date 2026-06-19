// apps/web/src/lib/observability/__tests__/issue-format.test.ts
import { describe, it, expect } from "vitest";
import { severityRank, sortIssues, relativeTime, severityAccent, statusLabel } from "../issue-format";
import type { ErrorIssue } from "@/types/observability";

function issue(p: Partial<ErrorIssue>): ErrorIssue {
  return {
    fingerprint: "f", errorType: "E", title: "t", normalizedMessage: "m",
    source: "functions", route: null, method: null, severity: "error",
    status: "unresolved", count: 1, firstSeen: "2026-06-19T10:00:00.000Z",
    lastSeen: "2026-06-19T10:00:00.000Z", resolvedAt: null, affectedUsers: 0,
    affectedTenants: 0, tenantIds: [], sampleStack: "", why: null, fix: null, link: null,
    ...p,
  };
}

describe("severityRank", () => {
  it("ranks critical > error > warning", () => {
    expect(severityRank("critical")).toBeGreaterThan(severityRank("error"));
    expect(severityRank("error")).toBeGreaterThan(severityRank("warning"));
  });
});

describe("sortIssues", () => {
  it("orders by severity desc then lastSeen desc", () => {
    const a = issue({ fingerprint: "a", severity: "warning", lastSeen: "2026-06-19T12:00:00.000Z" });
    const b = issue({ fingerprint: "b", severity: "critical", lastSeen: "2026-06-19T09:00:00.000Z" });
    const c = issue({ fingerprint: "c", severity: "critical", lastSeen: "2026-06-19T11:00:00.000Z" });
    const out = sortIssues([a, b, c]).map((i) => i.fingerprint);
    expect(out).toEqual(["c", "b", "a"]);
  });
  it("does not mutate the input array", () => {
    const arr = [issue({ fingerprint: "a" }), issue({ fingerprint: "b" })];
    const copy = [...arr];
    sortIssues(arr);
    expect(arr).toEqual(copy);
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-06-19T12:00:00.000Z");
  it("formats seconds/minutes/hours/days", () => {
    expect(relativeTime("2026-06-19T11:59:30.000Z", now)).toBe("30s atrás");
    expect(relativeTime("2026-06-19T11:30:00.000Z", now)).toBe("30min atrás");
    expect(relativeTime("2026-06-19T09:00:00.000Z", now)).toBe("3h atrás");
    expect(relativeTime("2026-06-16T12:00:00.000Z", now)).toBe("3d atrás");
  });
});

describe("severityAccent", () => {
  it("returns red fragments for critical, amber for warning, zinc for error", () => {
    expect(severityAccent("critical").dot).toContain("red");
    expect(severityAccent("warning").dot).toContain("amber");
    expect(severityAccent("error").dot).toContain("zinc");
  });
});

describe("statusLabel", () => {
  it("maps to PT-BR labels", () => {
    expect(statusLabel("unresolved")).toBe("Não resolvido");
    expect(statusLabel("resolved")).toBe("Resolvido");
    expect(statusLabel("ignored")).toBe("Ignorado");
  });
});
