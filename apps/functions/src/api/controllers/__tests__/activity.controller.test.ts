process.env.NODE_ENV = "test";

const resolveActivityIdentity = jest.fn();
const recordTenantActivityBatch = jest.fn();
const writeSecurityAuditEvent = jest.fn();

jest.mock("../../../lib/tenant-activity-identity", () => ({
  resolveActivityIdentity: (...a: unknown[]) => resolveActivityIdentity(...a),
}));
jest.mock("../../../lib/tenant-activity", () => {
  const actual = jest.requireActual("../../../lib/tenant-activity");
  return { ...actual, recordTenantActivityBatch: (...a: unknown[]) => recordTenantActivityBatch(...a) };
});
jest.mock("../../../lib/security-observability", () => ({
  writeSecurityAuditEvent: (...a: unknown[]) => writeSecurityAuditEvent(...a),
}));
jest.mock("../../../init", () => ({ db: {}, auth: {} }));

import { Request, Response } from "express";
import {
  MAX_ACTIVITY_BATCH,
  activityLimitResponse,
  ingestActivityEvents,
  resolveClientEventTime,
} from "../activity.controller";
import type { TenantActivityDoc } from "../../../lib/tenant-activity";

function mockRes() {
  const res: Partial<Response> & { _status?: number; _json?: unknown; _headers: Record<string, string> } = {
    _headers: {},
  };
  res.status = ((c: number) => {
    res._status = c;
    return res as Response;
  }) as Response["status"];
  res.json = ((b: unknown) => {
    res._json = b;
    return res as Response;
  }) as Response["json"];
  res.set = ((k: string, v: string) => {
    res._headers[k] = v;
    return res as Response;
  }) as unknown as Response["set"];
  return res as Response & { _status?: number; _json?: unknown; _headers: Record<string, string> };
}

function req(body: unknown): Request {
  return { body, headers: {} } as unknown as Request;
}

let uidSeq = 0;
function freeIdentity() {
  uidSeq += 1;
  return { uid: `u-free-${uidSeq}`, tenantId: "tenant_free", role: "free", isSuperAdmin: false };
}

function writtenDocs(): TenantActivityDoc[] {
  return recordTenantActivityBatch.mock.calls[0][0] as TenantActivityDoc[];
}

beforeEach(() => {
  resolveActivityIdentity.mockReset();
  recordTenantActivityBatch.mockReset();
  recordTenantActivityBatch.mockImplementation(async (docs: unknown[]) => docs.length);
  writeSecurityAuditEvent.mockReset();
});

