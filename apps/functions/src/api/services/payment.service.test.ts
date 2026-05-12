/**
 * Unit tests for transaction-payment.service.ts (Asaas implementation)
 * Mocks: axios, ../../init (db), AsaasService
 */

jest.mock("axios");
jest.mock("../../init", () => ({
  db: {
    collection: jest.fn(),
  },
}));
jest.mock("./asaas.service", () => ({
  AsaasService: {
    getAsaasData: jest.fn(),
    getBaseUrl: jest.fn((env: string) =>
      env === "sandbox" ? "https://api-sandbox.asaas.com" : "https://api.asaas.com",
    ),
  },
}));
jest.mock("../../lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock("cpf-cnpj-validator", () => ({
  cpf: { isValid: jest.fn(() => true) },
  cnpj: { isValid: jest.fn(() => true) },
}));

import axios from "axios";
import { TransactionPaymentService, AsaasApiError } from "./transaction-payment.service";
import { AsaasService } from "./asaas.service";
import { db } from "../../init";

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockGetAsaasData = AsaasService.getAsaasData as jest.Mock;
const mockedDb = db as jest.Mocked<typeof db>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSharedLinkSnap(data: Record<string, unknown> | null = null) {
  const doc = {
    id: "link_doc_id",
    data: () => data ?? {
      transactionId: "tx_001",
      tenantId: "tenant_abc",
      expiresAt: null,
    },
  };
  return {
    empty: data === null,
    docs: data === null ? [] : [doc],
  };
}

function makeTxSnap(data: Record<string, unknown> | null, exists = true) {
  return {
    exists,
    data: () => data,
  };
}

function makeAttemptRef() {
  return {
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
  };
}

function makeTxRef(snap: ReturnType<typeof makeTxSnap>) {
  return {
    get: jest.fn().mockResolvedValue(snap),
    update: jest.fn().mockResolvedValue(undefined),
  };
}

function makeClientSnap(exists: boolean, data?: Record<string, unknown>) {
  return {
    exists,
    data: () => data,
  };
}

const DEFAULT_ASAAS_DATA = {
  apiKey: "aact_valid_key",
  environment: "sandbox" as const,
  webhookAuthToken: "secret",
  webhookUrl: "https://example.com/webhook",
  connectedAt: "2025-01-01T00:00:00.000Z",
};

const DEFAULT_TX_DATA = {
  status: "pending",
  amount: 100.0,
  tenantId: "tenant_abc",
  clientId: "client_001",
  description: "Test Payment",
};

function setupDb({
  sharedLinkSnap = makeSharedLinkSnap(),
  txData = DEFAULT_TX_DATA as Record<string, unknown> | null,
  txExists = true,
  clientData = { tenantId: "tenant_abc", email: "payer@example.com", name: "João Silva", document: "12345678901" },
  clientExists = true,
}: {
  sharedLinkSnap?: ReturnType<typeof makeSharedLinkSnap>;
  txData?: Record<string, unknown> | null;
  txExists?: boolean;
  clientData?: Record<string, unknown>;
  clientExists?: boolean;
} = {}) {
  const txRef = makeTxRef(makeTxSnap(txData, txExists));
  const attemptRef = makeAttemptRef();
  const clientSnap = makeClientSnap(clientExists, clientData);

  (mockedDb.collection as jest.Mock).mockImplementation((col: string) => {
    if (col === "shared_transactions") {
      return {
        where: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue(sharedLinkSnap) }),
          }),
          limit: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue(sharedLinkSnap) }),
        }),
      };
    }
    if (col === "transactions") {
      return { doc: jest.fn().mockReturnValue(txRef) };
    }
    if (col === "payment_attempts") {
      return {
        doc: jest.fn().mockReturnValue(attemptRef),
        where: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue({
                empty: false,
                docs: [{ data: () => ({ environment: "sandbox", gatewayPaymentId: "pay_status_test" }) }],
              }),
            }),
          }),
        }),
      };
    }
    if (col === "clients") {
      return {
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue(clientSnap),
          set: jest.fn().mockResolvedValue(undefined),
        }),
      };
    }
    return {};
  });

  return { txRef, attemptRef };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAsaasData.mockResolvedValue(DEFAULT_ASAAS_DATA);
  // Default: isAxiosError returns false; override per test when needed
  (mockedAxios as unknown as Record<string, unknown>).isAxiosError = jest.fn(() => false);
});

// ---------------------------------------------------------------------------
// createPayment — PIX
// ---------------------------------------------------------------------------

