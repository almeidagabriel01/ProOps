/**
 * Unit tests for payment-public.controller.ts (Asaas implementation)
 * Tests error mapping for AsaasApiError and key business error codes.
 */

jest.mock("../services/transaction-payment.service", () => {
  return {
    TransactionPaymentService: {
      createPayment: jest.fn(),
      getPaymentStatus: jest.fn(),
    },
    AsaasApiError: class AsaasApiError extends Error {
      constructor(
        public readonly asaasStatus: number,
        public readonly asaasMessage: string,
      ) {
        super(`ASAAS_API_ERROR:${asaasStatus}`);
        this.name = "AsaasApiError";
      }
    },
    AsaasAccountNotApprovedError: class AsaasAccountNotApprovedError extends Error {
      constructor(
        public readonly accountStatus: string,
        public readonly pendingDocuments: Array<{ id: string; status: string }>,
        public readonly onboardingUrl: string | null,
      ) {
        super("ASAAS_ACCOUNT_NOT_APPROVED");
        this.name = "AsaasAccountNotApprovedError";
      }
    },
  };
});
jest.mock("../services/asaas.service", () => ({
  AsaasService: {
    getPublicStatus: jest.fn(),
  },
}));
jest.mock("../../init", () => ({
  db: {
    collection: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
        }),
      }),
    }),
  },
}));
jest.mock("../../lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { AsaasApiError, TransactionPaymentService } from "../services/transaction-payment.service";
import { AsaasService } from "../services/asaas.service";
import { createPayment, getPaymentStatus, getPaymentConfig } from "./payment-public.controller";
import type { Request, Response } from "express";

const mockCreatePayment = TransactionPaymentService.createPayment as jest.Mock;
const mockGetPaymentStatus = TransactionPaymentService.getPaymentStatus as jest.Mock;
const mockGetPublicStatus = AsaasService.getPublicStatus as jest.Mock;

function makeReq(overrides?: Partial<Request>): Request {
  return {
    params: { token: "test-token", paymentId: "pay_001" },
    body: { method: "pix" },
    ...overrides,
  } as unknown as Request;
}

function makeRes(): { res: Response; json: jest.Mock; status: jest.Mock; setHeader: jest.Mock } {
  const json = jest.fn().mockReturnThis();
  const setHeader = jest.fn().mockReturnThis();
  const status = jest.fn().mockReturnValue({ json, setHeader });
  const res = { status, json, setHeader } as unknown as Response;
  return { res, json, status, setHeader };
}

afterEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// createPayment — method validation
// ---------------------------------------------------------------------------

describe("createPayment — method validation", () => {
  it("returns 400 for credit_card method (not supported)", async () => {
    const req = makeReq({ body: { method: "credit_card" } });
    const { res, status } = makeRes();
    await createPayment(req, res);
    expect(status).toHaveBeenCalledWith(400);
    expect(mockCreatePayment).not.toHaveBeenCalled();
  });

  it("returns 400 for debit_card method (not supported)", async () => {
    const req = makeReq({ body: { method: "debit_card" } });
    const { res, status } = makeRes();
    await createPayment(req, res);
    expect(status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when method is missing", async () => {
    const req = makeReq({ body: {} });
    const { res, status } = makeRes();
    await createPayment(req, res);
    expect(status).toHaveBeenCalledWith(400);
  });
});

// ---------------------------------------------------------------------------
// createPayment — AsaasApiError mapping
// ---------------------------------------------------------------------------

describe("createPayment — AsaasApiError mapping", () => {
  it("maps asaasStatus 401 to 502 with ASAAS_AUTH_FAILED code", async () => {
    mockCreatePayment.mockRejectedValue(new AsaasApiError(401, "Unauthorized"));
    const req = makeReq({ body: { method: "pix" } });
    const { res, status, json } = makeRes();
    await createPayment(req, res);
    expect(status).toHaveBeenCalledWith(502);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "ASAAS_AUTH_FAILED" }),
    );
  });

  it("maps asaasStatus 400 to 400 with ASAAS_REJECTED code", async () => {
    mockCreatePayment.mockRejectedValue(new AsaasApiError(400, "Pagamento recusado"));
    const req = makeReq({ body: { method: "pix" } });
    const { res, status, json } = makeRes();
    await createPayment(req, res);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "ASAAS_REJECTED", asaasStatus: 400 }),
    );
  });

  it("maps asaasStatus 500 to 502", async () => {
    mockCreatePayment.mockRejectedValue(new AsaasApiError(500, "Internal server error"));
    const req = makeReq({ body: { method: "boleto" } });
    const { res, status } = makeRes();
    await createPayment(req, res);
    expect(status).toHaveBeenCalledWith(502);
  });

  it("maps asaasStatus 429 to 429", async () => {
    mockCreatePayment.mockRejectedValue(new AsaasApiError(429, "Too many requests"));
    const req = makeReq({ body: { method: "pix" } });
    const { res, status } = makeRes();
    await createPayment(req, res);
    expect(status).toHaveBeenCalledWith(429);
  });
});

// ---------------------------------------------------------------------------
// createPayment — business error codes
// ---------------------------------------------------------------------------

