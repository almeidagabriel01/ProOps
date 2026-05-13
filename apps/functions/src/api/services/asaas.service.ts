import axios from "axios";
import crypto from "node:crypto";
import { db } from "../../init";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "../../lib/logger";
import { resolveAsaasWebhookUrl } from "../../lib/frontend-app-url";
import { describeAsaasError } from "./asaas-error";

export type AsaasEnvironment = "sandbox" | "production";

export interface AsaasOnboardingData {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone: string;
  incomeValue: number;
  companyType?: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  province: string;
}

export interface TenantAsaasData {
  apiKey: string;
  subAccountId?: string;
  environment: AsaasEnvironment;
  walletId?: string;
  connectedAt: string;
  webhookUrl: string;
  webhookAuthToken: string;
  webhookId?: string;
  webhookStatus?: {
    state: "registered" | "failed" | "pending";
    attemptedAt: string;
    lastError?: {
      httpStatus?: number;
      asaasErrors?: Array<{ code?: string; description?: string }>;
      message: string;
    };
  };
  accountStatus?: {
    general: "PENDING" | "AWAITING_APPROVAL" | "APPROVED" | "REJECTED";
    commercialInfo: string;
    bankAccountInfo: string;
    documentation: string;
    checkedAt: string;
    rejectReasons?: string | null;
    pendingDocuments?: Array<{ id: string; status: string }>;
    onboardingUrl?: string;
  };
  payout?: {
    enabled: boolean;
    pixAddressKey: string;
    pixAddressKeyType: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM_KEY";
    updatedAt: string;
  };
}

export interface AsaasPublicStatus {
  connected: boolean;
  environment?: AsaasEnvironment;
  connectedAt?: string;
  accountStatus?: TenantAsaasData["accountStatus"];
  webhookStatus?: TenantAsaasData["webhookStatus"];
  payout?: TenantAsaasData["payout"];
}

function getMasterApiKey(environment: AsaasEnvironment): string {
  if (environment === "production") {
    return String(process.env.ASAAS_MASTER_API_KEY_PROD || "").trim();
  }
  return String(process.env.ASAAS_MASTER_API_KEY || "").trim();
}

/**
 * Detects environment from which master key is configured.
 * Production key takes precedence; falls back to sandbox.
 */
export function resolveEnvironmentFromConfig(): AsaasEnvironment {
  const prodKey = String(process.env.ASAAS_MASTER_API_KEY_PROD || "").trim();
  return prodKey ? "production" : "sandbox";
}

export class AsaasService {
  static getBaseUrl(environment: AsaasEnvironment): string {
    return environment === "sandbox"
      ? "https://api-sandbox.asaas.com"
      : "https://api.asaas.com";
  }

  static async configureWebhook(
    apiKey: string,
    environment: AsaasEnvironment,
    tenantId: string,
    authToken: string,
  ): Promise<{ webhookId: string; webhookUrl: string }> {
    const baseUrl = this.getBaseUrl(environment);
    const webhookUrl = resolveAsaasWebhookUrl(tenantId);
    const projectId = process.env.GCLOUD_PROJECT || "erp-softcode";

    const response = await axios.post<{ id: string }>(
      `${baseUrl}/v3/webhooks`,
      {
        name: `ProOps - ${projectId}`,
        url: webhookUrl,
        email: "financeiro@proops.com.br",
        enabled: true,
        interrupted: false,
        apiVersion: 3,
        authToken,
        sendType: "SEQUENTIALLY",
        events: [
          "PAYMENT_RECEIVED",
          "PAYMENT_CONFIRMED",
          "PAYMENT_OVERDUE",
          "PAYMENT_DELETED",
        ],
      },
      { headers: { access_token: apiKey } },
    );
    return { webhookId: response.data.id, webhookUrl };
  }

  /**
   * Removes any existing webhooks pointing to this tenant's URL from the Asaas
   * subconta. Best-effort: failures are logged but do not abort the caller.
   */
  private static async reconcileExistingWebhooks(
    apiKey: string,
    environment: AsaasEnvironment,
    tenantId: string,
  ): Promise<void> {
    const baseUrl = this.getBaseUrl(environment);
    const expectedUrl = resolveAsaasWebhookUrl(tenantId);

    try {
      const response = await axios.get<{
        data: Array<{ id: string; url: string }>;
      }>(`${baseUrl}/v3/webhooks`, { headers: { access_token: apiKey } });

      const toDelete = (response.data?.data ?? []).filter((w) => w.url === expectedUrl);

      for (const webhook of toDelete) {
        try {
          await axios.delete(`${baseUrl}/v3/webhooks/${webhook.id}`, {
            headers: { access_token: apiKey },
          });
          logger.info("Asaas: webhook existente removido antes de recriar", {
            tenantId,
            webhookId: webhook.id,
          });
        } catch (deleteErr) {
          logger.warn("Asaas: falha ao remover webhook existente (best-effort)", {
            tenantId,
            webhookId: webhook.id,
            error: deleteErr instanceof Error ? deleteErr.message : String(deleteErr),
          });
        }
      }
    } catch (listErr) {
      logger.warn("Asaas: falha ao listar webhooks para reconciliação (best-effort)", {
        tenantId,
        error: listErr instanceof Error ? listErr.message : String(listErr),
      });
    }
  }