describe("TransactionPaymentService.createPayment — PIX", () => {
  it("creates customer, creates payment, fetches QR code, saves attempt and transaction", async () => {
    const { txRef, attemptRef } = setupDb();

    mockedAxios.get = jest.fn()
      .mockResolvedValueOnce({ data: { data: [] } })                  // search customers (not found)
      .mockResolvedValueOnce({ data: { encodedImage: "base64img", payload: "pix_copy_paste", expirationDate: "2025-06-01T12:00:00Z" } }); // pixQrCode
    mockedAxios.post = jest.fn()
      .mockResolvedValueOnce({ data: { id: "cus_123" } })             // create customer
      .mockResolvedValueOnce({ data: { id: "pay_pix_001", status: "PENDING", value: 100, dueDate: "2025-06-01" } }); // create payment

    const result = await TransactionPaymentService.createPayment({
      token: "share_token",
      method: "pix",
    });

    expect(result.method).toBe("pix");
    expect(result.paymentId).toBe("pay_pix_001");
    expect((result as { qrCode: string }).qrCode).toBe("pix_copy_paste");
    expect((result as { qrCodeBase64: string }).qrCodeBase64).toBe("base64img");
    expect(result.amount).toBe(100);

    expect(attemptRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ gatewayPaymentId: "pay_pix_001", status: "created" }),
    );
    expect(txRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        "payment.gatewayPaymentId": "pay_pix_001",
        "payment.method": "pix",
        "payment.gateway": "asaas",
      }),
    );
  });

  it("reuses existing customer when CPF/CNPJ already registered", async () => {
    setupDb();

    mockedAxios.get = jest.fn()
      .mockResolvedValueOnce({ data: { data: [{ id: "cus_existing" }] } }) // search customers — found
      .mockResolvedValueOnce({ data: { encodedImage: "b64", payload: "pix_payload", expirationDate: "" } }); // pixQrCode
    mockedAxios.post = jest.fn()
      .mockResolvedValueOnce({ data: { id: "pay_pix_002", status: "PENDING", value: 100, dueDate: "2025-06-01" } });

    await TransactionPaymentService.createPayment({ token: "share_token", method: "pix" });

    // POST /customers should NOT be called since customer was found
    const postCalls = (mockedAxios.post as jest.Mock).mock.calls as Array<[string, ...unknown[]]>;
    const customerCreate = postCalls.find((c) => String(c[0]).includes("/customers"));
    expect(customerCreate).toBeUndefined();
  });

  it("throws ASAAS_NOT_CONFIGURED when asaas not set up for tenant", async () => {
    setupDb();
    mockGetAsaasData.mockResolvedValue(null);

    await expect(
      TransactionPaymentService.createPayment({ token: "share_token", method: "pix" }),
    ).rejects.toThrow("ASAAS_NOT_CONFIGURED");
  });

  it("throws EXPIRED_LINK when shared link not found", async () => {
    setupDb({ sharedLinkSnap: makeSharedLinkSnap(null) });

    await expect(
      TransactionPaymentService.createPayment({ token: "bad_token", method: "pix" }),
    ).rejects.toThrow("EXPIRED_LINK");
  });

  it("throws ALREADY_PAID when transaction status is paid", async () => {
    setupDb({ txData: { ...DEFAULT_TX_DATA, status: "paid" } });

    await expect(
      TransactionPaymentService.createPayment({ token: "share_token", method: "pix" }),
    ).rejects.toThrow("ALREADY_PAID");
  });

  it("throws AsaasApiError and marks attempt as failed when API rejects payment", async () => {
    const { attemptRef: _attemptRef } = setupDb();

    mockedAxios.get = jest.fn().mockResolvedValueOnce({ data: { data: [] } });
    mockedAxios.post = jest.fn()
      .mockResolvedValueOnce({ data: { id: "cus_123" } })
      .mockRejectedValueOnce(Object.assign(new Error("Bad Request"), { isAxiosError: true, response: { status: 400, data: { errors: [{ code: "invalid_value", description: "Valor inválido" }] } } }));
    (mockedAxios as unknown as Record<string, unknown>).isAxiosError = jest.fn(() => true);

    await expect(
      TransactionPaymentService.createPayment({ token: "share_token", method: "pix" }),
    ).rejects.toBeInstanceOf(AsaasApiError);

    expect(_attemptRef.update).toHaveBeenCalledWith({ status: "failed" });
  });
});

// ---------------------------------------------------------------------------
// createPayment — Boleto
// ---------------------------------------------------------------------------

