/**
 * Tests for payout-transfer.service.ts
 *
 * Covers: schedulePayoutTransfer idempotency, success path, insufficient-balance
 * retry scheduling, non-retriable error, and max-retry exhaustion.
 */

jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock("../../../init", () => ({
  db: { collection: jest.fn() },
}));

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return {
    ...actual,
    post: jest.fn(),
    isAxiosError: jest.fn((e: unknown) => (e as Record<string, unknown>)?.__isAxiosError === true),
  };
});

// Mock AsaasService.getBaseUrl
jest.mock("../asaas.service", () => ({
  AsaasService: {
    getBaseUrl: jest.fn(() => "https://api-sandbox.asaas.com"),
  },
}));

import { schedulePayoutTransfer, executeTransfer } from "../payout-transfer.service";
import { db } from "../../../init";

// Access mocked functions via jest.mocked pattern
// eslint-disable-next-line @typescript-eslint/no-require-imports
const axiosMock = require("axios") as { post: jest.Mock; isAxiosError: jest.Mock };
const axiosPost = axiosMock.post;
const isAxiosError = axiosMock.isAxiosError;

interface DocMock {
  exists: boolean;
  data: () => Record<string, unknown>;
  create: jest.Mock;
  update: jest.Mock;
  get: jest.Mock;
}

function makeDocMock(data?: Record<string, unknown>, exists = true): DocMock {
  const doc: DocMock = {
    exists,
    data: () => data ?? {},
    create: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
  };
  doc.get.mockResolvedValue(doc);
  return doc;
}

function makeColMock(doc: DocMock) {
  const col = {
    doc: jest.fn().mockReturnValue(doc),
    where: jest.fn(),
    limit: jest.fn(),
    add: jest.fn().mockResolvedValue({ id: "notif-1" }),
    get: jest.fn(),
  };
  col.where.mockReturnValue(col);
  col.limit.mockReturnValue(col);
  return col;
}

const BASE_ARGS = {
  tenantId: "tenant-1",
  asaasPaymentId: "pay-1",
  transactionId: "tx-1",
  netValue: 94.51,
  payout: {
    enabled: true,
    pixAddressKey: "11111111111",
    pixAddressKeyType: "CPF" as const,
  },
  apiKey: "test-key",
  environment: "sandbox" as const,
};

const ATTEMPT_ID = `${BASE_ARGS.tenantId}_${BASE_ARGS.asaasPaymentId}`;

const BASE_ATTEMPT_DATA: Record<string, unknown> = {
  tenantId: "tenant-1",
  asaasPaymentId: "pay-1",
  transactionId: "tx-1",
  netValue: 94.51,
  payout: { pixAddressKey: "11111111111", pixAddressKeyType: "CPF" },
  apiKey: "test-key",
  environment: "sandbox",
  status: "pending",
  retryCount: 0,
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe("schedulePayoutTransfer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isAxiosError.mockReturnValue(false);
  });

  test("creates attempt doc and calls Asaas transfer → status sent", async () => {
    const attemptDoc = makeDocMock(BASE_ATTEMPT_DATA);
    const usersCol = makeColMock(makeDocMock());
    usersCol.get.mockResolvedValue({ empty: true, docs: [] });
    const notifDoc = makeDocMock();
    const notifCol = makeColMock(notifDoc);

    (db.collection as jest.Mock).mockImplementation((name: string) => {
      if (name === "payout_attempts") return makeColMock(attemptDoc);
      if (name === "users") return usersCol;
      if (name === "notifications") return notifCol;
      return makeColMock(makeDocMock());
    });

    axiosPost.mockResolvedValueOnce({
      data: { id: "transfer-1", status: "PENDING" },
    });

    await schedulePayoutTransfer(BASE_ARGS);

    expect(attemptDoc.create).toHaveBeenCalledTimes(1);
    const createCall = attemptDoc.create.mock.calls[0][0] as Record<string, unknown>;
    expect(createCall.tenantId).toBe("tenant-1");
    expect(createCall.netValue).toBe(94.51);

    expect(axiosPost).toHaveBeenCalledTimes(1);
    const postCall = axiosPost.mock.calls[0];
    expect(postCall[1]).toMatchObject({ value: 94.51, pixAddressKey: "11111111111" });

    expect(attemptDoc.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "sent", asaasTransferId: "transfer-1" }),
    );
  });

  test("idempotent — already-exists error on create skips without throwing", async () => {
    const alreadyExistsErr = Object.assign(new Error("already exists"), { code: "already-exists" });
    const attemptDoc = makeDocMock(BASE_ATTEMPT_DATA);
    attemptDoc.create.mockRejectedValueOnce(alreadyExistsErr);

    (db.collection as jest.Mock).mockImplementation(() => makeColMock(attemptDoc));

    await expect(schedulePayoutTransfer(BASE_ARGS)).resolves.toBeUndefined();
    expect(axiosPost).not.toHaveBeenCalled();
  });
});

