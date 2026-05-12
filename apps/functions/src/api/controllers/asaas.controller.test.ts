/**
 * Unit tests for asaas.controller.ts (subconta model)
 * Mocks: express Request/Response, AsaasService, resolveUserAndTenant
 */

jest.mock("../../lib/auth-helpers", () => ({
  resolveUserAndTenant: jest.fn(),
}));
jest.mock("../services/asaas.service", () => ({
  AsaasService: {
    onboardTenant: jest.fn(),
    disconnectTenant: jest.fn(),
    getPublicStatus: jest.fn(),
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
import { connectAsaas, getAsaasStatus, disconnectAsaas } from "./asaas.controller";
import { resolveUserAndTenant } from "../../lib/auth-helpers";
import { AsaasService } from "../services/asaas.service";

const mockResolveUserAndTenant = resolveUserAndTenant as jest.Mock;
const mockOnboardTenant = AsaasService.onboardTenant as jest.Mock;
const mockDisconnectTenant = AsaasService.disconnectTenant as jest.Mock;
const mockGetPublicStatus = AsaasService.getPublicStatus as jest.Mock;

const VALID_BODY = {
  name: "Empresa Teste Ltda",
  email: "financeiro@empresa.com",
  cpfCnpj: "12.345.678/0001-95",
  mobilePhone: "(11) 99999-9999",
  companyType: "LIMITED",
  postalCode: "01310-100",
  address: "Avenida Paulista",
  addressNumber: "1000",
  province: "Bela Vista",
  environment: "sandbox",
};

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    user: { uid: "user_master", tenantId: "tenant_abc", role: "MASTER" },
    body: {},
    params: {},
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
  it("returns 200 on success with valid body", async () => {
    mockOnboardTenant.mockResolvedValue(undefined);
    const req = makeReq({ body: VALID_BODY });
    const { res, status, json } = makeRes();

    await connectAsaas(req, res);

    expect(mockOnboardTenant).toHaveBeenCalledWith(
      "tenant_abc",
      expect.objectContaining({
        name: "Empresa Teste Ltda",
        email: "financeiro@empresa.com",
        cpfCnpj: "12345678000195",   // stripped of formatting
        mobilePhone: "11999999999",  // stripped of formatting
        postalCode: "01310100",      // stripped of formatting
        address: "Avenida Paulista",
        addressNumber: "1000",
        province: "Bela Vista",
        companyType: "LIMITED",
      }),
      "sandbox",
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true });
  });

  it("returns 400 when name is missing", async () => {
    const req = makeReq({ body: { ...VALID_BODY, name: "" } });
    const { res, status } = makeRes();

    await connectAsaas(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(mockOnboardTenant).not.toHaveBeenCalled();
  });

  it("returns 400 when email is missing", async () => {
    const req = makeReq({ body: { ...VALID_BODY, email: "" } });
    const { res, status } = makeRes();

    await connectAsaas(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(mockOnboardTenant).not.toHaveBeenCalled();
  });

  it("returns 400 when cpfCnpj is missing", async () => {
    const req = makeReq({ body: { ...VALID_BODY, cpfCnpj: "" } });
    const { res, status } = makeRes();

    await connectAsaas(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(mockOnboardTenant).not.toHaveBeenCalled();
  });

  it("returns 400 when mobilePhone is missing", async () => {
    const req = makeReq({ body: { ...VALID_BODY, mobilePhone: "" } });
    const { res, status } = makeRes();

    await connectAsaas(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(mockOnboardTenant).not.toHaveBeenCalled();
  });

  it("returns 400 when postalCode is missing", async () => {
    const req = makeReq({ body: { ...VALID_BODY, postalCode: "" } });
    const { res, status } = makeRes();

    await connectAsaas(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(mockOnboardTenant).not.toHaveBeenCalled();
  });

  it("returns 400 when environment is invalid", async () => {
    const req = makeReq({ body: { ...VALID_BODY, environment: "credit_card" } });
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

  it("returns 500 when AsaasService throws ASAAS_MASTER_KEY_NOT_CONFIGURED", async () => {
    mockOnboardTenant.mockRejectedValue(new Error("ASAAS_MASTER_KEY_NOT_CONFIGURED"));
    const req = makeReq({ body: VALID_BODY });
    const { res, status } = makeRes();

    await connectAsaas(req, res);

    expect(status).toHaveBeenCalledWith(500);
  });

  it("returns 404 when AsaasService throws TENANT_NOT_FOUND", async () => {
    mockOnboardTenant.mockRejectedValue(new Error("TENANT_NOT_FOUND"));
    const req = makeReq({ body: VALID_BODY });
    const { res, status } = makeRes();

    await connectAsaas(req, res);

    expect(status).toHaveBeenCalledWith(404);
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

  it("passes through companyType as undefined when not provided", async () => {
    mockOnboardTenant.mockResolvedValue(undefined);
    const { companyType: _ct, ...bodyWithoutType } = VALID_BODY;
    const req = makeReq({ body: bodyWithoutType });
    const { res, status } = makeRes();

    await connectAsaas(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(mockOnboardTenant).toHaveBeenCalledWith(
      "tenant_abc",
      expect.objectContaining({ companyType: undefined }),
      "sandbox",
    );
  });
});

// ---------------------------------------------------------------------------
// getAsaasStatus
// ---------------------------------------------------------------------------

describe("getAsaasStatus", () => {
  it("returns 200 with connected status", async () => {
    mockGetPublicStatus.mockResolvedValue({
      connected: true,
      environment: "production",
      connectedAt: "2025-01-01T00:00:00.000Z",
    });
    const req = makeReq();
    const { res, status, json } = makeRes();

    await getAsaasStatus(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ connected: true, environment: "production" }),
    );
  });

  it("returns 200 with { connected: false } when not configured", async () => {
    mockGetPublicStatus.mockResolvedValue({ connected: false });
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
