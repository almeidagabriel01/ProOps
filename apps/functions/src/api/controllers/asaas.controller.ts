import { Request, Response } from "express";
import { resolveUserAndTenant } from "../../lib/auth-helpers";
import { AsaasService, AsaasEnvironment } from "../services/asaas.service";
import { logger } from "../../lib/logger";

function mapAsaasErrorStatus(error: Error): number {
  if (error.message === "TENANT_NOT_FOUND") return 404;
  if (error.message === "ASAAS_INVALID_API_KEY") return 422;
  if (
    error.message.startsWith("FORBIDDEN_") ||
    error.message.startsWith("AUTH_CLAIMS_MISSING_")
  )
    return 403;
  return 500;
}

// POST /v1/asaas/connect
// Body: { apiKey: string, environment: "sandbox" | "production" }
export const connectAsaas = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ message: "Não autenticado" });
      return;
    }

    const { tenantId, isMaster, isSuperAdmin } = await resolveUserAndTenant(userId, req.user);
    if (!isMaster && !isSuperAdmin) {
      res.status(403).json({ message: "Sem permissão para configurar integrações" });
      return;
    }

    const { apiKey, environment: rawEnvironment } = req.body as {
      apiKey?: unknown;
      environment?: unknown;
    };

    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
      res.status(400).json({ message: "API key do Asaas é obrigatória" });
      return;
    }

    const validEnvironments: AsaasEnvironment[] = ["sandbox", "production"];
    if (
      !rawEnvironment ||
      typeof rawEnvironment !== "string" ||
      !validEnvironments.includes(rawEnvironment as AsaasEnvironment)
    ) {
      res.status(400).json({
        message: "environment deve ser 'sandbox' ou 'production'",
      });
      return;
    }

    const environment = rawEnvironment as AsaasEnvironment;

    await AsaasService.connectTenant(tenantId, apiKey.trim(), environment);

    logger.info("Asaas connect requested", { tenantId, environment, uid: userId });

    res.status(200).json({ success: true });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const status = mapAsaasErrorStatus(err);
    if (status === 500) {
      logger.error("Unexpected error in connectAsaas", {
        errorMessage: err.message,
        uid: req.user?.uid,
        tenantId: req.user?.tenantId,
      });
    }
    if (err.message === "ASAAS_INVALID_API_KEY") {
      res.status(422).json({
        message: "API key do Asaas inválida. Verifique a chave e o ambiente selecionado.",
      });
      return;
    }
    if (err.message === "TENANT_NOT_FOUND") {
      res.status(404).json({ message: "Tenant não encontrado" });
      return;
    }
    res.status(status).json({ message: err.message });
  }
};

// GET /v1/asaas/status
export const getAsaasStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ message: "Não autenticado" });
      return;
    }

    const { tenantId } = await resolveUserAndTenant(userId, req.user);

    const status = await AsaasService.getPublicStatus(tenantId);

    res.status(200).json(status);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const status = mapAsaasErrorStatus(err);
    logger.error("Unexpected error in getAsaasStatus", {
      errorMessage: err.message,
      uid: req.user?.uid,
    });
    res.status(status).json({ message: err.message });
  }
};

// DELETE /v1/asaas/disconnect
export const disconnectAsaas = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ message: "Não autenticado" });
      return;
    }

    const { tenantId, isMaster, isSuperAdmin } = await resolveUserAndTenant(userId, req.user);
    if (!isMaster && !isSuperAdmin) {
      res.status(403).json({ message: "Sem permissão para remover integrações" });
      return;
    }

    await AsaasService.disconnectTenant(tenantId);

    logger.info("Asaas disconnect requested", { tenantId, uid: userId });

    res.status(200).json({ success: true });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const status = mapAsaasErrorStatus(err);
    if (status === 500) {
      logger.error("Unexpected error in disconnectAsaas", {
        errorMessage: err.message,
        uid: req.user?.uid,
        tenantId: req.user?.tenantId,
      });
    }
    if (err.message === "TENANT_NOT_FOUND") {
      res.status(404).json({ message: "Tenant não encontrado" });
      return;
    }
    res.status(status).json({ message: err.message });
  }
};
