import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const verifySessionCookie = vi.fn();
vi.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: () => ({ verifySessionCookie, getUser: vi.fn() }),
  getAdminFirestore: vi.fn(),
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { GET } from "../route";

function request() {
  return new NextRequest("http://localhost/api/auth/billing-status?path=/dashboard", {
    headers: { cookie: "__session=abc" },
  });
}

const withCode = (code: string) => Object.assign(new Error(code), { code });

describe("GET /api/auth/billing-status: sessão recusada", () => {
  beforeEach(() => {
    verifySessionCookie.mockReset();
  });

  it("sessão revogada vai para o login", async () => {
    verifySessionCookie.mockImplementation(async () => {
      throw withCode("auth/session-cookie-revoked");
    });
    const body = await (await GET(request())).json();
    expect(body).toMatchObject({ allowed: false, reason: "session_revoked" });
  });

  // Regressão: conta desativada caía em "billing_check_failed" e o usuário via
  // a tela de assinatura bloqueada, em vez de ser mandado para o login.
  it("conta desativada é tratada como sessão encerrada, não como assinatura bloqueada", async () => {
    verifySessionCookie.mockImplementation(async () => {
      throw withCode("auth/user-disabled");
    });
    const body = await (await GET(request())).json();
    expect(body).toMatchObject({ allowed: false, reason: "session_revoked" });
  });

  it("cookie expirado tenta a re-emissão silenciosa", async () => {
    verifySessionCookie.mockImplementation(async () => {
      throw withCode("auth/session-cookie-expired");
    });
    const body = await (await GET(request())).json();
    expect(body).toMatchObject({ allowed: false, reason: "session_expired" });
  });

  it("erro de infraestrutura continua falhando fechado", async () => {
    verifySessionCookie.mockImplementation(async () => {
      throw new Error("boom");
    });
    const body = await (await GET(request())).json();
    expect(body).toMatchObject({ allowed: false, reason: "billing_check_failed" });
  });
});