  /**
   * Registers (or re-registers) the Asaas payment webhook for a tenant.
   * Reconciles existing webhooks with the same URL first to ensure idempotency.
   * Persists the result (registered/failed) to Firestore and returns the status.
   *
   * When called directly (e.g. retry endpoint), reads asaas data from Firestore.
   * When called from onboardTenant, the freshly-written data is passed directly
   * to avoid an extra Firestore round-trip.
   *
   * Throws ASAAS_NOT_CONNECTED if no asaas data is available (uncaught, since
   * the caller must decide whether that is fatal). All Asaas API failures are
   * caught internally and persisted as state=failed — never re-thrown.
   */
  static async registerWebhookForTenant(
    tenantId: string,
    existingData?: TenantAsaasData,
  ): Promise<TenantAsaasData["webhookStatus"]> {
    const tenantRef = db.collection("tenants").doc(tenantId);
    const asaasData = existingData ?? await this.getAsaasData(tenantId);
    if (!asaasData) throw new Error("ASAAS_NOT_CONNECTED");

    const authToken = asaasData.webhookAuthToken || crypto.randomBytes(32).toString("hex");

    try {
      await this.reconcileExistingWebhooks(asaasData.apiKey, asaasData.environment, tenantId);

      const { webhookId, webhookUrl } = await this.configureWebhook(
        asaasData.apiKey,
        asaasData.environment,
        tenantId,
        authToken,
      );

      const webhookStatus: TenantAsaasData["webhookStatus"] = {
        state: "registered",
        attemptedAt: new Date().toISOString(),
      };

      await tenantRef.update({
        "asaas.webhookId": webhookId,
        "asaas.webhookUrl": webhookUrl,
        "asaas.webhookAuthToken": authToken,
        "asaas.webhookStatus": webhookStatus,
      });

      logger.info("Asaas: webhook registrado com sucesso", { tenantId, webhookId });

      return webhookStatus;
    } catch (err) {
      const desc = describeAsaasError(err);

      // Sanitize: if there is no httpStatus the error is a raw Node.js network
      // error (e.g. "connect ETIMEDOUT"). Replace the message with a generic
      // string so internal network details are never stored / returned to tenants.
      const safeDesc =
        desc.httpStatus === undefined
          ? { ...desc, message: "Falha de comunicação com o Asaas" }
          : desc;

      const webhookStatus: TenantAsaasData["webhookStatus"] = {
        state: "failed",
        attemptedAt: new Date().toISOString(),
        lastError: safeDesc,
      };

      await tenantRef.update({ "asaas.webhookStatus": webhookStatus });

      logger.error("Asaas: registro de webhook falhou", {
        tenantId,
        httpStatus: desc.httpStatus,
        asaasErrors: desc.asaasErrors,
        message: desc.message,
      });

      return webhookStatus;
    }
  }

  static async onboardTenant(
    tenantId: string,
    data: AsaasOnboardingData,
  ): Promise<void> {
    const environment = resolveEnvironmentFromConfig();
    const masterApiKey = getMasterApiKey(environment);
    if (!masterApiKey) {
      throw new Error("ASAAS_MASTER_KEY_NOT_CONFIGURED");
    }

    const tenantRef = db.collection("tenants").doc(tenantId);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) throw new Error("TENANT_NOT_FOUND");

    const webhookAuthToken = crypto.randomBytes(32).toString("hex");
    const baseUrl = this.getBaseUrl(environment);

    // Attempt to delete old webhook from the PREVIOUS subconta (best-effort cleanup)
    const existingData = (tenantSnap.data() as { asaas?: TenantAsaasData } | undefined)?.asaas;
    if (existingData?.webhookId && existingData.apiKey) {
      try {
        const oldBaseUrl = this.getBaseUrl(existingData.environment);
        await axios.delete(`${oldBaseUrl}/v3/webhooks/${existingData.webhookId}`, {
          headers: { access_token: existingData.apiKey },
        });
        logger.info("Asaas: webhook anterior removido", {
          tenantId,
          oldWebhookId: existingData.webhookId,
        });
      } catch (deleteErr) {
        logger.warn("Asaas: falha ao remover webhook anterior (best-effort)", {
          tenantId,
          error: deleteErr instanceof Error ? deleteErr.message : String(deleteErr),
        });
      }
    }