describe("POST /v1/activity/events", () => {
  it("sem token válido devolve 401 e não grava", async () => {
    resolveActivityIdentity.mockResolvedValue(null);
    const res = mockRes();
    await ingestActivityEvents(req({ events: [{ type: "page_view", route: "/dashboard" }] }), res);
    expect(res._status).toBe(401);
    expect(recordTenantActivityBatch).not.toHaveBeenCalled();
  });

  it("super admin recebe 202 e nada é gravado", async () => {
    resolveActivityIdentity.mockResolvedValue({ uid: "u-super", tenantId: "tenant_x", role: "superadmin", isSuperAdmin: true });
    const res = mockRes();
    await ingestActivityEvents(req({ idToken: "t", events: [{ type: "page_view", route: "/dashboard" }] }), res);
    expect(res._status).toBe(202);
    expect(res._json).toEqual({ accepted: 0 });
    expect(recordTenantActivityBatch).not.toHaveBeenCalled();
  });

  it("a identidade sai do token: tenantId, uid e role do corpo são ignorados", async () => {
    const identity = freeIdentity();
    resolveActivityIdentity.mockResolvedValue(identity);
    const res = mockRes();
    await ingestActivityEvents(
      req({
        idToken: "t",
        tenantId: "tenant_vitima",
        uid: "u-vitima",
        role: "master",
        events: [{ type: "page_view", route: "/dashboard", tenantId: "tenant_vitima" }],
      }),
      res,
    );
    expect(res._status).toBe(202);
    const [doc] = writtenDocs();
    expect(doc).toMatchObject({ tenantId: "tenant_free", uid: identity.uid, role: "free", isDemo: true, source: "client" });
  });

  it("descarta tipo desconhecido e tipo que só o servidor grava", async () => {
    resolveActivityIdentity.mockResolvedValue(freeIdentity());
    const res = mockRes();
    await ingestActivityEvents(
      req({
        idToken: "t",
        events: [
          { type: "page_view", route: "/dashboard" },
          { type: "subscribed", meta: { plan: "enterprise" } },
          { type: "signup" },
          { type: "keylogger" },
          "lixo",
          null,
        ],
      }),
      res,
    );
    expect(writtenDocs().map((d) => d.type)).toEqual(["page_view"]);
    expect(res._json).toEqual({ accepted: 1 });
  });

  it(`corta o lote em ${MAX_ACTIVITY_BATCH} eventos`, async () => {
    resolveActivityIdentity.mockResolvedValue(freeIdentity());
    const events = Array.from({ length: 60 }, (_, i) => ({ type: "page_view", route: `/r${i}` }));
    await ingestActivityEvents(req({ idToken: "t", events }), mockRes());
    expect(writtenDocs()).toHaveLength(MAX_ACTIVITY_BATCH);
  });

  it("guarda o caminho de API normalizado e descarta meta fora da lista", async () => {
    resolveActivityIdentity.mockResolvedValue(freeIdentity());
    await ingestActivityEvents(
      req({
        idToken: "t",
        events: [
          {
            type: "api_error",
            meta: { method: "POST", path: "/v1/proposals/aB3dE9fG7hJ2kL1mN0pQ", status: 402, code: "FREE_TIER_FORBIDDEN", message: "dados do cliente" },
          },
        ],
      }),
      mockRes(),
    );
    expect(writtenDocs()[0].meta).toEqual({ method: "POST", path: "/v1/proposals/[id]", status: 402, code: "FREE_TIER_FORBIDDEN" });
  });

  it("a gravação é aguardada antes da resposta", async () => {
    resolveActivityIdentity.mockResolvedValue(freeIdentity());
    let release: (n: number) => void = () => undefined;
    recordTenantActivityBatch.mockReturnValue(new Promise<number>((resolve) => { release = resolve; }));
    const res = mockRes();
    const pending = ingestActivityEvents(req({ idToken: "t", events: [{ type: "page_view", route: "/x" }] }), res);
    await new Promise((r) => setImmediate(r));
    expect(res._status).toBeUndefined();
    release(1);
    await pending;
    expect(res._status).toBe(202);
  });

  it("estourar o limite por usuário devolve 429 sem evento de auditoria", async () => {
    const identity = freeIdentity();
    resolveActivityIdentity.mockResolvedValue(identity);
    let last = mockRes();
    for (let i = 0; i < 95; i += 1) {
      last = mockRes();
      await ingestActivityEvents(req({ idToken: "t", events: [{ type: "page_view", route: `/r${i}` }] }), last);
    }
    expect(last._status).toBe(429);
    expect(writeSecurityAuditEvent).not.toHaveBeenCalled();
  });
});

describe("resolveClientEventTime", () => {
  const now = Date.parse("2026-10-03T15:00:00.000Z");
  it("aceita o horário do navegador numa janela curta", () => {
    expect(resolveClientEventTime(now - 60_000, now)).toBe(now - 60_000);
  });
  it("relógio muito atrasado, adiantado ou inválido usa o do servidor", () => {
    expect(resolveClientEventTime(now - 3_600_000, now)).toBe(now);
    expect(resolveClientEventTime(now + 3_600_000, now)).toBe(now);
    expect(resolveClientEventTime("ontem", now)).toBe(now);
  });
});

describe("activityLimitResponse", () => {
  it("responde 429 com Retry-After e não grava auditoria", () => {
    const res = mockRes();
    activityLimitResponse({} as Request, res, { retryAfterSeconds: 7 });
    expect(res._status).toBe(429);
    expect(res._headers["Retry-After"]).toBe("7");
    expect(writeSecurityAuditEvent).not.toHaveBeenCalled();
  });
});