describe("createPayment — business error codes", () => {
  it("returns 410 for EXPIRED_LINK", async () => {
    mockCreatePayment.mockRejectedValue(new Error("EXPIRED_LINK"));
    const req = makeReq({ body: { method: "pix" } });
    const { res, status } = makeRes();
    await createPayment(req, res);
    expect(status).toHaveBeenCalledWith(410);
  });

  it("returns 422 for ASAAS_NOT_CONFIGURED", async () => {
    mockCreatePayment.mockRejectedValue(new Error("ASAAS_NOT_CONFIGURED"));
    const req = makeReq({ body: { method: "pix" } });
    const { res, status } = makeRes();
    await createPayment(req, res);
    expect(status).toHaveBeenCalledWith(422);
  });

  it("returns 409 for ALREADY_PAID", async () => {
    mockCreatePayment.mockRejectedValue(new Error("ALREADY_PAID"));
    const req = makeReq({ body: { method: "pix" } });
    const { res, status } = makeRes();
    await createPayment(req, res);
    expect(status).toHaveBeenCalledWith(409);
  });

  it("returns 422 for BOLETO_MISSING_IDENTIFICATION", async () => {
    mockCreatePayment.mockRejectedValue(new Error("BOLETO_MISSING_IDENTIFICATION"));
    const req = makeReq({ body: { method: "boleto" } });
    const { res, status, json } = makeRes();
    await createPayment(req, res);
    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "BOLETO_MISSING_IDENTIFICATION" }),
    );
  });

  it("returns 400 for INVALID_IDENTIFICATION", async () => {
    mockCreatePayment.mockRejectedValue(new Error("INVALID_IDENTIFICATION"));
    const req = makeReq({ body: { method: "boleto" } });
    const { res, status } = makeRes();
    await createPayment(req, res);
    expect(status).toHaveBeenCalledWith(400);
  });

  it("returns 200 on success with pix result", async () => {
    mockCreatePayment.mockResolvedValue({
      method: "pix",
      paymentId: "pay_pix_001",
      qrCode: "pix_payload",
      qrCodeBase64: "base64img",
      expiresAt: "2025-06-01T12:00:00Z",
      amount: 100,
    });
    const req = makeReq({ body: { method: "pix" } });
    const { res, status, json } = makeRes();
    await createPayment(req, res);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ method: "pix", paymentId: "pay_pix_001" }),
    );
  });
});

// ---------------------------------------------------------------------------
// getPaymentStatus
// ---------------------------------------------------------------------------

describe("getPaymentStatus", () => {
  it("returns 200 with payment status", async () => {
    mockGetPaymentStatus.mockResolvedValue({
      paymentId: "pay_001",
      status: "approved",
      amount: 100,
      paidAt: "2025-06-01",
    });
    const req = makeReq({ params: { token: "tok", paymentId: "pay_001" } });
    const { res, status, json } = makeRes();
    await getPaymentStatus(req, res);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "approved" }),
    );
  });

  it("returns 404 for PAYMENT_NOT_FOUND", async () => {
    mockGetPaymentStatus.mockRejectedValue(new Error("PAYMENT_NOT_FOUND"));
    const req = makeReq({ params: { token: "tok", paymentId: "pay_bad" } });
    const { res, status } = makeRes();
    await getPaymentStatus(req, res);
    expect(status).toHaveBeenCalledWith(404);
  });

  it("returns 410 for EXPIRED_LINK", async () => {
    mockGetPaymentStatus.mockRejectedValue(new Error("EXPIRED_LINK"));
    const req = makeReq({ params: { token: "bad_tok", paymentId: "pay_001" } });
    const { res, status } = makeRes();
    await getPaymentStatus(req, res);
    expect(status).toHaveBeenCalledWith(410);
  });
});

// ---------------------------------------------------------------------------
// getPaymentConfig
// ---------------------------------------------------------------------------

describe("getPaymentConfig", () => {
  it("returns 200 with gateway=asaas when connected", async () => {
    // db mock returns a valid shared link
    const { db } = require("../../init");
    (db.collection as jest.Mock).mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            empty: false,
            docs: [{ data: () => ({ tenantId: "tenant_abc", expiresAt: null }) }],
          }),
        }),
      }),
    });
    mockGetPublicStatus.mockResolvedValue({ connected: true, environment: "sandbox" });

    const req = makeReq({ params: { token: "valid_token" } });
    const { res, status, json } = makeRes();
    await getPaymentConfig(req, res);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ gateway: "asaas", environment: "sandbox" });
  });

  it("returns 422 when Asaas not connected", async () => {
    const { db } = require("../../init");
    (db.collection as jest.Mock).mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            empty: false,
            docs: [{ data: () => ({ tenantId: "tenant_abc", expiresAt: null }) }],
          }),
        }),
      }),
    });
    mockGetPublicStatus.mockResolvedValue({ connected: false });

    const req = makeReq({ params: { token: "valid_token" } });
    const { res, status } = makeRes();
    await getPaymentConfig(req, res);
    expect(status).toHaveBeenCalledWith(422);
  });

  it("returns 410 when shared link not found", async () => {
    const { db } = require("../../init");
    (db.collection as jest.Mock).mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
        }),
      }),
    });

    const req = makeReq({ params: { token: "expired_token" } });
    const { res, status } = makeRes();
    await getPaymentConfig(req, res);
    expect(status).toHaveBeenCalledWith(410);
  });
});
