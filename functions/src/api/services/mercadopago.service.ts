import axios from "axios";
import crypto from "crypto";
import { db } from "../../init";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { logger } from "../../lib/logger";
import {
  exchangeCodeForTokens,
  refreshAccessToken,
  revokeToken,
  type MercadoPagoEnvironment,
} from "../../lib/mercadopago-client";

/** Dados do Mercado Pago armazenados no documento do tenant. */
export interface TenantMercadoPagoData {
  userId: string;
  accessToken: string;
  refreshToken: string;
  publicKey: string;
  expiresAt: string; // ISO
  scope: string;
  connectedAt: string; // ISO
  liveMode: boolean;
  environment: MercadoPagoEnvironment;
}

/** Dados seguros para expor ao frontend (sem tokens). */
export interface MercadoPagoPublicStatus {
  connected: boolean;
  userId?: string;
  connectedAt?: string;
  liveMode?: boolean;
  environment?: MercadoPagoEnvironment;
}

export interface TenantMpPublicConfig {
  publicKey: string;
  environment: MercadoPagoEnvironment;
  sellerTestEmail?: string;
}

const REFRESH_AHEAD_SECONDS = 10 * 60; // 10 minutos

function isTokenExpiringSoon(expiresAt: string): boolean {
  const expiresAtMs = new Date(expiresAt).getTime();
  return Date.now() >= expiresAtMs - REFRESH_AHEAD_SECONDS * 1000;
}


export class MercadoPagoService {
  /**
   * Conecta um tenant ao Mercado Pago via OAuth.
   * Salva os tokens em tenants/{tenantId}.mercadoPago e ativa mercadoPagoEnabled.
   */
  static async connectTenant(
    tenantId: string,
    code: string,
  ): Promise<{ alreadyConnected: boolean }> {
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    const lockRef = db
      .collection("tenants")
      .doc(tenantId)
      .collection("mpOAuthCodes")
      .doc(codeHash);

    let isAlreadyConnected = false;

    // Atomic lock: prevents the same one-time code from reaching MP twice.
    // pending   → another request is mid-flight → 409
    // completed → idempotent success → return early
    // failed    → MP code already consumed (retry unsafe) → 409
    // absent    → first attempt → create lock and proceed
    await db.runTransaction(async (txn) => {
      const lockSnap = await txn.get(lockRef);
      if (lockSnap.exists) {
        const lockData = lockSnap.data()!;
        if (lockData.status === "completed") {
          isAlreadyConnected = true;
          return;
        }
        // Both "pending" and "failed" block the same code from being reused.
        // "failed" does NOT retry: the MP code may already be consumed. The caller
        // must start a new OAuth flow to get a fresh code.
        throw new Error("MP_CODE_ALREADY_PROCESSED");
      }
      txn.create(lockRef, {
        tenantId,
        status: "pending",
        createdAt: Timestamp.now(),
        expireAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
      });
    });

    if (isAlreadyConnected) {
      logger.info("MercadoPago: código já processado, retornando sucesso idempotente", {
        tenantId,
      });
      return { alreadyConnected: true };
    }

    let tokens;
    try {
      tokens = await exchangeCodeForTokens(code);
    } catch (err) {
      await lockRef
        .update({
          status: "failed",
          failureReason: err instanceof Error ? err.message : String(err),
        })
        .catch(() => {});
      throw err;
    }

    const tenantRef = db.collection("tenants").doc(tenantId);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) {
      await lockRef
        .update({ status: "failed", failureReason: "TENANT_NOT_FOUND" })
        .catch(() => {});
      throw new Error("TENANT_NOT_FOUND");
    }

    const mpData: TenantMercadoPagoData = {
      userId: tokens.userId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      publicKey: tokens.publicKey,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
      connectedAt: new Date().toISOString(),
      liveMode: tokens.liveMode,
      environment: tokens.environment,
    };

