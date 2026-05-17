/**
 * Unit tests for asaas.controller.ts (subconta model)
 * Mocks: express Request/Response, AsaasService, resolveUserAndTenant, db
 */

const mockTenantRefUpdate = jest.fn().mockResolvedValue(undefined);
const mockTenantDocRef = { update: mockTenantRefUpdate };

jest.mock("../../init", () => ({
  db: {
    collection: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue(mockTenantDocRef),
    }),
  },
}));
jest.mock("../../lib/auth-helpers", () => ({
  resolveUserAndTenant: jest.fn(),
}));
jest.mock("../services/asaas.service", () => ({
  AsaasService: {
    onboardTenant: jest.fn(),
    disconnectTenant: jest.fn(),
    getAsaasData: jest.fn(),
    refreshAccountStatus: jest.fn(),
    registerWebhookForTenant: jest.fn(),
  },
}));
jest.mock("../../lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import type { Request, Response } from "express";
import {
  connectAsaas,
  getAsaasStatus,
  disconnectAsaas,
  retryAsaasWebhook,
  updateAsaasPayout,
} from "./asaas.controller";
import { resolveUserAndTenant } from "../../lib/auth-helpers";
import { AsaasService } from "../services/asaas.service";

const mockResolveUserAndTenant = resolveUserAndTenant as jest.Mock;
const mockOnboardTenant = AsaasService.onboardTenant as jest.Mock;
const mockDisconnectTenant = AsaasService.disconnectTenant as jest.Mock;
const mockGetAsaasData = AsaasService.getAsaasData as jest.Mock;
const mockRefreshAccountStatus = AsaasService.refreshAccountStatus as jest.Mock;
const mockRegisterWebhookForTenant = AsaasService.registerWebhookForTenant as jest.Mock;

const VALID_BODY = {
  name: "Empresa Teste Ltda",
  email: "financeiro@empresa.com",
  cpfCnpj: "12.345.678/0001-95",
  mobilePhone: "(11) 99999-9999",
  incomeValue: 5000,
  companyType: "LIMITED",
  postalCode: "01310-100",
  address: "Avenida Paulista",
  addressNumber: "1000",
  province: "Bela Vista",
};

const ASAAS_DATA_CONNECTED = {
  apiKey: "$aact_key",
  environment: "sandbox" as const,
  connectedAt: "2025-01-01T00:00:00.000Z",
  webhookUrl: "https://example.com/webhook",
  webhookAuthToken: "token123",
  accountStatus: {
    general: "APPROVED" as const,
    commercialInfo: "APPROVED",
    bankAccountInfo: "APPROVED",
    documentation: "APPROVED",
    checkedAt: "2025-01-01T00:00:00.000Z",
  },
};

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    user: { uid: "user_master", tenantId: "tenant_abc", role: "MASTER" },
    body: {},
    params: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes(): { res: Response; json: jest.Mock; status: jest.Mock } {
  const json = jest.fn().mockReturnThis();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;
  return { res, json, status };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockResolveUserAndTenant.mockResolvedValue({
    tenantId: "tenant_abc",
    isMaster: true,
    isSuperAdmin: false,
    userRef: {},
    userData: {},
    masterRef: {},
    masterData: {},
  });
});

// ---------------------------------------------------------------------------
// connectAsaas
// ---------------------------------------------------------------------------