describe("TransactionPaymentService.createPayment — Boleto", () => {
  it("creates customer, creates boleto payment, returns bankSlipUrl and barcodeContent", async () => {
    const { txRef } = setupDb();

    mockedAxios.get = jest.fn()
      .mockResolvedValueOnce({ data: { data: [{ id: "cus_existing" }] } }) // search customer
      .mockResolvedValueOnce({ data: { identificationField: "1234.5678 9012.3456 7890.1234 1 12340000010000" } }); // identification field
    mockedAxios.post = jest.fn()
      .mockResolvedValueOnce({ data: { id: "pay_bol_001", status: "PENDING", value: 100, dueDate: "2025-06-04", bankSlipUrl: "https://boleto.asaas.com/b/pay_bol_001" } });

    const result = await TransactionPaymentService.createPayment({
      token: "share_token",
      method: "boleto",
    });

    expect(result.method).toBe("boleto");
    expect(result.paymentId).toBe("pay_bol_001");
    expect((result as { boletoUrl: string }).boletoUrl).toBe("https://boleto.asaas.com/b/pay_bol_001");
    expect((result as { barcodeContent: string }).barcodeContent).toContain("1234.5678");

    expect(txRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        "payment.method": "boleto",
        "payment.gateway": "asaas",
      }),
    );
  });

  it("throws BOLETO_MISSING_IDENTIFICATION when client has no CPF/CNPJ", async () => {
    setupDb({
      clientData: { tenantId: "tenant_abc", email: "payer@example.com", name: "João" },
    });

    await expect(
      TransactionPaymentService.createPayment({ token: "share_token", method: "boleto" }),
    ).rejects.toThrow("BOLETO_MISSING_IDENTIFICATION");
  });

  it("accepts CPF from payerOverride for boleto when client has none", async () => {
    const { attemptRef } = setupDb({
      clientData: { tenantId: "tenant_abc", email: "payer@example.com", name: "João" },
    });

    mockedAxios.get = jest.fn()
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockResolvedValueOnce({ data: { identificationField: "34191.75001 00209.910096 12130.030000 8 97070000010000" } });
    mockedAxios.post = jest.fn()
      .mockResolvedValueOnce({ data: { id: "cus_new" } })
      .mockResolvedValueOnce({ data: { id: "pay_bol_002", status: "PENDING", value: 100, dueDate: "2025-06-04", bankSlipUrl: "https://boleto.asaas.com/b/pay_bol_002" } });

    const result = await TransactionPaymentService.createPayment({
      token: "share_token",
      method: "boleto",
      payerOverride: { identification: { type: "CPF", number: "12345678901" } },
    });

    expect(result.method).toBe("boleto");
    // Attempt should be marked created
    expect(attemptRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "created" }),
    );
  });
});

// ---------------------------------------------------------------------------
// createPayment — invalid method
// ---------------------------------------------------------------------------

describe("TransactionPaymentService.createPayment — invalid method", () => {
  it("throws INVALID_METHOD for credit_card", async () => {
    setupDb();

    await expect(
      TransactionPaymentService.createPayment({
        token: "share_token",
        method: "credit_card" as unknown as "pix",
      }),
    ).rejects.toThrow("INVALID_METHOD");
  });
});

// ---------------------------------------------------------------------------
// getPaymentStatus
// ---------------------------------------------------------------------------

describe("TransactionPaymentService.getPaymentStatus", () => {
  it("returns approved status for RECEIVED", async () => {
    setupDb();

    mockedAxios.get = jest.fn().mockResolvedValue({
      data: { id: "pay_001", status: "RECEIVED", value: 100, paymentDate: "2025-06-01" },
    });

    const result = await TransactionPaymentService.getPaymentStatus("share_token", "pay_001");

    expect(result.status).toBe("approved");
    expect(result.amount).toBe(100);
    expect(result.paidAt).toBe("2025-06-01");
  });

  it("returns pending status for PENDING", async () => {
    setupDb();

    mockedAxios.get = jest.fn().mockResolvedValue({
      data: { id: "pay_002", status: "PENDING", value: 50 },
    });

    const result = await TransactionPaymentService.getPaymentStatus("share_token", "pay_002");

    expect(result.status).toBe("pending");
  });

  it("returns cancelled status for DELETED", async () => {
    setupDb();

    mockedAxios.get = jest.fn().mockResolvedValue({
      data: { id: "pay_003", status: "DELETED", value: 75 },
    });

    const result = await TransactionPaymentService.getPaymentStatus("share_token", "pay_003");

    expect(result.status).toBe("cancelled");
  });

  it("throws PAYMENT_NOT_FOUND when no attempt matches", async () => {
    (mockedDb.collection as jest.Mock).mockImplementation((col: string) => {
      if (col === "shared_transactions") {
        return {
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue(makeSharedLinkSnap()),
            }),
          }),
        };
      }
      if (col === "payment_attempts") {
        return {
          where: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    await expect(
      TransactionPaymentService.getPaymentStatus("share_token", "pay_nonexistent"),
    ).rejects.toThrow("PAYMENT_NOT_FOUND");
  });
});