    // Step 1: Create subconta via master API key
    let subAccountId = "";
    let apiKey = "";
    let walletId = "";

    try {
      const response = await axios.post<{ id: string; apiKey: string; walletId?: string }>(
        `${baseUrl}/v3/accounts`,
        {
          name: data.name,
          email: data.email,
          cpfCnpj: data.cpfCnpj,
          mobilePhone: data.mobilePhone,
          incomeValue: data.incomeValue,
          ...(data.companyType ? { companyType: data.companyType } : {}),
          postalCode: data.postalCode,
          address: data.address,
          addressNumber: data.addressNumber,
          province: data.province,
        },
        { headers: { access_token: masterApiKey } },
      );
      subAccountId = response.data.id;
      apiKey = response.data.apiKey;
      walletId = response.data.walletId || "";
    } catch (err) {
      const desc = describeAsaasError(err);

      // Check if Asaas rejected because the subconta already exists
      // Asaas returns different messages for duplicate CNPJ vs duplicate email:
      // - CNPJ conflict: description contains "já existe" / "already exists"
      // - Email conflict: description contains "já está em uso" / "em uso"
      // Both are recovered the same way: look up the existing subconta by CNPJ.
      const isAlreadyExists =
        desc.asaasErrors?.some(
          (e) =>
            e.code?.toLowerCase().includes("alread") ||
            e.description?.toLowerCase().includes("já existe") ||
            e.description?.toLowerCase().includes("already") ||
            e.description?.toLowerCase().includes("em uso"),
        ) ??
        desc.message.toLowerCase().includes("em uso") ??
        false;

      if (isAlreadyExists) {
        // Attempt to recover: look up the existing subconta by cpfCnpj
        try {
          const cpfCnpjDigits = data.cpfCnpj.replace(/\D/g, "");
          const listResp = await axios.get<{
            data: Array<{ id: string; apiKey: string; walletId?: string }>;
          }>(`${baseUrl}/v3/accounts?cpfCnpj=${cpfCnpjDigits}`, {
            headers: { access_token: masterApiKey },
          });

          const found = listResp.data?.data?.[0];
          if (found?.id && found?.apiKey) {
            // Security check: block if another tenant in Firestore already owns this subconta
            const conflictSnap = await db
              .collection("tenants")
              .where("asaas.subAccountId", "==", found.id)
              .limit(1)
              .get();

            if (!conflictSnap.empty && conflictSnap.docs[0].id !== tenantId) {
              const e = new Error("ASAAS_ACCOUNT_IN_USE_BY_ANOTHER_TENANT");
              throw e;
            }

            // No conflict — reuse the existing subconta
            subAccountId = found.id;
            apiKey = found.apiKey;
            walletId = found.walletId || "";
            logger.info("Asaas: subconta já existia, reutilizando", { tenantId, subAccountId });
            // Fall through to Step 2 (persist + register webhook)
          } else {
            // Couldn't find it — fail normally
            logger.error("Asaas: subconta existente mas não encontrada na listagem", { tenantId });
            const e = new Error("ASAAS_SUBCONTA_CREATION_FAILED");
            Object.assign(e, { _asaasBody: desc });
            throw e;
          }
        } catch (recoveryErr) {
          // If it's one of our own errors, re-throw; otherwise log and fail normally
          if (
            recoveryErr instanceof Error &&
            (recoveryErr.message === "ASAAS_ACCOUNT_IN_USE_BY_ANOTHER_TENANT" ||
              recoveryErr.message === "ASAAS_SUBCONTA_CREATION_FAILED")
          ) {
            throw recoveryErr;
          }
          const recoveryDesc = describeAsaasError(recoveryErr);
          logger.error("Asaas: falha na recuperação de subconta existente", {
            tenantId,
            httpStatus: recoveryDesc.httpStatus,
            message: recoveryDesc.message,
          });
          const e = new Error("ASAAS_SUBCONTA_CREATION_FAILED");
          Object.assign(e, { _asaasBody: desc });
          throw e;
        }
      } else {
        // Not an "already exists" error — fail normally
        logger.error("Asaas: falha ao criar subconta", {
          tenantId,
          environment,
          httpStatus: desc.httpStatus,
          asaasErrors: desc.asaasErrors,
          message: desc.message,
        });
        const e = new Error("ASAAS_SUBCONTA_CREATION_FAILED");
        Object.assign(e, { _asaasBody: desc });
        throw e;
      }
    }

    // Step 2: Persist connected state with webhook in "pending" state
    const webhookUrl = resolveAsaasWebhookUrl(tenantId);
    const asaasData: TenantAsaasData = {
      apiKey,
      subAccountId,
      environment,
      connectedAt: new Date().toISOString(),
      webhookUrl,
      webhookAuthToken,
      webhookStatus: { state: "pending", attemptedAt: new Date().toISOString() },
      ...(walletId ? { walletId } : {}),
    };

