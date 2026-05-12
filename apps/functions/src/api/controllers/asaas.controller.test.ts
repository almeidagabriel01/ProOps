/**
 * Unit tests for asaas.controller.ts
 * Mocks: express Request/Response, AsaasService, resolveUserAndTenant
 */

jest.mock("../../lib/auth-helpers", () => ({
  resolveUserAndTenant: jest.fn(),
}));
jest.mock("../services/asaas.service", () => ({
  AsaasService: {
    connectTenant: jest.fn(),
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
const mockConnectTenant = AsaasService.connectTenant as jest.Mock;
const mockDisconnectTenant = AsaasService.disconnectTenant as jest.Mock;
const mockGetPublicStatus = AsaasService.getPublicStatus as jest.Mock;

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
    mockConnectTenant.mockResolvedValue(undefined);
    const req = makeReq({
      body: { apiKey: "aact_valid_key", environment: "sandbox" },
    });
    const { res, status, json } = makeRes();

    await connectAsaas(req, res);

    expect(mockConnectTenant).toHaveBeenCalledWith("tenant_abc", "aact_valid_key", "sandbox");
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true });
  });

  it("returns 400 when apiKey is missing", async () => {
    const req = makeReq({ body: { environment: "sandbox" } });
    const { res, status } = makeRes();

    await connectAsaas(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(mockConnectTenant).not.toHaveBeenCalled();
  });

  it("returns 400 when environment is invalid", async () => {
    const req = makeReq({ body: { apiKey: "aact_key", environment: "credit_card" } });
    const { res, status } = makeRes();

    await connectAsaas(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(mockConnectTenant).not.toHaveBeenCalled();
  });

  it("returns 422 when AsaasService throws ASAAS_INVALID_API_KEY", async () => {
    mockConnectTenant.mockRejectedValue(new Error("ASAAS_INVALID_API_KEY"));
    const req = makeReq({ body: { apiKey: "bad_key", environment: "production" } });
    const { res, status, json } = makeRes();

    await connectAsaas(req, res);

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("inválida") }),
    );
  });

  it("returns 404 when AsaasService throws TENANT_NOT_FOUND", async () => {
    mockConnectTenant.mockRejectedValue(new Error("TENANT_NOT_FOUND"));
    const req = makeReq({ body: { apiKey: "aact_key", environment: "sandbox" } });
    const { res, status } = makeRes();

    await connectAsaas(req, res);

    expect(status).toHaveBeenCalledWith(404);
  });

  it("returns 401 when user is not authenticated", async () => {
    const req = makeReq({ user: undefined });
    const { res, status } = makeRes();

    await connectAsaas(req, res);

    expect(status).toHaveBeenCalledWith(401);
    expect(mockConnectTenant).not.toHaveBeenCalled();
  });

  it("returns 403 when user is not master or superadmin", async () => {
    mockResolveUserAndTenant.mockResolvedValue({
      tenantId: "tenant_abc",
      isMaster: false,
      isSuperAdmin: false,
    });
    const req = makeReq({ body: { apiKey: "aact_key", environment: "sandbox" } });
    const { res, status } = makeRes();

    await connectAsaas(req, res);

    expect(status).toHaveBeenCalledWith(403);
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
