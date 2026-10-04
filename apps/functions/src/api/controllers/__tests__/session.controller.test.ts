const recordTenantLastSeen = jest.fn();
const recordTenantActivity = jest.fn();
jest.mock("../../../lib/tenant-last-seen", () => ({
  recordTenantLastSeen: (...a: unknown[]) => recordTenantLastSeen(...a),
}));
jest.mock("../../../lib/tenant-activity", () => ({
  recordTenantActivity: (...a: unknown[]) => recordTenantActivity(...a),
}));

import type { Request, Response } from "express";
import { clearSessionActivityCacheForTest, pingSession } from "../session.controller";

function res() {
  const r = { statusCode: 0 } as unknown as Response & { statusCode: number };
  r.status = ((c: number) => {
    r.statusCode = c;
    return r;
  }) as Response["status"];
  r.send = (() => r) as Response["send"];
  return r;
}

function req(user: Record<string, unknown>): Request {
  return { user } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  clearSessionActivityCacheForTest();
  recordTenantLastSeen.mockResolvedValue(undefined);
  recordTenantActivity.mockResolvedValue(undefined);
});

describe("POST /v1/session/ping: Entrou no ERP", () => {
  it("grava session_started para usuário da empresa", async () => {
    await pingSession(req({ uid: "u1", tenantId: "t1", role: "FREE" }), res());
    expect(recordTenantActivity).toHaveBeenCalledWith({
      tenantId: "t1",
      uid: "u1",
      role: "FREE",
      type: "session_started",
      source: "server",
    });
  });

  it("conta uma vez a cada meia hora por pessoa", async () => {
    await pingSession(req({ uid: "u2", tenantId: "t1", role: "MASTER" }), res());
    await pingSession(req({ uid: "u2", tenantId: "t1", role: "MASTER" }), res());
    expect(recordTenantActivity).toHaveBeenCalledTimes(1);
  });

  it("super admin e Acessar Painel não gravam", async () => {
    await pingSession(req({ uid: "s1", tenantId: "", role: "SUPERADMIN", isSuperAdmin: true }), res());
    await pingSession(
      req({ uid: "s2", tenantId: "t9", role: "SUPERADMIN", isSuperAdmin: true, impersonation: { tenantId: "t9" } }),
      res(),
    );
    expect(recordTenantActivity).not.toHaveBeenCalled();
  });

  it("falha ao registrar não derruba o ping", async () => {
    recordTenantLastSeen.mockRejectedValue(new Error("down"));
    const r = res();
    await pingSession(req({ uid: "u3", tenantId: "t1", role: "MASTER" }), r);
    expect(r.statusCode).toBe(204);
  });
});
