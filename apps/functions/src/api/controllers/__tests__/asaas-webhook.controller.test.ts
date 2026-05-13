/**
 * Tests for the payout-transfer wiring in asaas-webhook.controller.ts.
 *
 * Focuses on:
 * - PAYMENT_RECEIVED + payout enabled → schedulePayoutTransfer called with netValue
 * - PAYMENT_RECEIVED + no payout configured → schedulePayoutTransfer NOT called
 * - PAYMENT_CONFIRMED + payout enabled → schedulePayoutTransfer NOT called (only RECEIVED triggers)
 */

jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock("../../../init", () => ({
  db: { collection: jest.fn(), runTransaction: jest.fn() },
}));

jest.mock("../../../lib/finance-helpers", () => ({
  resolveWalletRef: jest.fn(),
}));

// Mock payout-transfer service
const mockSchedulePayoutTransfer = jest.fn().mockResolvedValue(undefined);
jest.mock("../../services/payout-transfer.service", () => ({
  schedulePayoutTransfer: (...args: unknown[]) => mockSchedulePayoutTransfer(...args),
}));

import type { Request, Response } from "express";
import { handleAsaasWebhook } from "../asaas-webhook.controller";
import { db } from "../../../init";
import { resolveWalletRef } from "../../../lib/finance-helpers";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function makeReq(body: Record<string, unknown>, tenantId = "tenant-1"): Request {
  return {
    params: { tenantId },
    headers: { "asaas-access-token": "secret-token" },
    body,
  } as unknown as Request;
}

interface DocMock {
  exists: boolean;
  data: () => Record<string, unknown>;
  get: jest.Mock;
  update: jest.Mock;
  set: jest.Mock;
}

function makeDocMock(data: Record<string, unknown>, exists = true): DocMock {
  const doc: DocMock = {
    exists,
    data: () => data,
    get: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
  };
  doc.get.mockResolvedValue(doc);
  return doc;
}

function makeColMock(doc: DocMock) {
  return {
    doc: jest.fn().mockReturnValue(doc),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ empty: false, docs: [doc] }),
  };
}

// Tenant doc with payout configured
const TENANT_WITH_PAYOUT = {
  asaas: {
    apiKey: "sub-key",
    environment: "sandbox",
    webhookAuthToken: "secret-token",
    payout: {
      enabled: true,
      pixAddressKey: "11111111111",
      pixAddressKeyType: "CPF",
    },
  },
};

// Tenant doc without payout
const TENANT_WITHOUT_PAYOUT = {
  asaas: {
    apiKey: "sub-key",
    environment: "sandbox",
    webhookAuthToken: "secret-token",
  },
};

const TRANSACTION_DATA = {
  tenantId: "tenant-1",
  status: "pending",
  amount: 100,
  type: "income",
  wallet: "wallet-1",
  payment: { gatewayPaymentId: "pay-1" },
};

const PAYMENT_ATTEMPT_DATA = {
  tenantId: "tenant-1",
  transactionId: "tx-1",
  status: "created",
};

// ── test suite ────────────────────────────────────────────────────────────────

