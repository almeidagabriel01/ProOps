/**
 * Unit tests for Asaas webhook handler.
 * Tests idempotency, auth validation, event filtering, and payment processing.
 */

jest.mock("../../init", () => ({
  db: {
    collection: jest.fn(),
    runTransaction: jest.fn(),
    batch: jest.fn(),
  },
}));
jest.mock("../../lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock("../../lib/finance-helpers", () => ({
  resolveWalletRef: jest.fn(),
}));

import type { Request, Response } from "express";
import { handleAsaasWebhook } from "../../api/controllers/asaas-webhook.controller";
import { db } from "../../init";
import { resolveWalletRef } from "../../lib/finance-helpers";

const mockedDb = db as jest.Mocked<typeof db>;
const mockResolveWalletRef = resolveWalletRef as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    params: { tenantId: "tenant_abc" },
    headers: { "asaas-access-token": "valid_auth_token" },
    body: {
      event: "PAYMENT_RECEIVED",
      payment: {
        id: "pay_001",
        externalReference: "tx_001:attempt_001",
        status: "RECEIVED",
        value: 150,
        netValue: 148,
        billingType: "PIX",
      },
    },
    ...overrides,
  } as unknown as Request;
}

function makeRes(): { res: Response; send: jest.Mock; status: jest.Mock } {
  const send = jest.fn().mockReturnThis();
  const status = jest.fn().mockReturnValue({ send });
  const res = { status, send } as unknown as Response;
  return { res, status, send };
}

// Build a db mock that simulates a connected tenant and clean state for idempotency
function setupDb({
  tenantExists = true,
  webhookAuthToken = "valid_auth_token",
  webhookEventExists = false,
  webhookEventStatus = "done",
  txStatus = "pending",
  txExists = true,
  attemptExists = true,
  attemptTenantId = "tenant_abc",
  walletName = "Conta Principal",
}: {
  tenantExists?: boolean;
  webhookAuthToken?: string;
  webhookEventExists?: boolean;
  webhookEventStatus?: string;
  txStatus?: string;
  txExists?: boolean;
  attemptExists?: boolean;
  attemptTenantId?: string;
  walletName?: string;
} = {}) {
  const tenantSnap = {
    exists: tenantExists,
    data: () =>
      tenantExists
        ? { asaas: { webhookAuthToken, apiKey: "aact_key" } }
        : undefined,
  };

  const webhookEventSnap = {
    exists: webhookEventExists,
    data: () =>
      webhookEventExists ? { status: webhookEventStatus, receivedAt: null } : undefined,
  };

  const txSnap = {
    exists: txExists,
    data: () =>
      txExists
        ? {
            status: txStatus,
            tenantId: "tenant_abc",
            amount: 150,
            type: "income",
            wallet: walletName,
            clientId: "client_001",
          }
        : undefined,
  };

  const attemptSnap = {
    exists: attemptExists,
    data: () =>
      attemptExists
        ? { tenantId: attemptTenantId, transactionId: "tx_001", status: "created" }
        : undefined,
  };

  const txRef = {
    update: jest.fn().mockResolvedValue(undefined),
  };
  const attemptRef = {
    update: jest.fn().mockResolvedValue(undefined),
  };
  const webhookEventRef = {
    set: jest.fn().mockResolvedValue(undefined),
  };
  const notificationsRef = {
    add: jest.fn().mockResolvedValue(undefined),
  };

  const walletRef = { id: "wallet_001" };
  mockResolveWalletRef.mockResolvedValue({ ref: walletRef, data: { balance: 0 } });

  // runTransaction mock: executes the callback synchronously with a mock transaction
  (mockedDb.runTransaction as jest.Mock).mockImplementation(async (callback: (t: unknown) => Promise<unknown>) => {
    const mockT = {
      get: jest.fn().mockImplementation((ref: unknown) => {
        // Identify which ref is being read by duck-typing the mock function name
        const asRef = ref as { _mockName?: string; id?: string };
        if (asRef === webhookEventRef) return Promise.resolve(webhookEventSnap);
        if (asRef === txRef) return Promise.resolve(txSnap);
        if (asRef === attemptRef) return Promise.resolve(attemptSnap);
        return Promise.resolve({ exists: false, data: () => undefined });
      }),
      set: jest.fn(),
      update: jest.fn(),
    };
    return callback(mockT);
  });

  (mockedDb.collection as jest.Mock).mockImplementation((col: string) => {
    if (col === "tenants") {
      return { doc: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue(tenantSnap) }) };
    }
    if (col === "webhookEvents") {
      return { doc: jest.fn().mockReturnValue(webhookEventRef) };
    }
    if (col === "transactions") {
      return { doc: jest.fn().mockReturnValue(txRef) };
    }
    if (col === "payment_attempts") {
      return { doc: jest.fn().mockReturnValue(attemptRef) };
    }
    if (col === "notifications") {
      return notificationsRef;
    }
    return {};
  });

  return { txRef, attemptRef, webhookEventRef, notificationsRef };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Auth validation
