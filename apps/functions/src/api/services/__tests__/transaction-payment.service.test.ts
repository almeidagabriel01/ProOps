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

import { TransactionPaymentService, AsaasAccountNotApprovedError, mapAsaasStatus } from "../transaction-payment.service";
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

// ── mapAsaasStatus ────────────────────────────────────────────────────────────

describe("mapAsaasStatus", () => {
  const approved = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"] as const;
  const pending = ["PENDING", "AWAITING_RISK_ANALYSIS", "OVERDUE", "RECEIVED_IN_CASH_UNDONE"] as const;
  const refunded = ["REFUNDED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL", "DUNNING_REQUESTED", "DUNNING_RECEIVED"] as const;
  const cancelled = ["DELETED", "RESTORED"] as const;

  test.each(approved)("%s → approved", (s) => {
    expect(mapAsaasStatus(s)).toBe("approved");
  });

  test.each(pending)("%s → pending", (s) => {
    expect(mapAsaasStatus(s)).toBe("pending");
  });

  test.each(refunded)("%s → refunded", (s) => {
    expect(mapAsaasStatus(s)).toBe("refunded");
  });

  test.each(cancelled)("%s → cancelled", (s) => {
    expect(mapAsaasStatus(s)).toBe("cancelled");
  });

  test("unknown status → awaiting (default)", () => {
    expect(mapAsaasStatus("SOME_FUTURE_STATUS")).toBe("awaiting");
  });
});

// ── getPaymentStatus — Firestore-first ───────────────────────────────────────

describe("TransactionPaymentService.getPaymentStatus — Firestore-first paths", () => {
  const mockGetAsaasData = jest.spyOn(AsaasService, "getAsaasData");
  const axiosGet = axiosMock.get;

  function setupSharedLinkAndAttempt(attemptStatus: string, extra: Record<string, unknown> = {}) {
    const sharedLinkSnap = {
      empty: false,
      docs: [{ id: "link-1", data: () => ({ transactionId: "tx-1", tenantId: "tenant-1", expiresAt: null }) }],
    };
    const attemptSnap = {
      empty: false,
      docs: [{ data: () => ({ status: attemptStatus, processedAt: "2026-05-13T10:00:00Z", tenantId: "tenant-1", ...extra }) }],
    };

    const sharedLinkCol = makeMockCollection();
    sharedLinkCol.get.mockResolvedValue(sharedLinkSnap);

    const attemptsCol = makeMockCollection();
    attemptsCol.get.mockResolvedValue(attemptSnap);

    (db.collection as jest.Mock).mockImplementation((name: string) => {
      if (name === "shared_transactions") return sharedLinkCol;
      if (name === "payment_attempts") return attemptsCol;
      return makeMockCollection();
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns approved immediately when attempt.status === completed — no Asaas API call", async () => {
    setupSharedLinkAndAttempt("completed");

    const result = await TransactionPaymentService.getPaymentStatus("tok", "pay-1");

    expect(result.status).toBe("approved");
    expect(result.paidAt).toBe("2026-05-13T10:00:00Z");
    expect(axiosGet).not.toHaveBeenCalled();
  });

  test("returns rejected immediately when attempt.status === failed — no Asaas API call", async () => {
    setupSharedLinkAndAttempt("failed");

    const result = await TransactionPaymentService.getPaymentStatus("tok", "pay-1");

    expect(result.status).toBe("rejected");
    expect(axiosGet).not.toHaveBeenCalled();
  });

  test("falls back to Asaas API when attempt is still pending — maps RECEIVED_IN_CASH to approved", async () => {
    setupSharedLinkAndAttempt("initiated");
    mockGetAsaasData.mockResolvedValue({
      apiKey: "test-key",
      subAccountId: "sub-1",
      environment: "sandbox" as const,
      walletId: "wallet-1",
      connectedAt: "2026-01-01T00:00:00Z",
      webhookUrl: "https://example.com/webhook",
      webhookAuthToken: "token",
    });
    axiosGet.mockResolvedValueOnce({
      data: { id: "pay-1", status: "RECEIVED_IN_CASH", value: 100 },
    });

    const result = await TransactionPaymentService.getPaymentStatus("tok", "pay-1");

    expect(result.status).toBe("approved");
    expect(axiosGet).toHaveBeenCalledTimes(1);
  });

  test("throws PAYMENT_NOT_FOUND when no attempt exists", async () => {
    const sharedLinkSnap = {
      empty: false,
      docs: [{ id: "link-1", data: () => ({ transactionId: "tx-1", tenantId: "tenant-1", expiresAt: null }) }],
    };
    const emptyAttemptSnap = { empty: true, docs: [] };

    const sharedLinkCol = makeMockCollection();
    sharedLinkCol.get.mockResolvedValue(sharedLinkSnap);
    const attemptsCol = makeMockCollection();
    attemptsCol.get.mockResolvedValue(emptyAttemptSnap);

    (db.collection as jest.Mock).mockImplementation((name: string) => {
      if (name === "shared_transactions") return sharedLinkCol;
      if (name === "payment_attempts") return attemptsCol;
      return makeMockCollection();
    });

    await expect(TransactionPaymentService.getPaymentStatus("tok", "pay-1")).rejects.toThrow("PAYMENT_NOT_FOUND");
  });
});
