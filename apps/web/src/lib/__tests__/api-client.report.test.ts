import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { getIdToken } = vi.hoisted(() => ({ getIdToken: vi.fn() }));
const { reportClientError } = vi.hoisted(() => ({ reportClientError: vi.fn() }));

vi.mock("@/lib/firebase", () => ({ auth: { currentUser: { getIdToken } } }));
vi.mock("firebase/auth", () => ({ onAuthStateChanged: vi.fn() }));
vi.mock("@/lib/observability/client-error-reporter", () => ({ reportClientError }));

import { callApi, ApiError, isReportableApiFailure } from "../api-client";

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
      json: async () => body,
    }),
  );
}

beforeEach(() => {
  getIdToken.mockReset().mockResolvedValue("tok");
  reportClientError.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api-client auto-report", () => {
  it("reports a 500 with status + method route then throws", async () => {
    mockFetchOnce(500, { message: "boom" });
    await expect(callApi("/v1/proposals", "POST", {})).rejects.toThrow();
    expect(reportClientError).toHaveBeenCalledTimes(1);
    const [, ctx] = reportClientError.mock.calls[0];
    expect(ctx).toMatchObject({ status: 500, route: "POST /v1/proposals" });
  });

  it("does NOT report a 404 (4xx excluded as expected client error)", async () => {
    mockFetchOnce(404, { message: "not found" });
    await expect(callApi("/v1/x", "GET")).rejects.toThrow();
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403, 429])("does NOT report %s client errors", async (status) => {
    // 401/403 retry once with a refreshed token; mock returns the same status twice.
    mockFetchOnce(status, { message: "client error" });
    await expect(callApi("/v1/x", "GET")).rejects.toThrow();
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it.each([500, 502, 503])("reports %s server errors", async (status) => {
    mockFetchOnce(status, { message: "boom" });
    await expect(callApi("/v1/x", "POST", {})).rejects.toThrow();
    expect(reportClientError).toHaveBeenCalledTimes(1);
    const [, ctx] = reportClientError.mock.calls[0];
    expect(ctx).toMatchObject({ status });
  });

  it("reports a non-ApiError (network/unexpected) with undefined status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(callApi("/v1/x", "GET")).rejects.toThrow();
    expect(reportClientError).toHaveBeenCalledTimes(1);
    const [, ctx] = reportClientError.mock.calls[0];
    expect(ctx).toMatchObject({ status: undefined });
  });

  it("does NOT report failures of the observability endpoint", async () => {
    mockFetchOnce(500, { message: "boom" });
    await expect(callApi("/v1/observability/issues", "GET")).rejects.toThrow();
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it("does NOT report a 402 plan-limit signal", async () => {
    mockFetchOnce(402, { message: "limit" });
    await expect(callApi("/v1/proposals", "POST", {})).rejects.toThrow();
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it("isReportableApiFailure: 5xx ApiError and non-ApiError true, 4xx false", () => {
    expect(isReportableApiFailure(new ApiError(500, "x"))).toBe(true);
    expect(isReportableApiFailure(new ApiError(503, "x"))).toBe(true);
    expect(isReportableApiFailure(new ApiError(400, "x"))).toBe(false);
    expect(isReportableApiFailure(new ApiError(404, "x"))).toBe(false);
    expect(isReportableApiFailure(new ApiError(429, "x"))).toBe(false);
    expect(isReportableApiFailure(new Error("net"))).toBe(true);
  });
});
