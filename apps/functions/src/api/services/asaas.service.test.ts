/**
 * Unit tests for AsaasService (subconta model)
 * Mocks: axios, ../../init (db), ../../lib/logger, ../../lib/frontend-app-url, ./asaas-error
 */

jest.mock("axios");
// Mock describeAsaasError with duck-typed structural extraction so service tests
// are decoupled from axios.isAxiosError (which jest.mock("axios") auto-mocks away).
jest.mock("./asaas-error", () => ({
  describeAsaasError: jest.fn().mockImplementation((err: unknown) => {
    if (err && typeof err === "object" && "response" in err) {
      const e = err as {
        response?: {
          status?: number;
          data?: { errors?: Array<{ code?: string; description?: string }>; message?: string };
        };
        message?: string;
      };
      const asaasErrors = Array.isArray(e.response?.data?.errors) && e.response!.data!.errors!.length
        ? e.response!.data!.errors
        : undefined;
      return {
        httpStatus: e.response?.status,
        ...(asaasErrors ? { asaasErrors } : {}),
        message: asaasErrors?.[0]?.description ?? e.response?.data?.message ?? e.message ?? "Error",
      };
    }
    return { message: err instanceof Error ? (err as Error).message : String(err) };
  }),
}));
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

    // Reconcile step: GET /v3/webhooks returns empty list
    mockedAxios.get = jest.fn().mockResolvedValue({ data: { data: [] } });
    mockedAxios.post = jest.fn().mockResolvedValue({
      data: { id: "acc_sub123", apiKey: "$aact_sub_key", walletId: "wlt_abc" },
    });

    await AsaasService.onboardTenant("tenant1", VALID_ONBOARDING_DATA);

    // First call: POST /v3/accounts
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

    // First update: persists subconta + pending webhookStatus
    expect(docRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        asaasEnabled: true,
        asaas: expect.objectContaining({
          apiKey: "$aact_sub_key",
          subAccountId: "acc_sub123",
          walletId: "wlt_abc",
          environment: "sandbox",
          webhookStatus: expect.objectContaining({ state: "pending" }),
        }),
      }),
    );
  });

  it("uses production master key when ASAAS_MASTER_API_KEY_PROD is set", async () => {
    process.env.ASAAS_MASTER_API_KEY_PROD = "$aact_master_prod_key";
    const { ref: docRef } = makeDocRef({ name: "Tenant Prod" });
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    mockedAxios.get = jest.fn().mockResolvedValue({ data: { data: [] } });
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

    mockedAxios.get = jest.fn().mockResolvedValue({ data: { data: [] } });
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

    // Reconcile step on new subconta
    mockedAxios.get = jest.fn().mockResolvedValue({ data: { data: [] } });
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

    mockedAxios.get = jest.fn().mockResolvedValue({ data: { data: [] } });
    mockedAxios.delete = jest.fn().mockRejectedValue(new Error("Delete failed"));
    mockedAxios.post = jest.fn().mockResolvedValue({
      data: { id: "acc_new", apiKey: "$aact_new", walletId: "wlt_new" },
    });

    await AsaasService.onboardTenant("tenant1", VALID_ONBOARDING_DATA);

    expect(docRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ asaasEnabled: true }),
    );
  });

  it("reuses existing subconta when Asaas rejects with 'already exists' and no conflict", async () => {
    const { ref: docRef } = makeDocRef({ name: "Tenant" });

    // Simulate the conflict-check query returning no docs (no other tenant owns this subconta)
    const conflictQuery = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
    };

    (mockedDb.collection as jest.Mock).mockImplementation((col: string) => {
      if (col === "tenants") {
        return {
          doc: jest.fn().mockReturnValue(docRef),
          where: conflictQuery.where,
          limit: conflictQuery.limit,
          get: conflictQuery.get,
        };
      }
      return makeCollection(docRef);
    });

    // POST /v3/accounts → conflict; POST accessTokens → returns apiKey directly; POST webhook
    mockedAxios.post = jest.fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("Asaas error"), {
          response: {
            status: 400,
            data: { errors: [{ code: "invalid.cpfCnpj.alreadyExists", description: "já existe" }] },
          },
        }),
      )
      .mockResolvedValueOnce({ data: { id: "tk_reuse_123", apiKey: "$aact_recovered_key", enabled: true } }) // accessTokens POST
      .mockResolvedValueOnce({ data: { id: "wh-reuse" } }); // webhook registration

    // GET /v3/accounts?cpfCnpj=... returns existing subconta (no apiKey — matches real Asaas API)
    mockedAxios.get = jest.fn()
      .mockResolvedValueOnce({
        data: { data: [{ id: "acc_existing", walletId: "wlt_existing" }] },
      })
      .mockResolvedValueOnce({ data: { data: [] } }); // reconcile webhooks

    await AsaasService.onboardTenant("tenant1", VALID_ONBOARDING_DATA);

    expect(docRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        asaasEnabled: true,
        asaas: expect.objectContaining({
          apiKey: "$aact_recovered_key",
          subAccountId: "acc_existing",
          walletId: "wlt_existing",
        }),
      }),
    );
  });

  it("throws ASAAS_ACCOUNT_IN_USE_BY_ANOTHER_TENANT when existing subconta belongs to a different tenant", async () => {
    const { ref: docRef } = makeDocRef({ name: "Tenant" });

    // Conflict query returns a doc owned by a DIFFERENT tenant
    const conflictQuery = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        empty: false,
        docs: [{ id: "other_tenant_id" }],
      }),
    };

    (mockedDb.collection as jest.Mock).mockImplementation((col: string) => {
      if (col === "tenants") {
        return {
          doc: jest.fn().mockReturnValue(docRef),
          where: conflictQuery.where,
          limit: conflictQuery.limit,
          get: conflictQuery.get,
        };
      }
      return makeCollection(docRef);
    });

    // POST /v3/accounts returns "already exists"
    mockedAxios.post = jest.fn().mockRejectedValueOnce(
      Object.assign(new Error("Asaas error"), {
        response: {
          status: 400,
          data: { errors: [{ code: "invalid.cpfCnpj.alreadyExists", description: "já existe" }] },
        },
      }),
    );

    // GET /v3/accounts?cpfCnpj=... returns the existing subconta (no apiKey — matches real Asaas API)
    mockedAxios.get = jest.fn().mockResolvedValueOnce({
      data: { data: [{ id: "acc_existing" }] },
    });

    await expect(
      AsaasService.onboardTenant("tenant1", VALID_ONBOARDING_DATA),
    ).rejects.toThrow("ASAAS_ACCOUNT_IN_USE_BY_ANOTHER_TENANT");

    expect(docRef.update).not.toHaveBeenCalled();
  });

  it("throws ASAAS_SUBCONTA_NOT_RECOVERABLE when already-exists but CNPJ and email lookups return empty", async () => {
    const { ref: docRef } = makeDocRef({ name: "Tenant" });
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    // POST /v3/accounts returns "already exists"
    mockedAxios.post = jest.fn().mockRejectedValueOnce(
      Object.assign(new Error("Asaas error"), {
        response: {
          status: 400,
          data: { errors: [{ code: "invalid.cpfCnpj.alreadyExists", description: "já existe" }] },
        },
      }),
    );

    // Both CNPJ and email lookups return empty — subconta cannot be recovered
    mockedAxios.get = jest.fn()
      .mockResolvedValueOnce({ data: { data: [] } }) // cpfCnpj lookup
      .mockResolvedValueOnce({ data: { data: [] } }); // email lookup

    await expect(
      AsaasService.onboardTenant("tenant1", VALID_ONBOARDING_DATA),
    ).rejects.toThrow("ASAAS_SUBCONTA_NOT_RECOVERABLE");

    expect(docRef.update).not.toHaveBeenCalled();
  });

  it("reuses existing subconta when Asaas rejects with 'email em uso' (email already in use)", async () => {
    const { ref: docRef } = makeDocRef({ name: "Tenant" });

    const conflictQuery = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
    };

    (mockedDb.collection as jest.Mock).mockImplementation((col: string) => {
      if (col === "tenants") {
        return {
          doc: jest.fn().mockReturnValue(docRef),
          where: conflictQuery.where,
          limit: conflictQuery.limit,
          get: conflictQuery.get,
        };
      }
      return makeCollection(docRef);
    });

    // POST /v3/accounts → email conflict; POST accessTokens → returns apiKey directly; POST webhook
    mockedAxios.post = jest.fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("Asaas error"), {
          response: {
            status: 400,
            data: { errors: [{ code: "invalid.email.alreadyInUse", description: "O email test@example.com já está em uso." }] },
          },
        }),
      )
      .mockResolvedValueOnce({ data: { id: "tk_email_123", apiKey: "$aact_email_recovered", enabled: true } }) // accessTokens POST
      .mockResolvedValueOnce({ data: { id: "wh-email-reuse" } }); // webhook

    // GET by CNPJ finds the subconta (no apiKey — matches real Asaas API)
    mockedAxios.get = jest.fn()
      .mockResolvedValueOnce({
        data: { data: [{ id: "acc_email_existing", walletId: "wlt_email" }] },
      })
      .mockResolvedValueOnce({ data: { data: [] } }); // reconcile webhooks

    await AsaasService.onboardTenant("tenant1", VALID_ONBOARDING_DATA);

    expect(docRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        asaasEnabled: true,
        asaas: expect.objectContaining({
          apiKey: "$aact_email_recovered",
          subAccountId: "acc_email_existing",
          walletId: "wlt_email",
        }),
      }),
    );
  });

  it("recovers subconta via email fallback when CNPJ lookup returns empty", async () => {
    const { ref: docRef } = makeDocRef({ name: "Tenant" });

    const conflictQuery = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
    };

    (mockedDb.collection as jest.Mock).mockImplementation((col: string) => {
      if (col === "tenants") {
        return {
          doc: jest.fn().mockReturnValue(docRef),
          where: conflictQuery.where,
          limit: conflictQuery.limit,
          get: conflictQuery.get,
        };
      }
      return makeCollection(docRef);
    });

    // POST /v3/accounts → conflict; POST accessTokens → returns apiKey directly; POST webhook
    mockedAxios.post = jest.fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("Asaas error"), {
          response: {
            status: 400,
            data: { errors: [{ code: "invalid.cpfCnpj.alreadyExists", description: "já existe" }] },
          },
        }),
      )
      .mockResolvedValueOnce({ data: { id: "tk_fallback_123", apiKey: "$aact_email_fallback_key", enabled: true } }) // accessTokens POST
      .mockResolvedValueOnce({ data: { id: "wh-fallback" } }); // webhook

    // GET by CNPJ → empty; GET by email → found subconta
    mockedAxios.get = jest.fn()
      .mockResolvedValueOnce({ data: { data: [] } }) // cpfCnpj lookup → empty
      .mockResolvedValueOnce({
        data: { data: [{ id: "acc_email_fallback", walletId: "wlt_fallback" }] },
      }) // email lookup → found
      .mockResolvedValueOnce({ data: { data: [] } }); // reconcile webhooks

    await AsaasService.onboardTenant("tenant1", VALID_ONBOARDING_DATA);

    expect(docRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        asaasEnabled: true,
        asaas: expect.objectContaining({
          apiKey: "$aact_email_fallback_key",
          subAccountId: "acc_email_fallback",
          walletId: "wlt_fallback",
        }),
      }),
    );
  });

  it("throws ASAAS_APIKEY_GENERATION_FAILED when accessTokens endpoint returns no token", async () => {
    const { ref: docRef } = makeDocRef({ name: "Tenant" });

    const conflictQuery = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
    };

    (mockedDb.collection as jest.Mock).mockImplementation((col: string) => {
      if (col === "tenants") {
        return {
          doc: jest.fn().mockReturnValue(docRef),
          where: conflictQuery.where,
          limit: conflictQuery.limit,
          get: conflictQuery.get,
        };
      }
      return makeCollection(docRef);
    });

    // POST /v3/accounts → conflict; POST accessTokens → returns 200 but NO token field
    mockedAxios.post = jest.fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("Asaas error"), {
          response: {
            status: 400,
            data: { errors: [{ code: "invalid.cpfCnpj.alreadyExists", description: "já existe" }] },
          },
        }),
      )
      .mockResolvedValueOnce({ data: { status: "success" } }); // accessTokens — no token field

    mockedAxios.get = jest.fn().mockResolvedValueOnce({
      data: { data: [{ id: "acc_existing" }] },
    });

    await expect(
      AsaasService.onboardTenant("tenant1", VALID_ONBOARDING_DATA),
    ).rejects.toThrow("ASAAS_APIKEY_GENERATION_FAILED");

    expect(docRef.update).not.toHaveBeenCalled();
  });

  it("throws ASAAS_SUBCONTA_CREATION_FAILED on non-already-exists Asaas error (no regression)", async () => {
    const { ref: docRef } = makeDocRef({ name: "Tenant" });
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    // POST /v3/accounts returns a generic Asaas error (not "already exists")
    mockedAxios.post = jest.fn().mockRejectedValueOnce(
      Object.assign(new Error("Asaas error"), {
        response: {
          status: 400,
          data: { errors: [{ code: "invalid.email", description: "E-mail inválido" }] },
        },
      }),
    );

    await expect(
      AsaasService.onboardTenant("tenant1", VALID_ONBOARDING_DATA),
    ).rejects.toThrow("ASAAS_SUBCONTA_CREATION_FAILED");

    // Must NOT call GET /v3/accounts (no recovery attempt)
    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(docRef.update).not.toHaveBeenCalled();
  });

  it("persists subconta even when webhook registration fails — state=failed saved", async () => {
    const { ref: docRef } = makeDocRef({ name: "Tenant" });
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    // Reconcile GET succeeds with empty list, but webhook POST fails
    mockedAxios.get = jest.fn().mockResolvedValue({ data: { data: [] } });
    mockedAxios.post = jest.fn()
      .mockResolvedValueOnce({ data: { id: "acc-456", apiKey: "new-key", walletId: "wlt" } })
      .mockRejectedValueOnce(new Error("Webhook endpoint unavailable"));

    await expect(
      AsaasService.onboardTenant("tenant1", VALID_ONBOARDING_DATA),
    ).resolves.not.toThrow();

    // Subconta update happened
    expect(docRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        asaas: expect.objectContaining({ subAccountId: "acc-456" }),
      }),
    );
    // Webhook failure update happened (state=failed)
    expect(docRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        "asaas.webhookStatus": expect.objectContaining({ state: "failed" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: registerWebhookForTenant
// ---------------------------------------------------------------------------

describe("AsaasService.registerWebhookForTenant", () => {
  const ASAAS_DATA = {
    apiKey: "$aact_sub_key",
    subAccountId: "sub-123",
    environment: "sandbox" as const,
    connectedAt: "2025-01-01T00:00:00.000Z",
    webhookUrl: "https://example.com/webhooks/asaas/t1",
    webhookAuthToken: "auth-token-abc",
  };

  beforeEach(() => {
    // Default: reconcile returns empty list
    mockedAxios.get = jest.fn().mockResolvedValue({ data: { data: [] } });
  });

  it("registers webhook and persists state=registered + webhookId", async () => {
    const { ref: docRef } = makeDocRef({ asaas: ASAAS_DATA });
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    mockedAxios.post = jest.fn().mockResolvedValue({ data: { id: "wh-999" } });

    const result = await AsaasService.registerWebhookForTenant("t1");

    expect(result?.state).toBe("registered");
    expect(result?.lastError).toBeUndefined();
    expect(docRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        "asaas.webhookId": "wh-999",
        "asaas.webhookStatus": expect.objectContaining({ state: "registered" }),
      }),
    );
  });

  it("accepts existingData and skips the Firestore read", async () => {
    const { ref: docRef } = makeDocRef(null, false);
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    mockedAxios.post = jest.fn().mockResolvedValue({ data: { id: "wh-100" } });

    // Passes existingData — should not call docRef.get
    const result = await AsaasService.registerWebhookForTenant("t1", ASAAS_DATA);

    expect(result?.state).toBe("registered");
    expect(docRef.get).not.toHaveBeenCalled();
  });

  it("captures state=failed + lastError when Asaas returns 400 with errors array", async () => {
    const { ref: docRef } = makeDocRef({ asaas: ASAAS_DATA });
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    mockedAxios.post = jest.fn().mockRejectedValue(new Error("Asaas rejected"));

    // Control describeAsaasError's output directly — extraction logic is covered by asaas-error.test.ts.
    const { describeAsaasError } = require("./asaas-error") as { describeAsaasError: jest.Mock };
    describeAsaasError.mockReturnValueOnce({
      httpStatus: 400,
      asaasErrors: [{ code: "invalid.url", description: "URL inválida para webhook" }],
      message: "URL inválida para webhook",
    });

    const result = await AsaasService.registerWebhookForTenant("t1");

    expect(result?.state).toBe("failed");
    expect(result?.lastError?.httpStatus).toBe(400);
    expect(result?.lastError?.asaasErrors?.[0]?.description).toBe("URL inválida para webhook");
    expect(docRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        "asaas.webhookStatus": expect.objectContaining({ state: "failed" }),
      }),
    );
  });

  it("reconciles (deletes) existing webhook with matching URL before creating", async () => {
    const { ref: docRef } = makeDocRef({ asaas: ASAAS_DATA });
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    const expectedUrl = `https://southamerica-east1-erp-softcode.cloudfunctions.net/api/webhooks/asaas/t1`;
    mockedAxios.get = jest.fn().mockResolvedValue({
      data: { data: [{ id: "old-wh", url: expectedUrl }] },
    });
    mockedAxios.delete = jest.fn().mockResolvedValue({});
    mockedAxios.post = jest.fn().mockResolvedValue({ data: { id: "new-wh" } });

    const result = await AsaasService.registerWebhookForTenant("t1");

    expect(mockedAxios.delete).toHaveBeenCalledWith(
      expect.stringContaining("old-wh"),
      expect.anything(),
    );
    expect(result?.state).toBe("registered");
    expect(docRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ "asaas.webhookId": "new-wh" }),
    );
  });

  it("does NOT delete webhooks with a different URL (different tenant)", async () => {
    const { ref: docRef } = makeDocRef({ asaas: ASAAS_DATA });
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    mockedAxios.get = jest.fn().mockResolvedValue({
      data: { data: [{ id: "other-tenant-wh", url: "https://example.com/other-tenant" }] },
    });
    mockedAxios.delete = jest.fn().mockResolvedValue({});
    mockedAxios.post = jest.fn().mockResolvedValue({ data: { id: "new-wh" } });

    await AsaasService.registerWebhookForTenant("t1");

    expect(mockedAxios.delete).not.toHaveBeenCalled();
  });

  it("throws ASAAS_NOT_CONNECTED when no data in Firestore and no existingData passed", async () => {
    const { ref: docRef } = makeDocRef(null, false);
    (mockedDb.collection as jest.Mock).mockReturnValue(makeCollection(docRef));

    await expect(AsaasService.registerWebhookForTenant("t1")).rejects.toThrow(
      "ASAAS_NOT_CONNECTED",
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