describe("handleAsaasWebhook — payout transfer wiring", () => {
  const mockRunTransaction = db.runTransaction as jest.Mock;
  const mockResolveWalletRef = resolveWalletRef as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default wallet resolve
    mockResolveWalletRef.mockResolvedValue({
      ref: { update: jest.fn().mockResolvedValue(undefined) },
      walletId: "wallet-1",
    });

    // runTransaction: simulate handlePaymentSuccess executing writes
    mockRunTransaction.mockImplementation(async (fn: (t: unknown) => Promise<void>) => {
      const txDoc = makeDocMock(TRANSACTION_DATA);
      const attemptDoc = makeDocMock(PAYMENT_ATTEMPT_DATA);
      const t = {
        get: jest.fn().mockImplementation((ref: { id?: string }) => {
          // return attempt or transaction based on collection
          if (ref?.id === "attempt-1") return Promise.resolve(attemptDoc);
          return Promise.resolve(txDoc);
        }),
        update: jest.fn(),
        set: jest.fn(),
      };
      // Provide two docs for Promise.all call inside handlePaymentSuccess
      t.get
        .mockResolvedValueOnce(txDoc)      // transactionRef
        .mockResolvedValueOnce(attemptDoc); // attemptRef
      await fn(t);
    });
  });

  function setupDb(tenantData: Record<string, unknown>) {
    const tenantDoc = makeDocMock(tenantData);
    const webhookEventsDoc = makeDocMock({ status: "done" }, false); // not exists → process
    const txDoc = makeDocMock(TRANSACTION_DATA);
    const attemptDoc = makeDocMock(PAYMENT_ATTEMPT_DATA);
    const notifCol = { add: jest.fn().mockResolvedValue({ id: "notif-1" }) };

    // runTransaction for beginWebhookProcessing: returns "process"
    mockRunTransaction
      .mockResolvedValueOnce("process")
      // runTransaction for handlePaymentSuccess
      .mockImplementationOnce(async (fn: (t: unknown) => Promise<void>) => {
        const t = {
          get: jest.fn()
            .mockResolvedValueOnce(txDoc)
            .mockResolvedValueOnce(attemptDoc),
          update: jest.fn(),
          set: jest.fn(),
        };
        await fn(t);
      });

    (db.collection as jest.Mock).mockImplementation((name: string) => {
      if (name === "tenants") return makeColMock(tenantDoc);
      if (name === "webhookEvents") return makeColMock(webhookEventsDoc);
      if (name === "transactions") return makeColMock(txDoc);
      if (name === "payment_attempts") return makeColMock(attemptDoc);
      if (name === "notifications") return notifCol;
      const col = makeColMock(makeDocMock({}));
      return col;
    });
  }

  test("PAYMENT_RECEIVED + payout enabled → schedulePayoutTransfer called with netValue=94.51", async () => {
    setupDb(TENANT_WITH_PAYOUT);

    const req = makeReq({
      event: "PAYMENT_RECEIVED",
      payment: {
        id: "pay-1",
        externalReference: "tx-1:attempt-1",
        netValue: 94.51,
        value: 100,
      },
    });
    const res = makeRes();

    await handleAsaasWebhook(req, res);

    // Give fire-and-forget a tick to execute
    await Promise.resolve();

    expect(mockSchedulePayoutTransfer).toHaveBeenCalledTimes(1);
    const callArg = mockSchedulePayoutTransfer.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.netValue).toBe(94.51);
    expect(callArg.tenantId).toBe("tenant-1");
    expect(callArg.asaasPaymentId).toBe("pay-1");
    expect((callArg.payout as Record<string, unknown>).pixAddressKey).toBe("11111111111");
  });

  test("PAYMENT_RECEIVED + no payout configured → schedulePayoutTransfer NOT called", async () => {
    setupDb(TENANT_WITHOUT_PAYOUT);

    const req = makeReq({
      event: "PAYMENT_RECEIVED",
      payment: {
        id: "pay-1",
        externalReference: "tx-1:attempt-1",
        netValue: 94.51,
        value: 100,
      },
    });
    const res = makeRes();

    await handleAsaasWebhook(req, res);
    await Promise.resolve();

    expect(mockSchedulePayoutTransfer).not.toHaveBeenCalled();
  });

  test("PAYMENT_CONFIRMED + payout enabled → schedulePayoutTransfer NOT called", async () => {
    setupDb(TENANT_WITH_PAYOUT);

    const req = makeReq({
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: "pay-1",
        externalReference: "tx-1:attempt-1",
        netValue: 94.51,
        value: 100,
      },
    });
    const res = makeRes();

    await handleAsaasWebhook(req, res);
    await Promise.resolve();

    expect(mockSchedulePayoutTransfer).not.toHaveBeenCalled();
  });
});

// ── timing-safe auth ──────────────────────────────────────────────────────────

