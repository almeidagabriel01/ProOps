/**
 * Tests for the subconta approval guard in TransactionPaymentService.createPayment.
 *
 * Focuses on the ASAAS_ACCOUNT_NOT_APPROVED path added in Track A.3.
 * All Firestore and Asaas HTTP calls are mocked.
 */

jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Mock firebase init
jest.mock("../../../init", () => ({
  db: {
    collection: jest.fn(),
  },
}));

// Mock cpf-cnpj-validator
jest.mock("cpf-cnpj-validator", () => ({
  cpf: { isValid: jest.fn(() => true) },
  cnpj: { isValid: jest.fn(() => true) },
}));

// Mock axios — default to throwing so tests that reach HTTP calls fail loudly
jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return {
    ...actual,
    post: jest.fn(),
    get: jest.fn(),
    isAxiosError: jest.fn(() => false),
  };
});

// Access mocked axios functions via require to avoid TS type conflicts
// eslint-disable-next-line @typescript-eslint/no-require-imports
const axiosMock = require("axios") as { post: jest.Mock; get: jest.Mock };

import { TransactionPaymentService, AsaasAccountNotApprovedError } from "../transaction-payment.service";
import { AsaasService } from "../asaas.service";
import { db } from "../../../init";

// ── Helpers ───────────────────────────────────────────────────────────────────

type MockCollection = {
  doc: jest.Mock;
  where: jest.Mock;
  limit: jest.Mock;
  get: jest.Mock;
};

function makeMockCollection(overrides: Partial<MockCollection> = {}): MockCollection {
  const col: MockCollection = {
    doc: jest.fn(),
    where: jest.fn(),
    limit: jest.fn(),
    get: jest.fn(),
    ...overrides,
  };
  col.where.mockReturnValue(col);
  col.limit.mockReturnValue(col);
  return col;
}

/** Build a minimal shared_transaction doc result */
function makeSharedLinkSnap(tenantId = "tenant-1", transactionId = "tx-1") {
  return {
    empty: false,
    docs: [
      {
        id: "link-1",
        data: () => ({ transactionId, tenantId, expiresAt: null }),
      },
    ],
  };
}