describe("connectAsaas", () => {
  beforeEach(() => {
    // After onboard, getAsaasData is called to return webhookStatus
    mockGetAsaasData.mockResolvedValue({
      ...ASAAS_DATA_CONNECTED,
      webhookStatus: { state: "registered", attemptedAt: "2025-01-01T00:00:00.000Z" },
    });
  });

  it("returns 200 with success and webhookStatus on success", async () => {
    mockOnboardTenant.mockResolvedValue(undefined);
    const req = makeReq({ body: VALID_BODY });
    const { res, status, json } = makeRes();

    await connectAsaas(req, res);

    expect(mockOnboardTenant).toHaveBeenCalledWith(
      "tenant_abc",
      expect.objectContaining({
        name: "Empresa Teste Ltda",
        email: "financeiro@empresa.com",
        cpfCnpj: "12345678000195",
        mobilePhone: "11999999999",
        postalCode: "01310100",
        incomeValue: 5000,
      }),
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        webhookStatus: expect.objectContaining({ state: "registered" }),
      }),
    );
  });

  it("returns webhookStatus: null when getAsaasData returns null after onboard", async () => {
    mockOnboardTenant.mockResolvedValue(undefined);
    mockGetAsaasData.mockResolvedValue(null);
    const req = makeReq({ body: VALID_BODY });
    const { res, status, json } = makeRes();

    await connectAsaas(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true, webhookStatus: null });
  });

  it("returns 400 when name is missing", async () => {
    const req = makeReq({ body: { ...VALID_BODY, name: "" } });
    const { res, status } = makeRes();

    await connectAsaas(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(mockOnboardTenant).not.toHaveBeenCalled();
  });

  it("returns 400 when incomeValue is zero or negative", async () => {
    const req = makeReq({ body: { ...VALID_BODY, incomeValue: 0 } });
    const { res, status } = makeRes();

    await connectAsaas(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(mockOnboardTenant).not.toHaveBeenCalled();
  });

  it("returns 502 when AsaasService throws ASAAS_SUBCONTA_CREATION_FAILED", async () => {
    mockOnboardTenant.mockRejectedValue(new Error("ASAAS_SUBCONTA_CREATION_FAILED"));
    const req = makeReq({ body: VALID_BODY });
    const { res, status, json } = makeRes();

    await connectAsaas(req, res);

    expect(status).toHaveBeenCalledWith(502);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("Asaas") }),
    );
  });

  it("returns 401 when user is not authenticated", async () => {
    const req = makeReq({ user: undefined });
    const { res, status } = makeRes();

    await connectAsaas(req, res);

    expect(status).toHaveBeenCalledWith(401);
    expect(mockOnboardTenant).not.toHaveBeenCalled();
  });

  it("returns 403 when user is not master or superadmin", async () => {
    mockResolveUserAndTenant.mockResolvedValue({
      tenantId: "tenant_abc",
      isMaster: false,
      isSuperAdmin: false,
    });
    const req = makeReq({ body: VALID_BODY });
    const { res, status } = makeRes();

    await connectAsaas(req, res);

    expect(status).toHaveBeenCalledWith(403);
    expect(mockOnboardTenant).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getAsaasStatus — payout regression tests
// ---------------------------------------------------------------------------

describe("getAsaasStatus", () => {
  it("returns 200 with payout when tenant has payout configured (regression bug fix)", async () => {
    mockGetAsaasData.mockResolvedValue({
      ...ASAAS_DATA_CONNECTED,
      payout: {
        enabled: true,
        pixAddressKey: "12345678901",
        pixAddressKeyType: "CPF",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    });

    const req = makeReq();
    const { res, status, json } = makeRes();

    await getAsaasStatus(req, res);

    expect(status).toHaveBeenCalledWith(200);
    const responsePayload = json.mock.calls[0][0] as Record<string, unknown>;
    expect(responsePayload.connected).toBe(true);
    expect(responsePayload.payout).toEqual({
      enabled: true,
      pixAddressKey: "12345678901",
      pixAddressKeyType: "CPF",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });
  });

  it("omits payout field when tenant has no payout configured", async () => {
    mockGetAsaasData.mockResolvedValue(ASAAS_DATA_CONNECTED);

    const req = makeReq();
    const { res, json } = makeRes();

    await getAsaasStatus(req, res);

    const responsePayload = json.mock.calls[0][0] as Record<string, unknown>;
    expect(responsePayload).not.toHaveProperty("payout");
  });

  it("returns webhookStatus when present", async () => {
    mockGetAsaasData.mockResolvedValue({
      ...ASAAS_DATA_CONNECTED,
      webhookStatus: { state: "failed", attemptedAt: "2025-01-01T00:00:00.000Z", lastError: { message: "fail" } },
    });

    const req = makeReq();
    const { res, json } = makeRes();

    await getAsaasStatus(req, res);

    const responsePayload = json.mock.calls[0][0] as Record<string, unknown>;
    expect((responsePayload.webhookStatus as Record<string, unknown>).state).toBe("failed");
  });

  it("refreshes accountStatus when not APPROVED", async () => {
    mockGetAsaasData.mockResolvedValue({
      ...ASAAS_DATA_CONNECTED,
      accountStatus: { ...ASAAS_DATA_CONNECTED.accountStatus, general: "PENDING" as const },
    });
    mockRefreshAccountStatus.mockResolvedValue({
      general: "AWAITING_APPROVAL",
      checkedAt: "2025-01-01T00:00:00.000Z",
    });

    const req = makeReq();
    const { res, status } = makeRes();

    await getAsaasStatus(req, res);

    expect(mockRefreshAccountStatus).toHaveBeenCalledWith("tenant_abc");
    expect(status).toHaveBeenCalledWith(200);
  });

  it("returns 200 with { connected: false } when Asaas not configured", async () => {
    mockGetAsaasData.mockResolvedValue(null);
    const req = makeReq();
    const { res, status, json } = makeRes();

    await getAsaasStatus(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ connected: false });
  });

  it("returns 401 when user is not authenticated", async () => {
    const req = makeReq({ user: undefined });
    const { res, status } = makeRes();

    await getAsaasStatus(req, res);

    expect(status).toHaveBeenCalledWith(401);
  });
});

// ---------------------------------------------------------------------------
// retryAsaasWebhook
// ---------------------------------------------------------------------------

describe("retryAsaasWebhook", () => {
  it("returns 200 with webhookStatus on success", async () => {
    const webhookStatus = { state: "registered" as const, attemptedAt: "2025-01-01T00:00:00.000Z" };
    mockRegisterWebhookForTenant.mockResolvedValue(webhookStatus);

    const req = makeReq();
    const { res, status, json } = makeRes();

    await retryAsaasWebhook(req, res);

    expect(mockRegisterWebhookForTenant).toHaveBeenCalledWith("tenant_abc");
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ webhookStatus });
  });

  it("returns 200 even when webhook state is failed (domain failure, not server error)", async () => {
    const webhookStatus = {
      state: "failed" as const,
      attemptedAt: "2025-01-01T00:00:00.000Z",
      lastError: { message: "Asaas rejected" },
    };
    mockRegisterWebhookForTenant.mockResolvedValue(webhookStatus);

    const req = makeReq();
    const { res, status, json } = makeRes();

    await retryAsaasWebhook(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect((json.mock.calls[0][0] as Record<string, unknown>).webhookStatus).toEqual(webhookStatus);
  });

  it("returns 422 when ASAAS_NOT_CONNECTED", async () => {
    mockRegisterWebhookForTenant.mockRejectedValue(new Error("ASAAS_NOT_CONNECTED"));
    const req = makeReq();
    const { res, status } = makeRes();

    await retryAsaasWebhook(req, res);

    expect(status).toHaveBeenCalledWith(422);
  });

  it("returns 401 when user is not authenticated", async () => {
    const req = makeReq({ user: undefined });
    const { res, status } = makeRes();

    await retryAsaasWebhook(req, res);

    expect(status).toHaveBeenCalledWith(401);
    expect(mockRegisterWebhookForTenant).not.toHaveBeenCalled();
  });

  it("returns 403 when user is not master or superadmin", async () => {
    mockResolveUserAndTenant.mockResolvedValue({
      tenantId: "tenant_abc",
      isMaster: false,
      isSuperAdmin: false,
    });
    const req = makeReq();
    const { res, status } = makeRes();

    await retryAsaasWebhook(req, res);

    expect(status).toHaveBeenCalledWith(403);
    expect(mockRegisterWebhookForTenant).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// updateAsaasPayout — response shape regression tests
// ---------------------------------------------------------------------------

describe("updateAsaasPayout", () => {
  const PAYOUT_ENABLED_BODY = {
    enabled: true,
    pixAddressKey: "12345678901",
    pixAddressKeyType: "CPF",
  };

  beforeEach(() => {
    // Default: tenant is connected and APPROVED
    mockGetAsaasData.mockResolvedValue(ASAAS_DATA_CONNECTED);
  });

  it("returns payout in response after enabling", async () => {
    const persistedPayout = {
      enabled: true,
      pixAddressKey: "12345678901",
      pixAddressKeyType: "CPF",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
    // Second getAsaasData call (after update) returns the persisted payout
    mockGetAsaasData
      .mockResolvedValueOnce(ASAAS_DATA_CONNECTED)
      .mockResolvedValueOnce({ ...ASAAS_DATA_CONNECTED, payout: persistedPayout });

    const req = makeReq({ body: PAYOUT_ENABLED_BODY });
    const { res, status, json } = makeRes();

    await updateAsaasPayout(req, res);

    expect(status).toHaveBeenCalledWith(200);
    const responsePayload = json.mock.calls[0][0] as Record<string, unknown>;
    expect(responsePayload.success).toBe(true);
    expect(responsePayload.payout).toEqual(persistedPayout);
  });

  it("returns payout: { enabled: false } after disabling", async () => {
    const persistedPayout = { enabled: false, updatedAt: "2025-01-01T00:00:00.000Z" };
    mockGetAsaasData
      .mockResolvedValueOnce(ASAAS_DATA_CONNECTED)
      .mockResolvedValueOnce({ ...ASAAS_DATA_CONNECTED, payout: persistedPayout });

    const req = makeReq({ body: { enabled: false } });
    const { res, status, json } = makeRes();

    await updateAsaasPayout(req, res);

    expect(status).toHaveBeenCalledWith(200);
    const responsePayload = json.mock.calls[0][0] as Record<string, unknown>;
    expect((responsePayload.payout as Record<string, unknown>).enabled).toBe(false);
  });

  it("returns 400 when enabled is not boolean", async () => {
    const req = makeReq({ body: { enabled: "yes" } });
    const { res, status } = makeRes();

    await updateAsaasPayout(req, res);

    expect(status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when pixAddressKey is missing while enabled=true", async () => {
    const req = makeReq({ body: { enabled: true, pixAddressKeyType: "CPF" } });
    const { res, status } = makeRes();

    await updateAsaasPayout(req, res);

    expect(status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when CPF key has wrong digit count", async () => {
    const req = makeReq({ body: { enabled: true, pixAddressKey: "123", pixAddressKeyType: "CPF" } });
    const { res, status } = makeRes();

    await updateAsaasPayout(req, res);

    expect(status).toHaveBeenCalledWith(400);
  });

  it("returns 422 when tenant is not APPROVED for payout enable", async () => {
    mockGetAsaasData.mockResolvedValue({
      ...ASAAS_DATA_CONNECTED,
      accountStatus: { ...ASAAS_DATA_CONNECTED.accountStatus, general: "PENDING" as const },
    });
    mockRefreshAccountStatus.mockResolvedValue({ general: "PENDING" });

    const req = makeReq({ body: PAYOUT_ENABLED_BODY });
    const { res, status } = makeRes();

    await updateAsaasPayout(req, res);

    expect(status).toHaveBeenCalledWith(422);
  });

  it("returns 401 when user is not authenticated", async () => {
    const req = makeReq({ user: undefined });
    const { res, status } = makeRes();

    await updateAsaasPayout(req, res);

    expect(status).toHaveBeenCalledWith(401);
  });

  it("returns 403 when user is not master or superadmin", async () => {
    mockResolveUserAndTenant.mockResolvedValue({
      tenantId: "tenant_abc",
      isMaster: false,
      isSuperAdmin: false,
    });
    const req = makeReq({ body: PAYOUT_ENABLED_BODY });
    const { res, status } = makeRes();

    await updateAsaasPayout(req, res);

    expect(status).toHaveBeenCalledWith(403);
  });
});

// ---------------------------------------------------------------------------
// disconnectAsaas
// ---------------------------------------------------------------------------

describe("disconnectAsaas", () => {
  it("returns 200 on success", async () => {
    mockDisconnectTenant.mockResolvedValue(undefined);
    const req = makeReq();
    const { res, status, json } = makeRes();

    await disconnectAsaas(req, res);

    expect(mockDisconnectTenant).toHaveBeenCalledWith("tenant_abc");
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true });
  });

  it("returns 404 when TENANT_NOT_FOUND", async () => {
    mockDisconnectTenant.mockRejectedValue(new Error("TENANT_NOT_FOUND"));
    const req = makeReq();
    const { res, status } = makeRes();

    await disconnectAsaas(req, res);

    expect(status).toHaveBeenCalledWith(404);
  });

  it("returns 401 when user is not authenticated", async () => {
    const req = makeReq({ user: undefined });
    const { res, status } = makeRes();

    await disconnectAsaas(req, res);

    expect(status).toHaveBeenCalledWith(401);
    expect(mockDisconnectTenant).not.toHaveBeenCalled();
  });

  it("returns 403 when user is not master or superadmin", async () => {
    mockResolveUserAndTenant.mockResolvedValue({
      tenantId: "tenant_abc",
      isMaster: false,
      isSuperAdmin: false,
    });
    const req = makeReq();
    const { res, status } = makeRes();

    await disconnectAsaas(req, res);

    expect(status).toHaveBeenCalledWith(403);
    expect(mockDisconnectTenant).not.toHaveBeenCalled();
  });
});
