process.env.NODE_ENV = "test";

jest.mock("../../../init", () => ({ db: {}, auth: {}, adminApp: {} }));
jest.mock("../../../lib/observability/error-ingest.service", () => ({
  ERROR_ISSUES_COLLECTION: "error_issues",
}));

import { matchesFilters, encodeCursor, decodeCursor } from "../observability-admin.controller";

const base = {
  fingerprint: "f", errorType: "TypeError", title: "Cannot read x", normalizedMessage: "cannot read x",
  source: "web", route: "/v1/proposals", method: "POST", severity: "error", status: "unresolved",
  count: 3, firstSeen: "2026-06-19T00:00:00Z", lastSeen: "2026-06-20T00:00:00Z",
};

it("matches when all filters are 'all'/empty", () => {
  expect(matchesFilters(base as never, { status: "all", severity: "all", source: "all", errorType: "all", q: "", from: null, to: null })).toBe(true);
});

it("filters by status and severity", () => {
  expect(matchesFilters(base as never, { status: "resolved", severity: "all", source: "all", errorType: "all", q: "", from: null, to: null })).toBe(false);
  expect(matchesFilters(base as never, { status: "all", severity: "error", source: "all", errorType: "all", q: "", from: null, to: null })).toBe(true);
});

it("q matches title or route, case-insensitive", () => {
  expect(matchesFilters(base as never, { status: "all", severity: "all", source: "all", errorType: "all", q: "CANNOT", from: null, to: null })).toBe(true);
  expect(matchesFilters(base as never, { status: "all", severity: "all", source: "all", errorType: "all", q: "proposals", from: null, to: null })).toBe(true);
  expect(matchesFilters(base as never, { status: "all", severity: "all", source: "all", errorType: "all", q: "nope", from: null, to: null })).toBe(false);
});

it("filters by lastSeen time range", () => {
  expect(matchesFilters(base as never, { status: "all", severity: "all", source: "all", errorType: "all", q: "", from: "2026-06-20T12:00:00Z", to: null })).toBe(false);
  expect(matchesFilters(base as never, { status: "all", severity: "all", source: "all", errorType: "all", q: "", from: "2026-06-19T12:00:00Z", to: null })).toBe(true);
});

it("cursor round-trips", () => {
  const c = encodeCursor({ v: "2026-06-20T00:00:00Z", id: "f" });
  expect(decodeCursor(c)).toEqual({ v: "2026-06-20T00:00:00Z", id: "f" });
  expect(decodeCursor(null)).toBeNull();
  expect(decodeCursor("!!!not-base64-json")).toBeNull();
});