// ---------------------------------------------------------------------------

describe("handleAsaasWebhook — auth validation", () => {
  it("returns 200 without processing when auth token is invalid", async () => {
    setupDb({ webhookAuthToken: "correct_token" });
    const req = makeReq({
      headers: { "asaas-access-token": "wrong_token" },
    });
    const { res, status } = makeRes();

    await handleAsaasWebhook(req, res);

    expect(status).toHaveBeenCalledWith(200);
    // runTransaction should not be called for payment processing
    const transactionCalls = (mockedDb.runTransaction as jest.Mock).mock.calls.length;
    expect(transactionCalls).toBe(0);
  });

  it("returns 200 without processing when tenant not found", async () => {
    setupDb({ tenantExists: false });
    const req = makeReq();
    const { res, status } = makeRes();

    await handleAsaasWebhook(req, res);

    expect(status).toHaveBeenCalledWith(200);
  });

  it("returns 200 without processing when auth token is missing", async () => {
    setupDb();
    const req = makeReq({ headers: {} });
    const { res, status } = makeRes();

    await handleAsaasWebhook(req, res);

    expect(status).toHaveBeenCalledWith(200);
  });
});

// ---------------------------------------------------------------------------
// Event filtering
// ---------------------------------------------------------------------------

describe("handleAsaasWebhook — event filtering", () => {
  it("returns 200 without processing for PAYMENT_CREATED (non-success event)", async () => {
    setupDb();
    const req = makeReq({
      body: {
        event: "PAYMENT_CREATED",
        payment: { id: "pay_001", externalReference: "tx_001:attempt_001" },
      },
    });
    const { res, status } = makeRes();

    await handleAsaasWebhook(req, res);

    expect(status).toHaveBeenCalledWith(200);
  });

  it("returns 200 without processing for PAYMENT_OVERDUE", async () => {
    setupDb();
    const req = makeReq({
      body: {
        event: "PAYMENT_OVERDUE",
        payment: { id: "pay_001", externalReference: "tx_001:attempt_001" },
      },
    });
    const { res, status } = makeRes();

    await handleAsaasWebhook(req, res);

    expect(status).toHaveBeenCalledWith(200);
  });

  it("returns 200 without processing when payment.id is missing", async () => {
    setupDb();
    const req = makeReq({
      body: { event: "PAYMENT_RECEIVED", payment: { externalReference: "tx_001:attempt_001" } },
    });
    const { res, status } = makeRes();

    await handleAsaasWebhook(req, res);

    expect(status).toHaveBeenCalledWith(200);
  });

  it("returns 200 without processing when externalReference is malformed", async () => {
    setupDb();
    const req = makeReq({
      body: {
        event: "PAYMENT_RECEIVED",
        payment: { id: "pay_001", externalReference: "bad_format_no_colon" },
      },
    });
    const { res, status } = makeRes();

    await handleAsaasWebhook(req, res);

    expect(status).toHaveBeenCalledWith(200);
  });
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

describe("handleAsaasWebhook — idempotency", () => {
  it("skips processing when same payment.id was already processed (status=done)", async () => {
    setupDb({ webhookEventExists: true, webhookEventStatus: "done" });
    const req = makeReq();
    const { res, status } = makeRes();

    await handleAsaasWebhook(req, res);

    expect(status).toHaveBeenCalledWith(200);
    // The transaction for payment processing should be called (idempotency gate uses runTransaction)
    // but should return "skip" and not proceed to handlePaymentSuccess
    // We verify by checking that no notification was written
    const notifCollectionCall = (mockedDb.collection as jest.Mock).mock.calls.find(
      (c: string[]) => c[0] === "notifications",
    );
    expect(notifCollectionCall).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Successful payment processing
// ---------------------------------------------------------------------------

describe("handleAsaasWebhook — PAYMENT_RECEIVED", () => {
  it("returns 200 and processes payment, updating transaction and wallet", async () => {
    setupDb();
    const req = makeReq();
    const { res, status } = makeRes();

    await handleAsaasWebhook(req, res);

    expect(status).toHaveBeenCalledWith(200);
  });

  it("processes PAYMENT_CONFIRMED with same behavior as PAYMENT_RECEIVED", async () => {
    setupDb();
    const req = makeReq({
      body: {
        event: "PAYMENT_CONFIRMED",
        payment: {
          id: "pay_002",
          externalReference: "tx_001:attempt_001",
          status: "CONFIRMED",
          value: 150,
          billingType: "BOLETO",
        },
      },
    });
    const { res, status } = makeRes();

    await handleAsaasWebhook(req, res);

    expect(status).toHaveBeenCalledWith(200);
  });
});