    try {
      await tenantRef.update({
        mercadoPago: mpData,
        mercadoPagoEnabled: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      await lockRef
        .update({
          status: "failed",
          failureReason: err instanceof Error ? err.message : String(err),
        })
        .catch(() => {});
      throw err;
    }

    await lockRef
      .update({ status: "completed", completedAt: Timestamp.now() })
      .catch(() => {});

    logger.info("MercadoPago conectado ao tenant", {
      tenantId,
      userId: tokens.userId,
    });

    return { alreadyConnected: false };
  }

  /**
   * Desconecta o tenant do Mercado Pago.
   * Revoga o token (best-effort) e remove os dados do Firestore.
   */
  static async disconnectTenant(tenantId: string): Promise<void> {
    const tenantRef = db.collection("tenants").doc(tenantId);
    const tenantSnap = await tenantRef.get();

    if (!tenantSnap.exists) {
      throw new Error("TENANT_NOT_FOUND");
    }

    const tenantData = tenantSnap.data() as
      | { mercadoPago?: TenantMercadoPagoData }
      | undefined;

    const accessToken = tenantData?.mercadoPago?.accessToken;

    if (accessToken) {
      try {
        await revokeToken(accessToken);
      } catch (err) {
        // Best-effort: falha na revogação não impede a desconexão local
        logger.error("Falha ao revogar token do MercadoPago (best-effort)", {
          tenantId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await tenantRef.update({
      mercadoPago: FieldValue.delete(),
      mercadoPagoEnabled: false,
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info("MercadoPago desconectado do tenant", { tenantId });
  }

  /**
   * Retorna os dados de MP do tenant, realizando refresh automático se necessário.
   * Retorna null se o tenant não estiver conectado.
   * NUNCA expõe tokens ao chamador externo — use getPublicStatus para o frontend.
   */
  static async getMercadoPagoData(
    tenantId: string,
  ): Promise<TenantMercadoPagoData | null> {
    const tenantRef = db.collection("tenants").doc(tenantId);
    const tenantSnap = await tenantRef.get();

    if (!tenantSnap.exists) {
      return null;
    }

    const tenantData = tenantSnap.data() as
      | { mercadoPago?: TenantMercadoPagoData }
      | undefined;

    const mpData = tenantData?.mercadoPago;
    if (!mpData) {
      return null;
    }

    if (isTokenExpiringSoon(mpData.expiresAt)) {
      try {
        const refreshed = await refreshAccessToken(mpData.refreshToken);
        const updated: TenantMercadoPagoData = {
          ...mpData,
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          publicKey: refreshed.publicKey,
          expiresAt: refreshed.expiresAt,
          // liveMode e environment deliberadamente preservados do connect original
        };

        if (refreshed.environment !== mpData.environment) {
          logger.warn("MP environment drift detected on token refresh (keeping pinned value)", {
            tenantId,
            pinned: mpData.environment,
            reportedByMp: refreshed.environment,
            userId: mpData.userId,
          });
        }

        await tenantRef.update({
          mercadoPago: updated,
          updatedAt: FieldValue.serverTimestamp(),
        });

        logger.info("Token MercadoPago renovado com sucesso", { tenantId });
        return updated;
      } catch (err) {
        logger.error("Falha ao renovar token do MercadoPago", {
          tenantId,
          error: err instanceof Error ? err.message : String(err),
        });
        // Retorna os dados existentes mesmo com token potencialmente expirado;
        // a operação de pagamento falhará com erro claro do gateway.
        return mpData;
      }
    }

    return mpData;
  }

  /**
   * Retorna o status público de conexão do tenant — sem expor tokens.
   */
  static async getPublicStatus(
    tenantId: string,
  ): Promise<MercadoPagoPublicStatus> {
    const mpData = await this.getMercadoPagoData(tenantId);

    if (!mpData) {
      return { connected: false };
    }

    return {
      connected: true,
      userId: mpData.userId,
      connectedAt: mpData.connectedAt,
      liveMode: mpData.liveMode,
      environment: mpData.environment ?? (mpData.liveMode ? "production" : "sandbox"),
    };
  }

  /**
   * Retorna a public key e environment do tenant para uso no Payment Brick do frontend.
   * A public key é análoga à publishable key do Stripe — seguro expor via share token.
   */
  static async getPublicConfig(tenantId: string): Promise<TenantMpPublicConfig> {
    const mpData = await this.getMercadoPagoData(tenantId);
    if (!mpData) throw new Error("MP_NOT_CONFIGURED");
    const environment: MercadoPagoEnvironment =
      mpData.environment ?? (mpData.liveMode ? "production" : "sandbox");

    // In sandbox, card tokenization must use the integrator's test public key
    // (not the seller's OAuth key). Using the seller's own key causes MP error 2034
    // because MP sees the seller tokenizing a card in their own context and then
    // trying to pay themselves.
    const publicKey =
      environment === "sandbox" && process.env.MERCADOPAGO_SANDBOX_PUBLIC_KEY
        ? process.env.MERCADOPAGO_SANDBOX_PUBLIC_KEY
        : mpData.publicKey;

    let sellerTestEmail: string | undefined;
    if (environment === "sandbox") {
      try {
        const resp = await axios.get<{ email?: string }>(
          "https://api.mercadopago.com/users/me",
          { headers: { Authorization: `Bearer ${mpData.accessToken}` } },
        );
        sellerTestEmail = resp.data?.email ?? undefined;
      } catch {
        // non-critical — proceed without seller email
      }
    }
    return { publicKey, environment, sellerTestEmail };
  }
}
