/**
 * `POST /v1/session/heartbeat`: o aviso de presença. O super admin não conta,
 * nem no "Ver como membro", em que a request já vale como o membro.
 */

const recordHeartbeat = jest.fn().mockResolvedValue(undefined);

jest.mock("../../../lib/tenant-presence", () => ({
  recordHeartbeat: (input: unknown) => recordHeartbeat(input),
}));
jest.mock("../../../lib/tenant-last-seen", () => ({ recordTenantLastSeen: jest.fn() }));
jest.mock("../../../lib/tenant-activity", () => ({ recordTenantActivity: jest.fn() }));
jest.mock("../../../lib/logger", () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }));

import type { Request, Response } from "express";
import { heartbeatSession } from "../session.controller";

function call(user: Record<string, unknown> | undefined, body: unknown = { active: true }) {
  const res = { status: jest.fn().mockReturnThis(), send: jest.fn() } as unknown as Response;
  return heartbeatSession({ user, body } as unknown as Request, res).then(() => res);
}

beforeEach(() => recordHeartbeat.mockClear());

describe("heartbeatSession", () => {
  it("registra o aviso da pessoa, com nome e e-mail do doc", async () => {
    const res = await call({
      uid: "ana",
      tenantId: "awa",
      role: "MEMBER",
      userDoc: { name: "Ana", email: "ana@awa.com" },
    });
    expect(res.status).toHaveBeenCalledWith(204);
    expect(recordHeartbeat).toHaveBeenCalledWith({
      tenantId: "awa",
      uid: "ana",
      role: "MEMBER",
      name: "Ana",
      email: "ana@awa.com",
      active: true,
    });
  });

  it("só `active: true` conta como em uso", async () => {
    await call({ uid: "ana", tenantId: "awa", role: "MEMBER" }, { active: "sim" });
    expect(recordHeartbeat).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
  });

  it("super admin não registra", async () => {
    const res = await call({ uid: "root", tenantId: "", role: "SUPERADMIN", isSuperAdmin: true });
    expect(res.status).toHaveBeenCalledWith(204);
    expect(recordHeartbeat).not.toHaveBeenCalled();
  });

  it("super admin vendo como membro não marca o membro como online", async () => {
    await call({
      uid: "ana",
      tenantId: "awa",
      role: "MEMBER",
      isSuperAdmin: false,
      impersonation: { memberUid: "ana", actorUid: "root" },
    });
    expect(recordHeartbeat).not.toHaveBeenCalled();
  });

  it("falha ao gravar nunca derruba quem está usando", async () => {
    recordHeartbeat.mockRejectedValueOnce(new Error("firestore fora"));
    const res = await call({ uid: "ana", tenantId: "awa", role: "MEMBER" });
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