    await tenantRef.update({
      asaas: asaasData,
      asaasEnabled: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info("Asaas subconta criada para tenant", {
      tenantId,
      environment,
      subAccountId,
    });

    // Step 3: Register webhook — pass the just-written data to avoid an extra Firestore read.
    // Non-blocking: failures are stored as webhookStatus.state = "failed", never thrown.
    try {
      await this.registerWebhookForTenant(tenantId, asaasData);
    } catch (err) {
      logger.warn("Asaas: webhook registration was skipped or threw unexpectedly", {
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  static async disconnectTenant(tenantId: string): Promise<void> {
    const tenantRef = db.collection("tenants").doc(tenantId);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) throw new Error("TENANT_NOT_FOUND");

    await tenantRef.update({
      asaas: FieldValue.delete(),
      asaasEnabled: false,
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info("Asaas desconectado do tenant", { tenantId });
  }

  static async getAsaasData(tenantId: string): Promise<TenantAsaasData | null> {
    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    if (!tenantSnap.exists) return null;
    const data = tenantSnap.data() as { asaas?: TenantAsaasData } | undefined;
    return data?.asaas ?? null;
  }

  static async getPublicStatus(tenantId: string): Promise<AsaasPublicStatus> {
    const asaasData = await this.getAsaasData(tenantId);
    if (!asaasData) return { connected: false };
    return {
      connected: true,
      environment: asaasData.environment,
      connectedAt: asaasData.connectedAt,
      ...(asaasData.accountStatus ? { accountStatus: asaasData.accountStatus } : {}),
      ...(asaasData.webhookStatus ? { webhookStatus: asaasData.webhookStatus } : {}),
      ...(asaasData.payout ? { payout: asaasData.payout } : {}),
    };
  }

  /**
   * Refreshes the Asaas subconta approval status by querying the Asaas API.
   * Persists the result to Firestore and returns the accountStatus object.
   * Non-fatal: returns null if any API call fails.
   */
  static async refreshAccountStatus(
    tenantId: string,
  ): Promise<TenantAsaasData["accountStatus"] | null> {
    try {
      const tenantRef = db.collection("tenants").doc(tenantId);
      const tenantSnap = await tenantRef.get();
      if (!tenantSnap.exists) return null;

      const tenantData = tenantSnap.data() as { asaas?: TenantAsaasData } | undefined;
      const asaasData = tenantData?.asaas;
      if (!asaasData?.apiKey) return null;

      const { apiKey, environment, subAccountId } = asaasData;
      const baseUrl = this.getBaseUrl(environment);
      const masterApiKey = getMasterApiKey(environment);

      // Fetch subconta status using the subconta's own apiKey
      const statusResp = await axios.get<{
        id: string;
        commercialInfo: string;
        bankAccountInfo: string;
        documentation: string;
        general: "PENDING" | "AWAITING_APPROVAL" | "APPROVED" | "REJECTED";
      }>(`${baseUrl}/v3/myAccount/status`, {
        headers: { access_token: apiKey },
      });

      const { commercialInfo, bankAccountInfo, documentation, general } = statusResp.data;

      // Fetch onboarding URL and pending documents using master key (best-effort)
      let onboardingUrl: string | undefined;
      let pendingDocuments: Array<{ id: string; status: string }> | undefined;

      if (subAccountId && masterApiKey) {
        try {
          const docsResp = await axios.get<{
            onboardingUrl?: string;
            documents?: Array<{ id: string; status: string }>;
          }>(`${baseUrl}/v3/accounts/${subAccountId}/documents`, {
            headers: { access_token: masterApiKey },
          });
          onboardingUrl = docsResp.data.onboardingUrl;
          pendingDocuments = docsResp.data.documents;
        } catch (docsErr) {
          logger.warn("Asaas: failed to fetch subconta documents (best-effort)", {
            tenantId,
            subAccountId,
            error: docsErr instanceof Error ? docsErr.message : String(docsErr),
          });
        }
      } else if (!subAccountId) {
        logger.warn("Asaas: subAccountId missing, skipping documents fetch", { tenantId });
      }

      const accountStatus: TenantAsaasData["accountStatus"] = {
        general,
        commercialInfo,
        bankAccountInfo,
        documentation,
        checkedAt: new Date().toISOString(),
        ...(onboardingUrl !== undefined ? { onboardingUrl } : {}),
        ...(pendingDocuments !== undefined ? { pendingDocuments } : {}),
      };

      await tenantRef.update({ "asaas.accountStatus": accountStatus });

      logger.info("Asaas: account status refreshed", { tenantId, general });

      return accountStatus;
    } catch (err) {
      logger.error("Asaas: failed to refresh account status", {
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}
