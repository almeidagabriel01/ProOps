/**
 * Share-link view recording:
 *
 * 1. Regressão: quando req.ip é undefined (CI/emulador, sem x-forwarded-for),
 *    o campo ip deve ser OMITIDO — Firestore rejeita `undefined` como valor.
 * 2. Cap do array viewerInfo (2026-07-06): cada view grava via transação
 *    read-modify-write mantendo só as últimas MAX (50) entradas + contador
 *    viewCount (increment). arrayUnion sem bound inflaria o doc até o limite
 *    de 1 MB e os writes passariam a falhar em links muito acessados.
 */

jest.mock("../../../init", () => ({
  db: { collection: jest.fn(), runTransaction: jest.fn() },
}));

jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    arrayUnion: jest.fn((...items: unknown[]) => ({ __op: "arrayUnion", items })),
    increment: jest.fn((n: number) => ({ __op: "increment", n })),
  },
}));

jest.mock("../notification.service", () => ({
  NotificationService: {
    createNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

import { SharedTransactionService } from "../shared-transactions.service";
import { SharedProposalService } from "../shared-proposal.service";
import { db } from "../../../init";

const dbMock = db as unknown as {
  collection: jest.Mock;
  runTransaction: jest.Mock;
};

type UpdatePayload = Record<string, unknown>;

function setupTransaction(existingViewerInfo: unknown[] = []) {
  const txnUpdate = jest.fn();
  dbMock.runTransaction.mockImplementation(
    async (fn: (txn: unknown) => Promise<void>) => {
      await fn({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({ viewerInfo: existingViewerInfo }),
        }),
        update: txnUpdate,
      });
    },
  );
  return txnUpdate;
}

function lastRecordedViewer(txnUpdate: jest.Mock): Record<string, unknown> {
  const payload = txnUpdate.mock.calls[0][1] as UpdatePayload;
  const viewerInfo = payload.viewerInfo as Array<Record<string, unknown>>;
  return viewerInfo[viewerInfo.length - 1];
}

function makeDocStub() {
  const update = jest.fn().mockResolvedValue(undefined);
  const get = jest.fn().mockResolvedValue({
    exists: true,
    data: () => ({ proposalId: "p1", tenantId: "t1" }),
  });
  return { update, get };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Share-link view recording: undefined ip é filtrado", () => {
  test("SharedTransactionService.recordView omite ip quando viewerData.ip é undefined", async () => {
    const docStub = makeDocStub();
    dbMock.collection.mockReturnValue({ doc: jest.fn().mockReturnValue(docStub) });
    const txnUpdate = setupTransaction();

    await SharedTransactionService.recordView(
      "shared-tx-1",
      "tenant-1",
      "tx-1",
      { ip: undefined, userAgent: "Mozilla/5.0" },
      "Test transaction",
    );

    expect(txnUpdate).toHaveBeenCalledTimes(1);
    const viewer = lastRecordedViewer(txnUpdate);
    expect(viewer).toEqual(
      expect.objectContaining({
        userAgent: expect.any(String),
        timestamp: expect.any(String),
      }),
    );
    expect(Object.prototype.hasOwnProperty.call(viewer, "ip")).toBe(false);
    // Nenhum undefined em nenhum campo — Firestore rejeita undefined.
    for (const value of Object.values(viewer)) {
      expect(value).not.toBe(undefined);
    }
  });

  test("SharedTransactionService.recordView mantém ip quando presente", async () => {
    const docStub = makeDocStub();
    dbMock.collection.mockReturnValue({ doc: jest.fn().mockReturnValue(docStub) });
    const txnUpdate = setupTransaction();

    await SharedTransactionService.recordView(
      "shared-tx-2",
      "tenant-1",
      "tx-2",
      { ip: "203.0.113.42", userAgent: "Mozilla/5.0" },
      "Test transaction 2",
    );

    const viewer = lastRecordedViewer(txnUpdate);
    expect(viewer.ip).toBeTruthy();
    expect(viewer.ip).not.toBe(undefined);
  });

  test("SharedProposalService.recordView omite ip quando viewerData.ip é undefined", async () => {
    const docStub = makeDocStub();
    const proposalDocStub = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ title: "Test proposal", tenantId: "tenant-1" }),
      }),
    };
    dbMock.collection.mockImplementation((name: string) => {
      if (name === "proposals") {
        return { doc: jest.fn().mockReturnValue(proposalDocStub) };
      }
      return { doc: jest.fn().mockReturnValue(docStub) };
    });
    const txnUpdate = setupTransaction();

    await SharedProposalService.recordView(
      "shared-prop-1",
      "tenant-1",
      "prop-1",
      { ip: undefined, userAgent: "Mozilla/5.0" },
      "Test proposal",
    );

    expect(txnUpdate).toHaveBeenCalledTimes(1);
    const viewer = lastRecordedViewer(txnUpdate);
    expect(Object.prototype.hasOwnProperty.call(viewer, "ip")).toBe(false);
  });

  test("nem ip nem userAgent aparecem quando ambos undefined", async () => {
    const docStub = makeDocStub();
    dbMock.collection.mockReturnValue({ doc: jest.fn().mockReturnValue(docStub) });
    const txnUpdate = setupTransaction();

    await SharedTransactionService.recordView(
      "shared-tx-3",
      "tenant-1",
      "tx-3",
      { ip: undefined, userAgent: undefined },
      "Test",
    );

    const viewer = lastRecordedViewer(txnUpdate);
    expect(Object.prototype.hasOwnProperty.call(viewer, "ip")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(viewer, "userAgent")).toBe(false);
    expect(viewer.timestamp).toEqual(expect.any(String));
  });
});

describe("Share-link view recording: array capado + viewCount", () => {
  test("array cheio (50) → mantém 50, descarta a mais antiga, incrementa viewCount", async () => {
    const docStub = makeDocStub();
    dbMock.collection.mockReturnValue({ doc: jest.fn().mockReturnValue(docStub) });
    const existing = Array.from({ length: 50 }, (_, i) => ({
      timestamp: `2026-01-01T00:00:${String(i).padStart(2, "0")}Z`,
    }));
    const txnUpdate = setupTransaction(existing);

    await SharedTransactionService.recordView(
      "shared-tx-4",
      "tenant-1",
      "tx-4",
      { ip: "203.0.113.42", userAgent: "Mozilla/5.0" },
      "Test",
    );

    const payload = txnUpdate.mock.calls[0][1] as UpdatePayload;
    const viewerInfo = payload.viewerInfo as Array<Record<string, unknown>>;
    expect(viewerInfo).toHaveLength(50);
    // a mais antiga saiu; a nova entrou no fim
    expect(viewerInfo[0].timestamp).toBe("2026-01-01T00:00:01Z");
    expect(viewerInfo[49].ip).toBeTruthy();
    expect(payload.viewCount).toEqual({ __op: "increment", n: 1 });
  });

  test("doc do share link inexistente → transação não atualiza nada", async () => {
    const docStub = makeDocStub();
    dbMock.collection.mockReturnValue({ doc: jest.fn().mockReturnValue(docStub) });
    const txnUpdate = jest.fn();
    dbMock.runTransaction.mockImplementation(
      async (fn: (txn: unknown) => Promise<void>) => {
        await fn({
          get: jest.fn().mockResolvedValue({ exists: false, data: () => undefined }),
          update: txnUpdate,
        });
      },
    );

    await SharedTransactionService.recordView(
      "shared-tx-5",
      "tenant-1",
      "tx-5",
      { ip: undefined, userAgent: undefined },
      "Test",
    );

    expect(txnUpdate).not.toHaveBeenCalled();
  });
});
