import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { getIdToken } = vi.hoisted(() => ({ getIdToken: vi.fn() }));
const { trackActivity } = vi.hoisted(() => ({ trackActivity: vi.fn() }));
const { reportClientError } = vi.hoisted(() => ({ reportClientError: vi.fn() }));

vi.mock("@/lib/firebase", () => ({ auth: { currentUser: { getIdToken } } }));
vi.mock("firebase/auth", () => ({ onAuthStateChanged: vi.fn() }));
vi.mock("@/lib/observability/client-error-reporter", () => ({ reportClientError }));
vi.mock("@/lib/activity/activity-tracker", () => ({ trackActivity }));
vi.mock("@/lib/toast", () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));

import { callApi, ApiError, shouldTrackApiError } from "../api-client";
import { setDemoMode } from "../demo-mode";

function mockFetch(status: number, body: unknown) {
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
  trackActivity.mockReset();
  reportClientError.mockReset();
  setDemoMode(false);
});
afterEach(() => {
  vi.unstubAllGlobals();
  setDemoMode(false);
});

describe("api-client: erros na atividade da empresa", () => {
  it("402 do plano vira api_error com método, caminho normalizado, status e código", async () => {
    mockFetch(402, { message: "Plano", code: "PLAN_CAPABILITY_REQUIRED" });
    await expect(callApi("/v1/fiscal/invoices/aB3dE9fG7hJ2kL1mN0pQ?x=1", "POST", {})).rejects.toThrow();
    expect(trackActivity).toHaveBeenCalledWith("api_error", {
      meta: { method: "POST", path: "/v1/fiscal/invoices/[id]", status: 402, code: "PLAN_CAPABILITY_REQUIRED" },
    });
  });

  it.each([400, 403, 404, 409, 429, 500])("%s também é registrado", async (status) => {
    mockFetch(status, { message: "x" });
    await expect(callApi("/v1/x", "GET")).rejects.toThrow();
    expect(trackActivity).toHaveBeenCalledWith("api_error", expect.objectContaining({ meta: expect.objectContaining({ status }) }));
  });

  it("401 (sessão expirando) não é registrado", async () => {
    mockFetch(401, { message: "auth" });
    await expect(callApi("/v1/x", "GET")).rejects.toThrow();
    expect(trackActivity).not.toHaveBeenCalled();
  });

  it("código que não é um código (texto livre) não vai", async () => {
    mockFetch(400, { message: "x", code: "nome do cliente" });
    await expect(callApi("/v1/x", "POST", {})).rejects.toThrow();
    expect(trackActivity.mock.calls[0][1].meta.code).toBeUndefined();
  });

  it("falha de rede vira status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(callApi("/v1/x", "GET")).rejects.toThrow();
    expect(trackActivity).toHaveBeenCalledWith("api_error", expect.objectContaining({ meta: expect.objectContaining({ status: 0 }) }));
  });

  it("sucesso não registra nada", async () => {
    mockFetch(200, { ok: true });
    await callApi("/v1/x", "GET");
    expect(trackActivity).not.toHaveBeenCalled();
  });

  it("na demonstração, a escrita bloqueada vira demo_write_blocked e não api_error", async () => {
    setDemoMode(true);
    mockFetch(200, {});
    await expect(callApi("/v1/proposals/aB3dE9fG7hJ2kL1mN0pQ", "PUT", {})).rejects.toThrow(ApiError);
    expect(trackActivity).toHaveBeenCalledTimes(1);
    expect(trackActivity).toHaveBeenCalledWith("demo_write_blocked", {
      meta: { method: "PUT", path: "/v1/proposals/[id]" },
    });
  });
});

describe("shouldTrackApiError", () => {
  it("a própria telemetria nunca entra (laço)", () => {
    expect(shouldTrackApiError("/v1/activity/events", new ApiError(500, "x"))).toBe(false);
    expect(shouldTrackApiError("/v1/observability/client-error", new ApiError(500, "x"))).toBe(false);
  });

  it("bloqueio da demonstração não duplica como erro", () => {
    expect(shouldTrackApiError("/v1/proposals", new ApiError(402, "x", { code: "DEMO_READ_ONLY" }))).toBe(false);
  });
});
