/**
 * Link público da entrega da obra: o cliente vê só o que é dele (sem notas
 * internas nem ids da equipe) e aceita a entrega uma vez, com o plano valendo.
 */

import type { Request, Response } from "express";

const mocks = {
  resolveProjectShareToken: jest.fn(),
  tenantHasCapability: jest.fn(),
  createNotification: jest.fn(),
};
let project: Record<string, unknown> | null;
const updates: Record<string, unknown>[] = [];

jest.mock("../../init", () => {
  const ref = {
    id: "p1",
    get: async () => ({ exists: project !== null, data: () => project }),
  };
  return {
    db: {
      collection: (name: string) => {
        if (name === "projects") return { doc: () => ref };
        if (name === "tenants") {
          return { doc: () => ({ get: async () => ({ data: () => ({ name: "Casa Inteligente", primaryColor: "#fff" }) }) }) };
        }
        throw new Error(`coleção inesperada: ${name}`);
      },
      runTransaction: async (fn: (t: unknown) => Promise<unknown>) =>
        fn({
          get: async () => ({ data: () => project }),
          update: (_ref: unknown, data: Record<string, unknown>) => updates.push(data),
        }),
    },
  };
});
jest.mock("../services/projects/project.service", () => {
  const actual = jest.requireActual("../services/projects/project.service");
  return {
    PROJECTS_COLLECTION: "projects",
    toClientProjectView: actual.toClientProjectView,
    resolveProjectShareToken: (...a: unknown[]) => mocks.resolveProjectShareToken(...a),
  };
});
jest.mock("../../lib/tenant-capabilities", () => ({
  tenantHasCapability: (...a: unknown[]) => mocks.tenantHasCapability(...a),
}));
jest.mock("../services/notification.service", () => ({
  NotificationService: { createNotification: (...a: unknown[]) => mocks.createNotification(...a) },
}));
jest.mock("../../lib/client-ip", () => ({ resolveClientIp: () => "200.1.2.3" }));

import { acceptSharedProjectDelivery, getSharedProject } from "./shared-projects.controller";

function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: Record<string, unknown> };
}

const fakeReq = (body: unknown = {}) =>
  ({ params: { token: "tok" }, body, headers: { "user-agent": "Chrome" } }) as unknown as Request;

const VALID = { name: "Maria Souza", document: "529.982.247-25", accepted: true };

beforeEach(() => {
  jest.clearAllMocks();
  updates.length = 0;
  mocks.resolveProjectShareToken.mockResolvedValue({ id: "sp1", tenantId: "t1", projectId: "p1" });
  mocks.tenantHasCapability.mockResolvedValue(true);
  mocks.createNotification.mockResolvedValue(undefined);
  project = {
    tenantId: "t1",
    title: "Casa da Maria",
    clientName: "Maria",
    status: "active",
    notes: "Cliente difícil, cobrar entrada antes",
    assigneeId: "tec",
    stages: [
      {
        id: "s1",
        name: "Instalação",
        status: "done",
        completedAt: "2026-09-20",
        checklist: [{ id: "i1", text: "Fixar", done: true, doneBy: "tec" }],
        photos: [{ id: "f1", url: "https://f", caption: "Quadro", storagePath: "tenants/t1/x", uploadedBy: "tec" }],
      },
    ],
    delivery: { status: "sent", sharedProjectId: "sp1", acceptance: null },
  };
});

describe("GET /v1/share/project/:token", () => {
  it("mostra etapas, checklist e fotos, sem nota interna nem ids da equipe", async () => {
    const res = fakeRes();
    await getSharedProject(fakeReq(), res);
    const json = JSON.stringify(res.body);
    expect(res.statusCode).toBe(200);
    expect(json).toContain("Instalação");
    expect(json).toContain("https://f");
    expect(json).not.toContain("Cliente difícil");
    expect(json).not.toContain("tec");
    expect(json).not.toContain("storagePath");
    expect(res.body.tenant).toMatchObject({ name: "Casa Inteligente" });
  });

  it("token inválido: 404; expirado: 410", async () => {
    mocks.resolveProjectShareToken.mockResolvedValueOnce(null);
    const res = fakeRes();
    await getSharedProject(fakeReq(), res);
    expect(res.statusCode).toBe(404);

    mocks.resolveProjectShareToken.mockRejectedValueOnce(new Error("EXPIRED_LINK"));
    const expired = fakeRes();
    await getSharedProject(fakeReq(), expired);
    expect(expired.statusCode).toBe(410);
  });
});

describe("POST /v1/share/project/:token/accept", () => {
  it("registra o aceite, conclui o projeto e avisa a empresa", async () => {
    const res = fakeRes();
    await acceptSharedProjectDelivery(fakeReq(VALID), res);
    expect(res.statusCode).toBe(200);
    expect(updates[0]).toMatchObject({
      "delivery.status": "accepted",
      "delivery.acceptance": expect.objectContaining({ name: "Maria Souza", document: "52998224725", ip: "200.1.2.3" }),
      status: "completed",
    });
    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1", type: "project_delivery_accepted", projectId: "p1" }),
    );
  });

  it("já aceita: 409, sem gravar de novo", async () => {
    project = { ...project, delivery: { status: "accepted" } };
    const res = fakeRes();
    await acceptSharedProjectDelivery(fakeReq(VALID), res);
    expect(res.statusCode).toBe(409);
    expect(updates).toHaveLength(0);
  });

  it("documento inválido: 400 antes de ler qualquer coisa", async () => {
    const res = fakeRes();
    await acceptSharedProjectDelivery(fakeReq({ ...VALID, document: "123" }), res);
    expect(res.statusCode).toBe(400);
    expect(mocks.resolveProjectShareToken).not.toHaveBeenCalled();
  });

  it("empresa sem o plano: 403", async () => {
    mocks.tenantHasCapability.mockResolvedValue(false);
    const res = fakeRes();
    await acceptSharedProjectDelivery(fakeReq(VALID), res);
    expect(res.statusCode).toBe(403);
    expect(updates).toHaveLength(0);
  });

  it("projeto cancelado: 409", async () => {
    project = { ...project, status: "canceled" };
    const res = fakeRes();
    await acceptSharedProjectDelivery(fakeReq(VALID), res);
    expect(res.statusCode).toBe(409);
  });
});