describe("handleAsaasWebhook — timing-safe auth token check", () => {
  function setupDbWithToken(storedToken: string) {
    const tenantDoc = makeDocMock({
      asaas: { apiKey: "sub-key", environment: "sandbox", webhookAuthToken: storedToken },
    });
    (db.collection as jest.Mock).mockImplementation((name: string) => {
      if (name === "tenants") return makeColMock(tenantDoc);
      return makeColMock(makeDocMock({}));
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 200 OK and does NOT process when auth header is missing", async () => {
    setupDbWithToken("correct-token");
    const req = {
      params: { tenantId: "tenant-1" },
      headers: {},  // no asaas-access-token
      body: { event: "PAYMENT_RECEIVED", payment: { id: "pay-1", externalReference: "tx-1:attempt-1", value: 100 } },
    } as unknown as import("express").Request;
    const res = makeRes();

    await handleAsaasWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockSchedulePayoutTransfer).not.toHaveBeenCalled();
  });

  test("returns 200 OK and does NOT process when token is wrong (same length)", async () => {
    setupDbWithToken("aaaaaaaaaaaaaaa");
    const req = {
      params: { tenantId: "tenant-1" },
      headers: { "asaas-access-token": "bbbbbbbbbbbbbbb" },  // same length, different content
      body: { event: "PAYMENT_RECEIVED", payment: { id: "pay-1", externalReference: "tx-1:attempt-1", value: 100 } },
    } as unknown as import("express").Request;
    const res = makeRes();

    await handleAsaasWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockSchedulePayoutTransfer).not.toHaveBeenCalled();
  });

  test("returns 200 OK and does NOT process when token length differs", async () => {
    setupDbWithToken("short");
    const req = {
      params: { tenantId: "tenant-1" },
      headers: { "asaas-access-token": "short-but-longer" },
      body: { event: "PAYMENT_RECEIVED", payment: { id: "pay-1", externalReference: "tx-1:attempt-1", value: 100 } },
    } as unknown as import("express").Request;
    const res = makeRes();

    await handleAsaasWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockSchedulePayoutTransfer).not.toHaveBeenCalled();
  });
});

// ── PAYMENT_RECEIVED_IN_CASH event ────────────────────────────────────────────

describe("handleAsaasWebhook — PAYMENT_RECEIVED_IN_CASH triggers handlePaymentSuccess", () => {
  const mockRunTransaction = db.runTransaction as jest.Mock;

  function setupDbForCashReceived() {
    const tenantDoc = makeDocMock(TENANT_WITHOUT_PAYOUT);
    const webhookEventsDoc = makeDocMock({ status: "done" }, false);
    const txDoc = makeDocMock(TRANSACTION_DATA);
    const attemptDoc = makeDocMock(PAYMENT_ATTEMPT_DATA);
    const notifCol = { add: jest.fn().mockResolvedValue({ id: "notif-1" }) };

    mockRunTransaction
      .mockResolvedValueOnce("process")
      .mockImplementationOnce(async (fn: (t: unknown) => Promise<void>) => {
        const t = {
          get: jest.fn()
            .mockResolvedValueOnce(txDoc)
            .mockResolvedValueOnce(attemptDoc),
          update: jest.fn(),
          set: jest.fn(),
        };
        await fn(t);
      });

    (db.collection as jest.Mock).mockImplementation((name: string) => {
      if (name === "tenants") return makeColMock(tenantDoc);
      if (name === "webhookEvents") return makeColMock(webhookEventsDoc);
      if (name === "transactions") return makeColMock(txDoc);
      if (name === "payment_attempts") return makeColMock(attemptDoc);
      if (name === "notifications") return notifCol;
      return makeColMock(makeDocMock({}));
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (require("../../../lib/finance-helpers") as { resolveWalletRef: jest.Mock }).resolveWalletRef
      .mockResolvedValue({ ref: { update: jest.fn().mockResolvedValue(undefined) }, walletId: "wallet-1" });
  });

  test("PAYMENT_RECEIVED_IN_CASH processes payment (calls runTransaction twice)", async () => {
    setupDbForCashReceived();

    const req = makeReq({
      event: "PAYMENT_RECEIVED_IN_CASH",
      payment: {
        id: "pay-1",
        externalReference: "tx-1:attempt-1",
        netValue: 94.51,
        value: 100,
      },
    });
    const res = makeRes();

    await handleAsaasWebhook(req, res);

    // Two runTransaction calls: idempotency gate + handlePaymentSuccess
    expect(mockRunTransaction).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
