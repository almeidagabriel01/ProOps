import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { getIdToken } = vi.hoisted(() => ({ getIdToken: vi.fn() }));
const { reportClientError } = vi.hoisted(() => ({ reportClientError: vi.fn() }));

vi.mock("@/lib/firebase", () => ({ auth: { currentUser: { getIdToken } } }));
vi.mock("firebase/auth", () => ({ onAuthStateChanged: vi.fn() }));
vi.mock("@/lib/observability/client-error-reporter", () => ({ reportClientError }));

import { callApi } from "../api-client";

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

  it("reports a 404 (4xx included)", async () => {
    mockFetchOnce(404, { message: "not found" });
    await expect(callApi("/v1/x", "GET")).rejects.toThrow();
    expect(reportClientError).toHaveBeenCalledTimes(1);
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
});
