/**
 * Atividade das empresas: o que entra no documento, quem não conta e a
 * garantia de que a escrita é aguardada (Cloud Run congela a instância).
 */

const addMock = jest.fn();
const createMock = jest.fn();
const batchSet = jest.fn();
const batchCommit = jest.fn();
const docMock = jest.fn((id?: string) => ({ id: id ?? "auto", create: createMock }));
const collectionMock = jest.fn(() => ({ add: addMock, doc: docMock }));

jest.mock("../../init", () => ({
  db: {
    collection: (...args: unknown[]) => collectionMock(...(args as [])),
    batch: () => ({ set: batchSet, commit: batchCommit }),
  },
}));
const warn = jest.fn();
jest.mock("../logger", () => ({
  logger: { warn: (...a: unknown[]) => warn(...(a as [])), info: jest.fn(), error: jest.fn() },
}));

import { Timestamp } from "firebase-admin/firestore";
import {
  TENANT_ACTIVITY_COLLECTION,
  TENANT_ACTIVITY_RETENTION_DAYS,
  buildActivityDoc,
  recordTenantActivity,
  recordTenantActivityBatch,
  sanitizeActivityMeta,
} from "../tenant-activity";

const T0 = Date.parse("2026-10-03T15:00:00.000Z");

beforeEach(() => {
  jest.clearAllMocks();
  addMock.mockResolvedValue({ id: "x" });
  createMock.mockResolvedValue(undefined);
  batchCommit.mockResolvedValue(undefined);
});

describe("buildActivityDoc", () => {
  it("monta o doc com categoria do catálogo, rota normalizada e TTL de 90 dias em Timestamp", () => {
    const doc = buildActivityDoc(
      {
        tenantId: "t1",
        uid: "u1",
        role: "FREE",
        type: "page_view",
        route: "/proposals/aB3dE9fG7hJ2kL1mN0pQ?x=1",
        source: "client",
        sessionId: "s1",
      },
      T0,
    )!;
    expect(doc).toMatchObject({
      tenantId: "t1",
      uid: "u1",
      role: "free",
      isDemo: true,
      category: "navigation",
      type: "page_view",
      route: "/proposals/[id]",
      source: "client",
      sessionId: "s1",
      meta: {},
    });
    expect(doc.createdAt).toBeInstanceOf(Timestamp);
    expect(doc.expiresAt).toBeInstanceOf(Timestamp);
    expect(doc.expiresAt.toMillis() - doc.createdAt.toMillis()).toBe(
      TENANT_ACTIVITY_RETENTION_DAYS * 86_400_000,
    );
  });

  it("conta paga não é demonstração", () => {
    const doc = buildActivityDoc({ tenantId: "t1", role: "MASTER", type: "page_view", source: "client" }, T0);
    expect(doc!.isDemo).toBe(false);
  });

  it("super admin não grava, em qualquer caixa", () => {
    expect(buildActivityDoc({ tenantId: "t1", role: "superadmin", type: "page_view", source: "client" }, T0)).toBeNull();
    expect(buildActivityDoc({ tenantId: "t1", role: "SUPERADMIN", type: "page_view", source: "client" }, T0)).toBeNull();
  });

  it("sem empresa não grava", () => {
    expect(buildActivityDoc({ tenantId: "", role: "free", type: "page_view", source: "client" }, T0)).toBeNull();
    expect(buildActivityDoc({ tenantId: null, role: "free", type: "page_view", source: "client" }, T0)).toBeNull();
  });

  it("tipo fora do catálogo não grava", () => {
    expect(
      buildActivityDoc({ tenantId: "t1", role: "free", type: "typed_password" as never, source: "client" }, T0),
    ).toBeNull();
  });
});

describe("sanitizeActivityMeta", () => {
  it("descarta chave que o tipo não declara", () => {
    expect(
      sanitizeActivityMeta("subscribe_clicked", { source: "plan_card", plan: "pro", email: "a@b.com", text: "Assinar" }),
    ).toEqual({ source: "plan_card", plan: "pro" });
  });

  it("descarta valor fora do enum, do formato e do intervalo", () => {
    expect(sanitizeActivityMeta("subscribe_clicked", { source: "hacker", interval: "weekly", skipTrial: "yes" })).toEqual({});
    expect(sanitizeActivityMeta("api_error", { method: "TRACE", status: 999, code: "lower case" })).toEqual({});
    expect(sanitizeActivityMeta("api_error", { status: 402.5 })).toEqual({});
  });

  it("normaliza o caminho de API: id cru não chega ao documento", () => {
    expect(
      sanitizeActivityMeta("api_error", {
        method: "POST",
        path: "/v1/proposals/aB3dE9fG7hJ2kL1mN0pQ?token=x",
        status: 402,
        code: "FREE_TIER_FORBIDDEN",
      }),
    ).toEqual({ method: "POST", path: "/v1/proposals/[id]", status: 402, code: "FREE_TIER_FORBIDDEN" });
  });

  it("aceita meta ausente ou de tipo errado", () => {
    expect(sanitizeActivityMeta("api_error", null)).toEqual({});
    expect(sanitizeActivityMeta("api_error", ["x"])).toEqual({});
  });
});

describe("recordTenantActivity", () => {
  it("grava na coleção e só resolve depois da escrita", async () => {
    let release: () => void = () => undefined;
    addMock.mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    let done = false;
    const pending = recordTenantActivity({
      tenantId: "t1",
      uid: "u1",
      role: "master",
      type: "session_started",
      source: "server",
    }).then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(collectionMock).toHaveBeenCalledWith(TENANT_ACTIVITY_COLLECTION);
    expect(done).toBe(false);
    release();
    await pending;
    expect(done).toBe(true);
  });

  it("com docId grava com create, e o repetido (ALREADY_EXISTS) é ignorado sem aviso", async () => {
    createMock.mockRejectedValueOnce(Object.assign(new Error("exists"), { code: 6 }));
    await recordTenantActivity({
      tenantId: "t1",
      uid: "u1",
      role: "master",
      type: "signup",
      source: "server",
      docId: "signup_u1",
    });
    expect(docMock).toHaveBeenCalledWith("signup_u1");
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("nunca lança: falha de escrita vira aviso no log", async () => {
    addMock.mockRejectedValueOnce(new Error("firestore down"));
    await expect(
      recordTenantActivity({ tenantId: "t1", role: "master", type: "session_started", source: "server" }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      "tenant_activity_write_failed",
      expect.objectContaining({ type: "session_started" }),
    );
  });

  it("super admin não chega ao Firestore", async () => {
    await recordTenantActivity({ tenantId: "t1", role: "superadmin", type: "session_started", source: "server" });
    expect(addMock).not.toHaveBeenCalled();
  });
});

describe("recordTenantActivityBatch", () => {
  it("grava o lote numa escrita só e devolve quantos entraram", async () => {
    const doc = buildActivityDoc({ tenantId: "t1", role: "free", type: "page_view", source: "client" }, T0)!;
    await expect(recordTenantActivityBatch([doc, doc])).resolves.toBe(2);
    expect(batchSet).toHaveBeenCalledTimes(2);
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });

  it("lote vazio não escreve", async () => {
    await expect(recordTenantActivityBatch([])).resolves.toBe(0);
    expect(batchCommit).not.toHaveBeenCalled();
  });

  it("falha devolve 0, sem lançar", async () => {
    batchCommit.mockRejectedValueOnce(new Error("down"));
    const doc = buildActivityDoc({ tenantId: "t1", role: "free", type: "page_view", source: "client" }, T0)!;
    await expect(recordTenantActivityBatch([doc])).resolves.toBe(0);
  });
});
