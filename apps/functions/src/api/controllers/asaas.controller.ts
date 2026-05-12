import { Request, Response } from "express";
import { resolveUserAndTenant } from "../../lib/auth-helpers";
import { AsaasService, AsaasOnboardingData } from "../services/asaas.service";
import { logger } from "../../lib/logger";

function mapAsaasErrorStatus(error: Error): number {
  if (error.message === "TENANT_NOT_FOUND") return 404;
  if (error.message.startsWith("ASAAS_SUBCONTA_CREATION_FAILED")) return 502;
  if (error.message === "ASAAS_MASTER_KEY_NOT_CONFIGURED") return 500;
  if (
    error.message.startsWith("FORBIDDEN_") ||
    error.message.startsWith("AUTH_CLAIMS_MISSING_")
  )
    return 403;
  return 500;
}

// POST /v1/asaas/connect
// Body: AsaasOnboardingData + environment
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

    const {
      name,
      email,
      cpfCnpj,
      mobilePhone,
      companyType,
      postalCode,
      address,
      addressNumber,
      province,
    } = req.body as Record<string, unknown>;

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ message: "Nome é obrigatório" });
      return;
    }
    if (!email || typeof email !== "string" || !email.trim()) {
      res.status(400).json({ message: "E-mail é obrigatório" });
      return;
    }
    if (!cpfCnpj || typeof cpfCnpj !== "string" || !cpfCnpj.replace(/\D/g, "")) {
      res.status(400).json({ message: "CPF/CNPJ é obrigatório" });
      return;
    }
    if (!mobilePhone || typeof mobilePhone !== "string" || !mobilePhone.replace(/\D/g, "")) {
      res.status(400).json({ message: "Telefone é obrigatório" });
      return;
    }
    if (!postalCode || typeof postalCode !== "string" || !postalCode.replace(/\D/g, "")) {
      res.status(400).json({ message: "CEP é obrigatório" });
      return;
    }
    if (!address || typeof address !== "string" || !address.trim()) {
      res.status(400).json({ message: "Endereço é obrigatório" });
      return;
    }
    if (!addressNumber || typeof addressNumber !== "string" || !addressNumber.trim()) {
      res.status(400).json({ message: "Número do endereço é obrigatório" });
      return;
    }
    if (!province || typeof province !== "string" || !province.trim()) {
      res.status(400).json({ message: "Bairro é obrigatório" });
      return;
    }

    const onboardingData: AsaasOnboardingData = {
      name: String(name).trim(),
      email: String(email).trim(),
      cpfCnpj: String(cpfCnpj).replace(/\D/g, ""),
      mobilePhone: String(mobilePhone).replace(/\D/g, ""),
      companyType:
        companyType && typeof companyType === "string" ? companyType.trim() : undefined,
      postalCode: String(postalCode).replace(/\D/g, ""),
      address: String(address).trim(),
      addressNumber: String(addressNumber).trim(),
      province: String(province).trim(),
    };

    await AsaasService.onboardTenant(tenantId, onboardingData);

    logger.info("Asaas onboard requested", { tenantId, uid: userId });

    res.status(200).json({ success: true });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const status = mapAsaasErrorStatus(err);
    if (status >= 500) {
      logger.error("Error in connectAsaas", {
        errorMessage: err.message,
        uid: req.user?.uid,
        tenantId: req.user?.tenantId,
      });
    }
    if (err.message.startsWith("ASAAS_SUBCONTA_CREATION_FAILED")) {
      const detail = err.message.slice("ASAAS_SUBCONTA_CREATION_FAILED:".length);
      res.status(502).json({
        message: "Erro ao criar conta no Asaas. Verifique os dados e tente novamente.",
        detail: detail || undefined,
      });
      return;
    }
    if (err.message === "ASAAS_MASTER_KEY_NOT_CONFIGURED") {
      res.status(500).json({
        message: "Integração Asaas não configurada no servidor. Contate o suporte.",
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
    if (status >= 500) {
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