/** Build a minimal transaction doc result */
function makeTxSnap(status = "pending") {
  return {
    exists: true,
    data: () => ({
      tenantId: "tenant-1",
      status,
      amount: 100,
      type: "income",
      wallet: "wallet-1",
      clientId: "client-1",
    }),
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("TransactionPaymentService.createPayment — subconta approval guard", () => {
  const mockRefreshAccountStatus = jest.spyOn(AsaasService, "refreshAccountStatus");
  const mockGetAsaasData = jest.spyOn(AsaasService, "getAsaasData");

  const baseAsaasData = {
    apiKey: "test-key",
    subAccountId: "sub-1",
    environment: "sandbox" as const,
    walletId: "wallet-asaas",
    connectedAt: "2025-01-01T00:00:00Z",
    webhookUrl: "https://example.com/webhook",
    webhookAuthToken: "token",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: shared link resolves
    const sharedLinkCol = makeMockCollection();
    sharedLinkCol.get.mockResolvedValue(makeSharedLinkSnap());

    // Default: transaction resolves
    const txSnap = {
      exists: true,
      data: () => makeTxSnap().data(),
    };
    const txDoc = {
      exists: true,
      data: () => makeTxSnap().data(),
      get: jest.fn().mockResolvedValue(txSnap),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const txCol = makeMockCollection();
    txCol.doc.mockReturnValue(txDoc);

    // Default: client resolves empty (payer with no doc)
    const clientDoc = { exists: false, data: () => undefined };
    const clientsCol = makeMockCollection();
    clientsCol.doc.mockReturnValue(clientDoc);

    // Default: attempt doc
    const attemptDoc = {
      set: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const attemptsCol = makeMockCollection();
    attemptsCol.doc.mockReturnValue(attemptDoc);

    (db.collection as jest.Mock).mockImplementation((name: string) => {
      if (name === "shared_transactions") return sharedLinkCol;
      if (name === "transactions") return txCol;
      if (name === "clients") return clientsCol;
      if (name === "payment_attempts") return attemptsCol;
      return makeMockCollection();
    });
  });

  test("throws AsaasAccountNotApprovedError when accountStatus.general is PENDING", async () => {
    mockGetAsaasData.mockResolvedValue({
      ...baseAsaasData,
      accountStatus: {
        general: "PENDING",
        commercialInfo: "PENDING",
        bankAccountInfo: "PENDING",
        documentation: "PENDING",
        checkedAt: "2025-01-01T00:00:00Z",
      },
    });
    // No refresh needed since cached status is present and not APPROVED
    mockRefreshAccountStatus.mockResolvedValue({
      general: "PENDING",
      commercialInfo: "PENDING",
      bankAccountInfo: "PENDING",
      documentation: "PENDING",
      checkedAt: "2025-01-01T00:00:00Z",
    });

    await expect(
      TransactionPaymentService.createPayment({ token: "tok", method: "pix" }),
    ).rejects.toThrow(AsaasAccountNotApprovedError);
  });

  test("throws AsaasAccountNotApprovedError when accountStatus.general is AWAITING_APPROVAL", async () => {
    mockGetAsaasData.mockResolvedValue({
      ...baseAsaasData,
      accountStatus: {
        general: "AWAITING_APPROVAL",
        commercialInfo: "AWAITING_APPROVAL",
        bankAccountInfo: "AWAITING_APPROVAL",
        documentation: "AWAITING_APPROVAL",
        checkedAt: "2025-01-01T00:00:00Z",
      },
    });
    mockRefreshAccountStatus.mockResolvedValue({
      general: "AWAITING_APPROVAL",
      commercialInfo: "AWAITING_APPROVAL",
      bankAccountInfo: "AWAITING_APPROVAL",
      documentation: "AWAITING_APPROVAL",
      checkedAt: "2025-01-01T00:00:00Z",
    });

    await expect(
      TransactionPaymentService.createPayment({ token: "tok", method: "pix" }),
    ).rejects.toThrow(AsaasAccountNotApprovedError);
  });

  test("error has correct accountStatus value when PENDING", async () => {
    mockGetAsaasData.mockResolvedValue({
      ...baseAsaasData,
      accountStatus: {
        general: "PENDING",
        commercialInfo: "PENDING",
        bankAccountInfo: "PENDING",
        documentation: "PENDING",
        checkedAt: "2025-01-01T00:00:00Z",
        pendingDocuments: [{ id: "doc-1", status: "PENDING" }],
      },
    });
    mockRefreshAccountStatus.mockResolvedValue({
      general: "PENDING",
      commercialInfo: "PENDING",
      bankAccountInfo: "PENDING",
      documentation: "PENDING",
      checkedAt: "2025-01-01T00:00:00Z",
      pendingDocuments: [{ id: "doc-1", status: "PENDING" }],
    });

    let caught: AsaasAccountNotApprovedError | undefined;
    try {
      await TransactionPaymentService.createPayment({ token: "tok", method: "pix" });
    } catch (e) {
      if (e instanceof AsaasAccountNotApprovedError) caught = e;
    }

    expect(caught).toBeDefined();
    expect(caught!.accountStatus).toBe("PENDING");
    expect(caught!.pendingDocuments).toEqual([{ id: "doc-1", status: "PENDING" }]);
  });

  test("calls refreshAccountStatus when no cached accountStatus and throws if result is not APPROVED", async () => {
    mockGetAsaasData.mockResolvedValue({
      ...baseAsaasData,
      // no accountStatus
    });
    mockRefreshAccountStatus.mockResolvedValue({
      general: "PENDING",
      commercialInfo: "PENDING",
      bankAccountInfo: "PENDING",
      documentation: "PENDING",
      checkedAt: "2025-01-01T00:00:00Z",
    });

    await expect(
      TransactionPaymentService.createPayment({ token: "tok", method: "pix" }),
    ).rejects.toThrow(AsaasAccountNotApprovedError);

    expect(mockRefreshAccountStatus).toHaveBeenCalledWith("tenant-1");
  });

  test("does NOT call POST /v3/payments when account not approved — no AsaasApiError thrown", async () => {
    const axiosPost = axiosMock.post;

    mockGetAsaasData.mockResolvedValue({
      ...baseAsaasData,
      accountStatus: {
        general: "PENDING",
        commercialInfo: "PENDING",
        bankAccountInfo: "PENDING",
        documentation: "PENDING",
        checkedAt: "2025-01-01T00:00:00Z",
      },
    });
    mockRefreshAccountStatus.mockResolvedValue({
      general: "PENDING",
      commercialInfo: "PENDING",
      bankAccountInfo: "PENDING",
      documentation: "PENDING",
      checkedAt: "2025-01-01T00:00:00Z",
    });

    try {
      await TransactionPaymentService.createPayment({ token: "tok", method: "pix" });
    } catch {
      // expected
    }

    expect(axiosPost).not.toHaveBeenCalled();
  });

  test("calls refreshAccountStatus when no cached status; proceeds normally if result is APPROVED", async () => {
    const axiosPost = axiosMock.post;
    const axiosGet = axiosMock.get;

    mockGetAsaasData.mockResolvedValue({
      ...baseAsaasData,
      // no accountStatus
    });
    mockRefreshAccountStatus.mockResolvedValue({
      general: "APPROVED",
      commercialInfo: "APPROVED",
      bankAccountInfo: "APPROVED",
      documentation: "APPROVED",
      checkedAt: "2025-01-01T00:00:00Z",
    });

    // Mock customer creation (POST /v3/customers)
    axiosPost.mockResolvedValueOnce({ data: { id: "cust-1" } });
    // Mock PIX payment creation (POST /v3/payments)
    axiosPost.mockResolvedValueOnce({
      data: { id: "pay-1", status: "PENDING", value: 100, dueDate: "2025-01-01" },
    });
    // Mock PIX QR code fetch (GET /v3/payments/:id/pixQrCode)
    axiosGet.mockResolvedValueOnce({
      data: { encodedImage: "base64img", payload: "00020126", expirationDate: null },
    });

    // Make update chainable on transaction doc
    const txData = {
      tenantId: "tenant-1",
      status: "pending",
      amount: 100,
      type: "income",
      wallet: "wallet-1",
      clientId: null,
    };
    const txSnap = { exists: true, data: () => txData };
    const txDoc = {
      exists: true,
      data: () => txData,
      get: jest.fn().mockResolvedValue(txSnap),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const attemptsDoc = {
      set: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
    (db.collection as jest.Mock).mockImplementation((name: string) => {
      if (name === "shared_transactions") {
        const col = makeMockCollection();
        col.get.mockResolvedValue(makeSharedLinkSnap());
        return col;
      }
      if (name === "transactions") {
        const col = makeMockCollection();
        col.doc.mockReturnValue(txDoc);
        return col;
      }
      if (name === "clients") {
        const col = makeMockCollection();
        col.doc.mockReturnValue({ exists: false, data: () => undefined });
        return col;
      }
      if (name === "payment_attempts") {
        const col = makeMockCollection();
        col.doc.mockReturnValue(attemptsDoc);
        return col;
      }
      return makeMockCollection();
    });

    const result = await TransactionPaymentService.createPayment({
      token: "tok",
      method: "pix",
    });

    expect(mockRefreshAccountStatus).toHaveBeenCalledWith("tenant-1");
    expect(result.method).toBe("pix");
    // 2 POST calls: customer creation + PIX payment creation
    expect(axiosPost).toHaveBeenCalledTimes(2);
  });
});
