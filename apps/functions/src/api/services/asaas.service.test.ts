/**
 * Unit tests for AsaasService
 * Mocks: axios, ../../init (db), ../../lib/logger, ../../lib/frontend-app-url
 */

jest.mock("axios");
jest.mock("../../init", () => ({
  db: {
    collection: jest.fn(),
  },
}));
jest.mock("../../lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock("../../lib/frontend-app-url", () => ({
  resolveAsaasWebhookUrl: jest.fn(
    (tenantId: string) =>
      `https://southamerica-east1-erp-softcode.cloudfunctions.net/api/webhooks/asaas/${tenantId}`,
  ),
}));

import axios from "axios";
import { AsaasService } from "./asaas.service";
import { db } from "../../init";

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedDb = db as jest.Mocked<typeof db>;

function makeDocRef(data: Record<string, unknown> | null, exists = true) {
  const snap = { exists, data: () => data };
  const ref = {
    get: jest.fn().mockResolvedValue(snap),
    update: jest.fn().mockResolvedValue(undefined),
  };
  return { ref, snap };
}

function makeCollection(docRef: ReturnType<typeof makeDocRef>["ref"]) {
  return {
    doc: jest.fn().mockReturnValue(docRef),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AsaasService.getBaseUrl", () => {
  it("returns sandbox URL for sandbox environment", () => {
    expect(AsaasService.getBaseUrl("sandbox")).toBe("https://api-sandbox.asaas.com");
  });

  it("returns production URL for production environment", () => {
    expect(AsaasService.getBaseUrl("production")).toBe("https://api.asaas.com");
  });
});

describe("AsaasService.validateApiKey", () => {
  it("returns walletId from API response", async () => {
    mockedAxios.get = jest.fn().mockResolvedValue({ data: { walletId: "wlt_abc123", id: "acc_1" } });
    const result = await AsaasService.validateApiKey("api_key_test", "sandbox");
    expect(result.walletId).toBe("wlt_abc123");
  });

  it("falls back to id when walletId is absent", async () => {
    mockedAxios.get = jest.fn().mockResolvedValue({ data: { id: "acc_fallback" } });
    const result = await AsaasService.validateApiKey("api_key_test", "production");
    expect(result.walletId).toBe("acc_fallback");
  });

  it("rejects when axios throws", async () => {
    mockedAxios.get = jest.fn().mockRejectedValue(new Error("Network error"));
    await expect(AsaasService.validateApiKey("bad_key", "sandbox")).rejects.toThrow("Network error");
  });
});

describe("AsaasService.connectTenant", () => {
  it("succeeds with sandbox environment, validates key, configures webhook, saves to Firestore", async () => {
    const { ref: docRef } = makeDocRef({ name: "Test Tenant" });
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    mockedAxios.get = jest.fn().mockResolvedValue({ data: { walletId: "wlt_abc" } });
    mockedAxios.post = jest.fn().mockResolvedValue({ data: { id: "wbk_123" } });

    await AsaasService.connectTenant("tenant1", "valid_api_key", "sandbox");

    expect(mockedAxios.get).toHaveBeenCalledWith(
      "https://api-sandbox.asaas.com/v3/myAccount",
      expect.objectContaining({ headers: { access_token: "valid_api_key" } }),
    );
    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://api-sandbox.asaas.com/v3/webhooks",
      expect.objectContaining({
        enabled: true,
        events: expect.arrayContaining(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]),
      }),
      expect.any(Object),
    );
    expect(docRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        asaasEnabled: true,
        asaas: expect.objectContaining({
          environment: "sandbox",
          walletId: "wlt_abc",
          webhookId: "wbk_123",
        }),
      }),
    );
  });

  it("throws ASAAS_INVALID_API_KEY when axios rejects GET /myAccount", async () => {
    const { ref: docRef } = makeDocRef({ name: "Test Tenant" });
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    mockedAxios.get = jest.fn().mockRejectedValue(new Error("Unauthorized"));

    await expect(
      AsaasService.connectTenant("tenant1", "bad_key", "sandbox"),
    ).rejects.toThrow("ASAAS_INVALID_API_KEY");
  });

  it("throws TENANT_NOT_FOUND when tenant document does not exist", async () => {
    const { ref: docRef } = makeDocRef(null, false);
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    await expect(
      AsaasService.connectTenant("nonexistent", "api_key", "sandbox"),
    ).rejects.toThrow("TENANT_NOT_FOUND");
  });

  it("saves even when webhook configuration fails (best-effort)", async () => {
    const { ref: docRef } = makeDocRef({ name: "Test Tenant" });
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    mockedAxios.get = jest.fn().mockResolvedValue({ data: { walletId: "wlt_xyz" } });
    mockedAxios.post = jest.fn().mockRejectedValue(new Error("Webhook endpoint unreachable"));

    await AsaasService.connectTenant("tenant2", "api_key", "production");

    // Should still update Firestore despite webhook failure
    expect(docRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ asaasEnabled: true }),
    );
  });
});

describe("AsaasService.disconnectTenant", () => {
  it("updates Firestore to remove asaas data and set asaasEnabled=false", async () => {
    const { ref: docRef } = makeDocRef({ asaas: { apiKey: "key" } });
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    await AsaasService.disconnectTenant("tenant1");

    expect(docRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ asaasEnabled: false }),
    );
  });

  it("throws TENANT_NOT_FOUND when tenant does not exist", async () => {
    const { ref: docRef } = makeDocRef(null, false);
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    await expect(AsaasService.disconnectTenant("nonexistent")).rejects.toThrow("TENANT_NOT_FOUND");
  });
});

describe("AsaasService.getPublicStatus", () => {
  it("returns connected status with environment and connectedAt", async () => {
    const { ref: docRef } = makeDocRef({
      asaas: {
        apiKey: "secret_key",
        environment: "production",
        connectedAt: "2025-01-01T00:00:00.000Z",
        webhookUrl: "https://example.com/webhook",
        webhookAuthToken: "auth_token",
      },
    });
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    const status = await AsaasService.getPublicStatus("tenant1");

    expect(status.connected).toBe(true);
    expect(status.environment).toBe("production");
    expect(status.connectedAt).toBe("2025-01-01T00:00:00.000Z");
    // API key must NOT be exposed
    expect(status).not.toHaveProperty("apiKey");
    expect(status).not.toHaveProperty("webhookAuthToken");
  });

  it("returns { connected: false } when asaas data is absent", async () => {
    const { ref: docRef } = makeDocRef({ name: "Tenant without Asaas" });
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    const status = await AsaasService.getPublicStatus("tenant1");

    expect(status).toEqual({ connected: false });
  });

  it("returns { connected: false } when tenant document does not exist", async () => {
    const { ref: docRef } = makeDocRef(null, false);
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    const status = await AsaasService.getPublicStatus("tenant_nonexistent");

    expect(status).toEqual({ connected: false });
  });
});
