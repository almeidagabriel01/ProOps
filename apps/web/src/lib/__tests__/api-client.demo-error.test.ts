import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { getIdToken } = vi.hoisted(() => ({ getIdToken: vi.fn() }));
const { reportClientError } = vi.hoisted(() => ({ reportClientError: vi.fn() }));
const { toastInfo } = vi.hoisted(() => ({ toastInfo: vi.fn() }));

vi.mock("@/lib/firebase", () => ({ auth: { currentUser: { getIdToken } } }));
vi.mock("firebase/auth", () => ({ onAuthStateChanged: vi.fn() }));
vi.mock("@/lib/observability/client-error-reporter", () => ({
  reportClientError,
}));
vi.mock("@/lib/toast", () => ({
  toast: { info: toastInfo, error: vi.fn(), success: vi.fn() },
}));

import { callApi, ApiError, isDemoReadOnlyError } from "../api-client";
import { setDemoMode } from "../demo-mode";

beforeEach(() => {
  setDemoMode(false);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isDemoReadOnlyError", () => {
  it("is true for the demo read-only ApiError", () => {
    const error = new ApiError(402, "Ação indisponível no modo demonstração.", {
      code: "DEMO_READ_ONLY",
    });
    expect(isDemoReadOnlyError(error)).toBe(true);
  });

  it("is false for other ApiErrors (same status, different code)", () => {
    expect(
      isDemoReadOnlyError(
        new ApiError(402, "Plan limit reached", { code: "PLAN_LIMIT" }),
      ),
    ).toBe(false);
    expect(isDemoReadOnlyError(new ApiError(500, "Internal error"))).toBe(
      false,
    );
    expect(isDemoReadOnlyError(new ApiError(403, "Forbidden", null))).toBe(
      false,
    );
  });

  it("is false for non-ApiError failures (network, JS)", () => {
    expect(isDemoReadOnlyError(new Error("fetch failed"))).toBe(false);
    expect(isDemoReadOnlyError(undefined)).toBe(false);
    expect(isDemoReadOnlyError({ code: "DEMO_READ_ONLY" })).toBe(false);
  });
});

describe("callApi in demo mode", () => {
  it("blocks the share-link mutation with an error the helper recognizes (no network call)", async () => {
    setDemoMode(true);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    let thrown: unknown;
    try {
      await callApi("/v1/proposals/abc/share-link", "POST");
    } catch (error) {
      thrown = error;
    }

    expect(isDemoReadOnlyError(thrown)).toBe(true);
    expect(toastInfo).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not flag backend failures outside demo mode", async () => {
    getIdToken.mockResolvedValue("token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ message: "boom" }),
      }),
    );

    let thrown: unknown;
    try {
      await callApi("/v1/proposals/abc/share-link", "POST");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect(isDemoReadOnlyError(thrown)).toBe(false);
  });
});
