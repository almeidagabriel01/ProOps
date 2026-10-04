// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

const { trackActivity } = vi.hoisted(() => ({ trackActivity: vi.fn() }));
vi.mock("@/lib/firebase", () => ({ auth: {} }));
vi.mock("firebase/auth", () => ({ onIdTokenChanged: vi.fn(() => () => {}) }));
vi.mock("@/lib/activity/activity-tracker", () => ({ trackActivity }));

import { reportClientError } from "../client-error-reporter";

beforeEach(() => {
  trackActivity.mockReset();
  vi.stubGlobal("navigator", {});
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true }) as Response));
});

describe("erro de tela na atividade da empresa", () => {
  it("registra só o tipo do erro, nunca a mensagem", () => {
    reportClientError(new TypeError("Cannot read properties of undefined (cliente Joao)"));
    expect(trackActivity).toHaveBeenCalledWith("client_error", { meta: { errorType: "TypeError" } });
    expect(JSON.stringify(trackActivity.mock.calls)).not.toContain("Joao");
  });

  it("falha de API repassada pelo api-client não duplica (já vira api_error)", () => {
    reportClientError(new Error("boom"), { route: "POST /v1/proposals", status: 500 });
    reportClientError(new TypeError("Failed to fetch"), { route: "GET /v1/x" });
    expect(trackActivity).not.toHaveBeenCalled();
  });

  it("erro de tela com a rota da página é registrado", () => {
    reportClientError(new RangeError("x"), { route: "/proposals/new" });
    expect(trackActivity).toHaveBeenCalledWith("client_error", { meta: { errorType: "RangeError" } });
  });
});
