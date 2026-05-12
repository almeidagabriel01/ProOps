import axios from "axios";
import crypto from "node:crypto";
import { db } from "../../init";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "../../lib/logger";
import { resolveAsaasWebhookUrl } from "../../lib/frontend-app-url";

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
}

export interface AsaasPublicStatus {
  connected: boolean;
  environment?: AsaasEnvironment;
  connectedAt?: string;
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

    // Attempt to delete old webhook if tenant was previously connected (best-effort)
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
      const axiosBody = axios.isAxiosError(err) ? err.response?.data : undefined;
      const axiosStatus = axios.isAxiosError(err) ? err.response?.status : undefined;
      logger.error("Asaas: falha ao criar subconta", {
        tenantId,
        environment,
        httpStatus: axiosStatus,
        asaasResponse: axiosBody,
        error: err instanceof Error ? err.message : String(err),
      });
      const e = new Error("ASAAS_SUBCONTA_CREATION_FAILED");
      Object.assign(e, { _asaasBody: axiosBody });
      throw e;
    }

    // Step 2: Configure webhook using subconta's apiKey (best-effort)
    let webhookId: string | undefined;
    let webhookUrl = resolveAsaasWebhookUrl(tenantId);
    try {
      const result = await this.configureWebhook(apiKey, environment, tenantId, webhookAuthToken);
      webhookId = result.webhookId;
      webhookUrl = result.webhookUrl;
    } catch (err) {
      logger.warn("Asaas: falha ao configurar webhook na subconta (best-effort)", {
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Step 3: Persist to Firestore
    const asaasData: TenantAsaasData = {
      apiKey,
      subAccountId,
      environment,
      connectedAt: new Date().toISOString(),
      webhookUrl,
      webhookAuthToken,
      ...(walletId ? { walletId } : {}),
      ...(webhookId ? { webhookId } : {}),
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
    };
  }
}
