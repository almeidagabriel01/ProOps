/**
 * Unit tests for AsaasService (subconta model)
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

const VALID_ONBOARDING_DATA = {
  name: "Empresa Teste Ltda",
  email: "financeiro@empresa.com",
  cpfCnpj: "12345678000195",
  mobilePhone: "11999999999",
  incomeValue: 5000,
  companyType: "LIMITED",
  postalCode: "01310100",
  address: "Avenida Paulista",
  addressNumber: "1000",
  province: "Bela Vista",
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default: only sandbox key set → resolveEnvironmentFromConfig() returns "sandbox"
  process.env.ASAAS_MASTER_API_KEY = "$aact_master_sandbox_key";
  delete process.env.ASAAS_MASTER_API_KEY_PROD;
});

afterEach(() => {
  delete process.env.ASAAS_MASTER_API_KEY;
  delete process.env.ASAAS_MASTER_API_KEY_PROD;
});

describe("AsaasService.getBaseUrl", () => {
  it("returns sandbox URL for sandbox environment", () => {
    expect(AsaasService.getBaseUrl("sandbox")).toBe("https://api-sandbox.asaas.com");
  });

  it("returns production URL for production environment", () => {
    expect(AsaasService.getBaseUrl("production")).toBe("https://api.asaas.com");
  });
});

describe("AsaasService.onboardTenant", () => {
  it("creates subconta via master key, saves apiKey and subAccountId to Firestore", async () => {
    const { ref: docRef } = makeDocRef({ name: "Tenant Teste" });
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    mockedAxios.post = jest.fn().mockResolvedValue({
      data: { id: "acc_sub123", apiKey: "$aact_sub_key", walletId: "wlt_abc" },
    });

    await AsaasService.onboardTenant("tenant1", VALID_ONBOARDING_DATA);

    // First call: POST /v3/accounts (no webhooks in body)
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      1,
      "https://api-sandbox.asaas.com/v3/accounts",
      expect.objectContaining({
        name: VALID_ONBOARDING_DATA.name,
        email: VALID_ONBOARDING_DATA.email,
        cpfCnpj: VALID_ONBOARDING_DATA.cpfCnpj,
        incomeValue: 5000,
      }),
      expect.objectContaining({
        headers: { access_token: "$aact_master_sandbox_key" },
      }),
    );
    // Second call: POST /v3/webhooks using subconta's apiKey
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      2,
      "https://api-sandbox.asaas.com/v3/webhooks",
      expect.objectContaining({
        enabled: true,
        events: expect.arrayContaining(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]),
      }),
      expect.objectContaining({
        headers: { access_token: "$aact_sub_key" },
      }),
    );

    expect(docRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        asaasEnabled: true,
        asaas: expect.objectContaining({
          apiKey: "$aact_sub_key",
          subAccountId: "acc_sub123",
          walletId: "wlt_abc",
          environment: "sandbox",
        }),
      }),
    );
  });

  it("uses production master key when ASAAS_MASTER_API_KEY_PROD is set", async () => {
    process.env.ASAAS_MASTER_API_KEY_PROD = "$aact_master_prod_key";
    const { ref: docRef } = makeDocRef({ name: "Tenant Prod" });
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    mockedAxios.post = jest.fn().mockResolvedValue({
      data: { id: "acc_prod", apiKey: "$aact_prod_sub", walletId: "wlt_prod" },
    });

    await AsaasService.onboardTenant("tenant_prod", VALID_ONBOARDING_DATA);

    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      1,
      "https://api.asaas.com/v3/accounts",
      expect.any(Object),
      expect.objectContaining({
        headers: { access_token: "$aact_master_prod_key" },
      }),
    );
  });

  it("throws ASAAS_MASTER_KEY_NOT_CONFIGURED when env var is absent", async () => {
    delete process.env.ASAAS_MASTER_API_KEY;
    delete process.env.ASAAS_MASTER_API_KEY_PROD;
    const { ref: docRef } = makeDocRef({ name: "Tenant" });
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    await expect(
      AsaasService.onboardTenant("tenant1", VALID_ONBOARDING_DATA),
    ).rejects.toThrow("ASAAS_MASTER_KEY_NOT_CONFIGURED");

    expect(docRef.update).not.toHaveBeenCalled();
  });

  it("throws TENANT_NOT_FOUND when tenant document does not exist", async () => {
    const { ref: docRef } = makeDocRef(null, false);
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    await expect(
      AsaasService.onboardTenant("nonexistent", VALID_ONBOARDING_DATA),
    ).rejects.toThrow("TENANT_NOT_FOUND");

    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("throws ASAAS_SUBCONTA_CREATION_FAILED when POST /v3/accounts rejects", async () => {
    const { ref: docRef } = makeDocRef({ name: "Tenant" });
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    mockedAxios.post = jest.fn().mockRejectedValue(new Error("Network error"));

    await expect(
      AsaasService.onboardTenant("tenant1", VALID_ONBOARDING_DATA),
    ).rejects.toThrow("ASAAS_SUBCONTA_CREATION_FAILED");

    expect(docRef.update).not.toHaveBeenCalled();
  });

  it("omits companyType from request body when not provided", async () => {
    const { ref: docRef } = makeDocRef({ name: "Tenant" });
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    mockedAxios.post = jest.fn().mockResolvedValue({
      data: { id: "acc_1", apiKey: "$aact_key", walletId: "wlt_1" },
    });

    const dataWithoutType = { ...VALID_ONBOARDING_DATA, companyType: undefined };
    await AsaasService.onboardTenant("tenant1", dataWithoutType);

    const callBody = (mockedAxios.post as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect(callBody).not.toHaveProperty("companyType");
  });

  it("attempts to delete old webhook before creating new subconta (best-effort)", async () => {
    const existingAsaas = {
      apiKey: "$aact_old_key",
      subAccountId: "acc_old",
      webhookId: "wbk_old",
      environment: "sandbox",
      webhookUrl: "https://old.url",
      webhookAuthToken: "old_token",
      connectedAt: "2024-01-01T00:00:00.000Z",
    };
    const { ref: docRef } = makeDocRef({ asaas: existingAsaas });
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    mockedAxios.delete = jest.fn().mockResolvedValue({});
    mockedAxios.post = jest.fn().mockResolvedValue({
      data: { id: "acc_new", apiKey: "$aact_new_key", walletId: "wlt_new" },
    });

    await AsaasService.onboardTenant("tenant1", VALID_ONBOARDING_DATA);

    expect(mockedAxios.delete).toHaveBeenCalledWith(
      expect.stringContaining("wbk_old"),
      expect.objectContaining({ headers: { access_token: "$aact_old_key" } }),
    );
  });

  it("continues with subconta creation even when old webhook deletion fails", async () => {
    const existingAsaas = {
      apiKey: "$aact_old_key",
      webhookId: "wbk_old",
      environment: "sandbox",
      webhookUrl: "https://old.url",
      webhookAuthToken: "old_token",
      connectedAt: "2024-01-01T00:00:00.000Z",
    };
    const { ref: docRef } = makeDocRef({ asaas: existingAsaas });
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    mockedAxios.delete = jest.fn().mockRejectedValue(new Error("Delete failed"));
    mockedAxios.post = jest.fn().mockResolvedValue({
      data: { id: "acc_new", apiKey: "$aact_new", walletId: "wlt_new" },
    });

    await AsaasService.onboardTenant("tenant1", VALID_ONBOARDING_DATA);

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
        subAccountId: "acc_123",
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
    // Sensitive fields must NOT be exposed
    expect(status).not.toHaveProperty("apiKey");
    expect(status).not.toHaveProperty("webhookAuthToken");
    expect(status).not.toHaveProperty("subAccountId");
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
