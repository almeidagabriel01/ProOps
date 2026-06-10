import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Hoisted so the (hoisted) vi.mock factory below can reference it safely.
const { getIdToken } = vi.hoisted(() => ({ getIdToken: vi.fn() }));

// callApi resolves the current user from `@/lib/firebase` and falls back to
// `onAuthStateChanged`. Provide a ready currentUser so the helper returns
// immediately without the auth-state listener.
vi.mock("@/lib/firebase", () => ({
  auth: { currentUser: { getIdToken } },
}));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(),
}));

import { callApi } from "../api-client";

function makeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response;
}

describe("callApi — stale-token retry", () => {
  beforeEach(() => {
    getIdToken.mockReset().mockResolvedValue("token-v1");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("retries once with a force-refreshed token on 403 and succeeds", async () => {
    getIdToken
      .mockReset()
      .mockResolvedValueOnce("stale-token")
      .mockResolvedValueOnce("fresh-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(403, { message: "Unauthorized" }))
      .mockResolvedValueOnce(makeResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callApi("/v1/asaas/status");

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // First attempt with a cached token, retry forces a refresh.
    expect(getIdToken).toHaveBeenNthCalledWith(1, false);
    expect(getIdToken).toHaveBeenNthCalledWith(2, true);
    const retryInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect((retryInit.headers as Record<string, string>).Authorization).toBe(
      "Bearer fresh-token",
    );
  });

  it("retries once on 401 as well", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(401, { message: "Unauthorized" }))
      .mockResolvedValueOnce(makeResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(callApi("/v1/asaas/status")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws ApiError when the forced-refresh retry still returns 403 (no loop)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(makeResponse(403, { message: "Forbidden" }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(callApi("/v1/asaas/status")).rejects.toMatchObject({
      status: 403,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry on a successful first response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { value: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(callApi("/v1/asaas/status")).resolves.toEqual({ value: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(getIdToken).toHaveBeenCalledWith(false);
  });

  it("does not retry on a non-auth error (500)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(500, { message: "boom" }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(callApi("/v1/asaas/status")).rejects.toMatchObject({
      status: 500,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