describe("executeTransfer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isAxiosError.mockReturnValue(false);
  });

  test("insufficient balance error → status pending_balance, nextRetryAt set", async () => {
    const attemptDoc = makeDocMock(BASE_ATTEMPT_DATA);

    (db.collection as jest.Mock).mockImplementation(() => makeColMock(attemptDoc));

    const axiosErr = Object.assign(new Error("saldo insuficiente"), {
      __isAxiosError: true,
      response: {
        data: {
          errors: [{ description: "Saldo insuficiente para realizar a transferência" }],
        },
        status: 400,
      },
    });
    isAxiosError.mockReturnValue(true);
    axiosPost.mockRejectedValueOnce(axiosErr);

    await executeTransfer(ATTEMPT_ID);

    expect(attemptDoc.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending_balance",
        nextRetryAt: expect.any(String),
        lastError: expect.stringContaining("Saldo insuficiente"),
      }),
    );
  });

  test("non-retriable Asaas error → status failed, notification created", async () => {
    const attemptDoc = makeDocMock(BASE_ATTEMPT_DATA);
    const usersCol = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
      doc: jest.fn(),
      add: jest.fn(),
    };
    const notifCol = {
      add: jest.fn().mockResolvedValue({ id: "notif-1" }),
      doc: jest.fn(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn(),
    };

    (db.collection as jest.Mock).mockImplementation((name: string) => {
      if (name === "payout_attempts") return makeColMock(attemptDoc);
      if (name === "users") return usersCol;
      if (name === "notifications") return notifCol;
      return makeColMock(makeDocMock());
    });

    const axiosErr = Object.assign(new Error("chave pix invalida"), {
      __isAxiosError: true,
      response: {
        data: { errors: [{ description: "Chave PIX inválida ou não encontrada" }] },
        status: 400,
      },
    });
    isAxiosError.mockReturnValue(true);
    axiosPost.mockRejectedValueOnce(axiosErr);

    await executeTransfer(ATTEMPT_ID);

    expect(attemptDoc.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", lastError: expect.any(String) }),
    );
    expect(notifCol.add).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-1", type: "system" }),
    );
  });

  test("max retries reached → status failed without calling Asaas", async () => {
    const maxRetryData = { ...BASE_ATTEMPT_DATA, retryCount: 5, status: "pending_balance" };
    const attemptDoc = makeDocMock(maxRetryData);
    const usersCol = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
      doc: jest.fn(),
    };
    const notifCol = {
      add: jest.fn().mockResolvedValue({ id: "notif-1" }),
      doc: jest.fn(),
    };

    (db.collection as jest.Mock).mockImplementation((name: string) => {
      if (name === "payout_attempts") return makeColMock(attemptDoc);
      if (name === "users") return usersCol;
      if (name === "notifications") return notifCol;
      return makeColMock(makeDocMock());
    });

    await executeTransfer(ATTEMPT_ID);

    expect(axiosPost).not.toHaveBeenCalled();
    expect(attemptDoc.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        lastError: "Max retry count reached",
      }),
    );
  });

  test("already sent → skips without calling Asaas", async () => {
    const sentData = { ...BASE_ATTEMPT_DATA, status: "sent" };
    const attemptDoc = makeDocMock(sentData);

    (db.collection as jest.Mock).mockImplementation(() => makeColMock(attemptDoc));

    await executeTransfer(ATTEMPT_ID);

    expect(axiosPost).not.toHaveBeenCalled();
    expect(attemptDoc.update).not.toHaveBeenCalled();
  });
});
