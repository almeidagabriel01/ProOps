import axios from "axios";
import crypto from "node:crypto";
import { db } from "../../init";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "../../lib/logger";
import { resolveAsaasWebhookUrl } from "../../lib/frontend-app-url";

export type AsaasEnvironment = "sandbox" | "production";

export interface TenantAsaasData {
  apiKey: string;
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

export class AsaasService {
  static getBaseUrl(environment: AsaasEnvironment): string {
    return environment === "sandbox"
      ? "https://api-sandbox.asaas.com"
      : "https://api.asaas.com";
  }

  static async validateApiKey(
    apiKey: string,
    environment: AsaasEnvironment,
  ): Promise<{ walletId: string }> {
    const baseUrl = this.getBaseUrl(environment);
    const response = await axios.get<{ walletId?: string; id?: string }>(
      `${baseUrl}/v3/myAccount`,
      { headers: { access_token: apiKey } },
    );
    const walletId = response.data.walletId || response.data.id || "";
    return { walletId };
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

  static async connectTenant(
    tenantId: string,
    apiKey: string,
    environment: AsaasEnvironment,
  ): Promise<void> {
    const tenantRef = db.collection("tenants").doc(tenantId);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) throw new Error("TENANT_NOT_FOUND");

    // Validate key first
    let walletId = "";
    try {
      const result = await AsaasService.validateApiKey(apiKey, environment);
      walletId = result.walletId;
    } catch (err) {
      logger.error("Asaas: falha ao validar API key", {
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new Error("ASAAS_INVALID_API_KEY");
    }

    // Generate webhook auth token
    const webhookAuthToken = crypto.randomBytes(32).toString("hex");

    // If a previous webhookId exists, attempt to delete it (best-effort)
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

    // Configure webhook (best-effort — if fails, user can reconnect)
    let webhookId: string | undefined;
    let webhookUrl: string;
    try {
      const result = await AsaasService.configureWebhook(
        apiKey,
        environment,
        tenantId,
        webhookAuthToken,
      );
      webhookId = result.webhookId;
      webhookUrl = result.webhookUrl;
    } catch (err) {
      logger.warn("Asaas: falha ao configurar webhook (best-effort)", {
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
      webhookUrl = resolveAsaasWebhookUrl(tenantId);
    }

    const asaasData: TenantAsaasData = {
      apiKey,
      environment,
      walletId: walletId || undefined,
      connectedAt: new Date().toISOString(),
      webhookUrl,
      webhookAuthToken,
      webhookId,
    };

    await tenantRef.update({
      asaas: asaasData,
      asaasEnabled: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info("Asaas conectado ao tenant", { tenantId, environment, walletId });
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
