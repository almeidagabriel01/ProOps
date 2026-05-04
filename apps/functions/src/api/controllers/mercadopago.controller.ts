import { Request, Response } from "express";
import { resolveUserAndTenant } from "../../lib/auth-helpers";
import { buildOAuthUrl, verifyAndExtractState } from "../../lib/mercadopago-client";
import { MercadoPagoService } from "../services/mercadopago.service";
import { logger } from "../../lib/logger";

function mapMercadoPagoErrorStatus(error: Error): number {
  if (error.message === "INVALID_STATE") return 400;
  if (error.message === "TENANT_NOT_FOUND") return 404;
  if (error.message === "CONCURRENT_CALLBACK_IN_PROGRESS") return 409;
  if (error.message === "MP_CODE_ALREADY_PROCESSED") return 409;
  if (
    error.message === "FORBIDDEN_TENANT_MISMATCH" ||
    error.message.startsWith("FORBIDDEN_") ||
    error.message.startsWith("AUTH_CLAIMS_MISSING_")
  ) {
    return 403;
  }
  return 500;
}

/**
 * GET /v1/mercadopago/oauth/start
 * Retorna a URL de autorização OAuth do Mercado Pago para o tenant autenticado.
 */
export const startOAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = await resolveUserAndTenant(req.user!.uid, req.user);
    const authUrl = buildOAuthUrl(tenantId);

    res.status(200).json({ authUrl });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Erro ao iniciar OAuth MercadoPago", {
      uid: req.user?.uid,
      error: err.message,
    });
    const status = mapMercadoPagoErrorStatus(err);
    res.status(status).json({ message: err.message });
  }
};

/**
 * POST /v1/mercadopago/oauth/callback
 * Body: { code: string, state: string }
 * Verifica o state, troca o code por tokens e conecta o tenant.
 */
export const callbackOAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state } = req.body as { code?: unknown; state?: unknown };

    if (!code || typeof code !== "string") {
      res.status(400).json({ message: "Parâmetro 'code' ausente ou inválido" });
      return;
    }
    if (!state || typeof state !== "string") {
      res.status(400).json({ message: "Parâmetro 'state' ausente ou inválido" });
      return;
    }

    // Verifica assinatura HMAC do state e extrai o tenantId
    let statePayload;
    try {
      statePayload = verifyAndExtractState(state);
    } catch (stateErr) {
      logger.warn("State inválido no callback MP — possível CSRF ou encoding corrompido", {
        uid: req.user?.uid,
        stateLength: state.length,
        statePrefix: state.substring(0, 20),
        error: stateErr instanceof Error ? stateErr.message : String(stateErr),
      });
      res.status(400).json({ message: "INVALID_STATE" });
      return;
    }

    // Confirma que o tenantId do state corresponde ao do usuário autenticado
    const { tenantId } = await resolveUserAndTenant(req.user!.uid, req.user);

    if (statePayload.tenantId !== tenantId) {
      res.status(403).json({ message: "State pertence a outro tenant" });
      return;
    }

    const result = await MercadoPagoService.connectTenant(tenantId, code);

    res.status(200).json({ success: true, alreadyConnected: result.alreadyConnected });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mpResponseData = (error as any)?.response?.data;
    logger.error("Erro no callback OAuth MercadoPago", {
      uid: req.user?.uid,
      error: err.message,
      mpError: mpResponseData ?? null,
    });
    const status = mapMercadoPagoErrorStatus(err);
    res.status(status).json({ message: err.message });
  }
};

/**
 * DELETE /v1/mercadopago/disconnect
 * Desconecta o tenant do Mercado Pago e revoga o token (best-effort).
 */
export const disconnectOAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = await resolveUserAndTenant(req.user!.uid, req.user);

    await MercadoPagoService.disconnectTenant(tenantId);

    res.status(200).json({ success: true });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Erro ao desconectar MercadoPago", {
      uid: req.user?.uid,
      error: err.message,
    });
    const status = mapMercadoPagoErrorStatus(err);
    res.status(status).json({ message: err.message });
  }
};

/**
 * GET /v1/mercadopago/status
 * Retorna o status de conexão do tenant. Nunca expõe tokens.
 */
export const getConnectionStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = await resolveUserAndTenant(req.user!.uid, req.user);

    const status = await MercadoPagoService.getPublicStatus(tenantId);

    res.status(200).json(status);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Erro ao buscar status MercadoPago", {
      uid: req.user?.uid,
      error: err.message,
    });
    const status = mapMercadoPagoErrorStatus(err);
    res.status(status).json({ message: err.message });
  }
};
