/**
 * Unit tests for processCardPayment error mapping (MP_INVALID_PAYER / MP_AUTH_FAILED / MP_REJECTED).
 * Covers cause codes 2034 and 2198 which are the real-world sandbox rejection codes.
 */
jest.mock("../services/transaction-payment.service", () => {
  const actual = jest.requireActual("../services/transaction-payment.service");
  return {
    ...actual,
    TransactionPaymentService: {
      processCardPayment: jest.fn(),
    },
  };
});
jest.mock("../services/mercadopago.service");
jest.mock("../../init", () => ({ db: {} }));
jest.mock("../../lib/logger", () => ({ logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() } }));

import { MercadoPagoApiError, TransactionPaymentService } from "../services/transaction-payment.service";
import { processCardPayment } from "./payment-public.controller";
import type { Request, Response } from "express";

function makeReq(overrides?: Partial<Request>): Request {
  return {
    params: { token: "test-token" },
    body: {
      cardToken: "card_token_abc",
      paymentMethodId: "master",
      installments: 1,
      payerEmail: "test@testuser.com",
      transactionId: "tx_abc",
    },
    ...overrides,
  } as unknown as Request;
}

function makeRes(): { res: Response; json: jest.Mock; status: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;
  return { res, json, status };
}

const mockProcessCard = TransactionPaymentService.processCardPayment as jest.Mock;

describe("processCardPayment — MercadoPago error mapping", () => {
  afterEach(() => jest.clearAllMocks());

  it("maps cause code 2034 (Invalid users involved) to MP_INVALID_PAYER", async () => {
    mockProcessCard.mockRejectedValue(
      new MercadoPagoApiError(400, "Invalid users involved", [
        { code: "2034", description: "Invalid users involved" },
      ]),
    );
    const { res, status, json } = makeRes();
    await processCardPayment(makeReq(), res);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "MP_INVALID_PAYER", mpStatus: 400 }),
    );
    expect((json.mock.calls[0][0] as { message: string }).message).toMatch(/test@testuser\.com/);
  });

  it("maps cause code 2198 (Invalid test user email) to MP_INVALID_PAYER", async () => {
    mockProcessCard.mockRejectedValue(
      new MercadoPagoApiError(400, "Invalid test user email", [
        { code: "2198", description: "Invalid test user email" },
      ]),
    );
    const { res, status, json } = makeRes();
    await processCardPayment(makeReq(), res);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "MP_INVALID_PAYER", mpStatus: 400 }),
    );
    expect((json.mock.calls[0][0] as { message: string }).message).toMatch(/test@testuser\.com/);
  });

  it("maps cause code 106 (legacy invalid users) to MP_INVALID_PAYER", async () => {
    mockProcessCard.mockRejectedValue(
      new MercadoPagoApiError(400, "Invalid users involved", [
        { code: "106", description: "Invalid users involved" },
      ]),
    );
    const { res, status, json } = makeRes();
    await processCardPayment(makeReq(), res);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: "MP_INVALID_PAYER" }));
  });

  it("maps mpStatus 401 to MP_AUTH_FAILED", async () => {
    mockProcessCard.mockRejectedValue(
      new MercadoPagoApiError(401, "Unauthorized", []),
    );
    const { res, status, json } = makeRes();
    await processCardPayment(makeReq(), res);
    expect(status).toHaveBeenCalledWith(502);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: "MP_AUTH_FAILED" }));
  });

  it("maps generic MP rejection (no special cause) to MP_REJECTED", async () => {
    mockProcessCard.mockRejectedValue(
      new MercadoPagoApiError(400, "cc_rejected_insufficient_amount", [
        { code: "001", description: "Insufficient funds" },
      ]),
    );
    const { res, status, json } = makeRes();
    await processCardPayment(makeReq(), res);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: "MP_REJECTED" }));
  });
});
