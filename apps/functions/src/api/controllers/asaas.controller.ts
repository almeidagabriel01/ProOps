import { Request, Response } from "express";
import { resolveUserAndTenant } from "../../lib/auth-helpers";
import { AsaasService, AsaasOnboardingData } from "../services/asaas.service";
import { logger } from "../../lib/logger";
import { db } from "../../init";

function mapAsaasErrorStatus(error: Error): number {
  if (error.message === "TENANT_NOT_FOUND") return 404;
  if (error.message === "ASAAS_SUBCONTA_CREATION_FAILED") return 502;
  if (error.message === "ASAAS_EMAIL_IN_USE") return 422;
  if (error.message === "ASAAS_ACCOUNT_IN_USE_BY_ANOTHER_TENANT") return 409;
  if (error.message === "ASAAS_MASTER_KEY_NOT_CONFIGURED") return 500;
  if (error.message === "ASAAS_NOT_CONNECTED") return 422;
  if (
    error.message.startsWith("FORBIDDEN_") ||
    error.message.startsWith("AUTH_CLAIMS_MISSING_")
  )
    return 403;
  return 500;
}

// POST /v1/asaas/connect
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
      incomeValue,
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
    if (incomeValue === undefined || incomeValue === null || typeof incomeValue !== "number" || incomeValue <= 0) {
      res.status(400).json({ message: "Faturamento mensal é obrigatório e deve ser maior que zero" });
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
    if (!companyType || typeof companyType !== "string" || !companyType.trim()) {
      res.status(400).json({ message: "Tipo de empresa é obrigatório" });
      return;
    }

    const onboardingData: AsaasOnboardingData = {
      name: String(name).trim(),
      email: String(email).trim(),
      cpfCnpj: String(cpfCnpj).replace(/\D/g, ""),
      mobilePhone: String(mobilePhone).replace(/\D/g, ""),
      incomeValue: Number(incomeValue),
      companyType:
        companyType && typeof companyType === "string" ? companyType.trim() : undefined,
      postalCode: String(postalCode).replace(/\D/g, ""),
      address: String(address).trim(),
      addressNumber: String(addressNumber).trim(),
      province: String(province).trim(),
    };

    await AsaasService.onboardTenant(tenantId, onboardingData);

    logger.info("Asaas onboard requested", { tenantId, uid: userId });

    // Return webhook status so the UI can surface failures immediately
    const asaasData = await AsaasService.getAsaasData(tenantId);
    res.status(200).json({
      success: true,
      webhookStatus: asaasData?.webhookStatus ?? null,
    });
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
    if (err.message === "ASAAS_EMAIL_IN_USE") {
      res.status(422).json({
        message: "Este email já está em uso no Asaas. Use um email diferente para criar a subconta.",
      });
      return;
    }
    if (err.message === "ASAAS_ACCOUNT_IN_USE_BY_ANOTHER_TENANT") {
      res.status(409).json({
        message: "Este CNPJ/CPF já está vinculado a outra conta. Contate o suporte.",
      });
      return;
    }
    if (err.message === "ASAAS_SUBCONTA_CREATION_FAILED") {
      const body = (err as unknown as Record<string, unknown>)._asaasBody as
        | { asaasErrors?: Array<{ description?: string }>; message?: string }
        | undefined;
      const asaasMessage =
        body?.asaasErrors?.[0]?.description ||
        (typeof body?.message === "string" ? body.message : null);
      res.status(502).json({
        message: asaasMessage || "Erro ao criar conta no Asaas. Verifique os dados e tente novamente.",
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

    const asaasData = await AsaasService.getAsaasData(tenantId);
    if (!asaasData) {
      res.status(200).json({ connected: false });
      return;
    }

    // Refresh account status if missing or not yet APPROVED
    let accountStatus = asaasData.accountStatus;
    if (!accountStatus || accountStatus.general !== "APPROVED") {
      const refreshed = await AsaasService.refreshAccountStatus(tenantId);
      if (refreshed) {
        accountStatus = refreshed;
      }
    }

    res.status(200).json({
      connected: true,
      environment: asaasData.environment,
      connectedAt: asaasData.connectedAt,
      ...(accountStatus ? { accountStatus } : {}),
      ...(asaasData.webhookStatus ? { webhookStatus: asaasData.webhookStatus } : {}),
      ...(asaasData.payout ? { payout: asaasData.payout } : {}),
    });
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

// POST /v1/asaas/webhook/retry
export const retryAsaasWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ message: "Não autenticado" });
      return;
    }

    const { tenantId, isMaster, isSuperAdmin } = await resolveUserAndTenant(userId, req.user);
    if (!isMaster && !isSuperAdmin) {
      res.status(403).json({ message: "Sem permissão para reconfigurar integração Asaas" });
      return;
    }

    const webhookStatus = await AsaasService.registerWebhookForTenant(tenantId);

    logger.info("Asaas webhook retry requested", { tenantId, uid: userId, state: webhookStatus?.state });

    res.status(200).json({ webhookStatus });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const status = mapAsaasErrorStatus(err);
    if (status >= 500) {
      logger.error("Unexpected error in retryAsaasWebhook", {
        errorMessage: err.message,
        uid: req.user?.uid,
        tenantId: req.user?.tenantId,
      });
    }
    if (err.message === "ASAAS_NOT_CONNECTED") {
      res.status(422).json({ message: "Conta Asaas não configurada para este tenant" });
      return;
    }
    res.status(status).json({ message: err.message });
  }
};

// PUT /v1/asaas/payout
export const updateAsaasPayout = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ message: "Não autenticado" });
      return;
    }

    const { tenantId, isMaster, isSuperAdmin } = await resolveUserAndTenant(userId, req.user);
    if (!isMaster && !isSuperAdmin) {
      res.status(403).json({ message: "Sem permissão para configurar repasses automáticos" });
      return;
    }

    const { enabled, pixAddressKey, pixAddressKeyType } = req.body as Record<string, unknown>;

    if (typeof enabled !== "boolean") {
      res.status(400).json({ message: "O campo 'enabled' é obrigatório e deve ser boolean" });
      return;
    }

    if (enabled) {
      if (!pixAddressKey || typeof pixAddressKey !== "string" || !pixAddressKey.trim()) {
        res.status(400).json({ message: "Chave PIX é obrigatória ao habilitar repasses" });
        return;
      }

      const validKeyTypes = ["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM_KEY"] as const;
      if (!pixAddressKeyType || !validKeyTypes.includes(pixAddressKeyType as (typeof validKeyTypes)[number])) {
        res.status(400).json({
          message: "Tipo de chave PIX inválido. Use: CPF, CNPJ, EMAIL, PHONE ou RANDOM_KEY",
        });
        return;
      }

      const keyStr = String(pixAddressKey).trim();
      const digits = keyStr.replace(/\D/g, "");
      const keyType = pixAddressKeyType as "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM_KEY";

      let formatError: string | null = null;
      if (keyType === "CPF" && digits.length !== 11) {
        formatError = "Chave CPF deve ter 11 dígitos";
      } else if (keyType === "CNPJ" && digits.length !== 14) {
        formatError = "Chave CNPJ deve ter 14 dígitos";
      } else if (keyType === "PHONE" && (digits.length < 10 || digits.length > 11)) {
        formatError = "Chave telefone deve ter 10 ou 11 dígitos";
      } else if (keyType === "EMAIL" && (!keyStr.includes("@") || !keyStr.includes("."))) {
        formatError = "Chave e-mail inválida";
      } else if (keyType === "RANDOM_KEY" && !keyStr) {
        formatError = "Chave aleatória não pode ser vazia";
      }

      if (formatError) {
        res.status(400).json({ message: formatError });
        return;
      }
    }

    const asaasData = await AsaasService.getAsaasData(tenantId);
    if (!asaasData) {
      res.status(422).json({ message: "Conta Asaas não configurada para este tenant" });
      return;
    }

    if (enabled) {
      const currentStatus = asaasData.accountStatus?.general;
      const effectiveStatus =
        currentStatus === "APPROVED"
          ? currentStatus
          : (await AsaasService.refreshAccountStatus(tenantId))?.general ?? currentStatus;

      if (effectiveStatus !== "APPROVED") {
        res.status(422).json({
          message: "A conta Asaas precisa estar aprovada para configurar repasses automáticos",
        });
        return;
      }
    }

    const tenantRef = db.collection("tenants").doc(tenantId);

    if (enabled) {
      const resolvedKeyType = pixAddressKeyType as "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM_KEY";
      const cleanedKey =
        resolvedKeyType === "CPF" || resolvedKeyType === "CNPJ" || resolvedKeyType === "PHONE"
          ? String(pixAddressKey).trim().replace(/\D/g, "")
          : String(pixAddressKey).trim();

      await tenantRef.update({
        "asaas.payout": {
          enabled: true,
          pixAddressKey: cleanedKey,
          pixAddressKeyType: resolvedKeyType,
          updatedAt: new Date().toISOString(),
        },
      });
    } else {
      await tenantRef.update({
        "asaas.payout.enabled": false,
        "asaas.payout.updatedAt": new Date().toISOString(),
      });
    }

    logger.info("Asaas payout config updated", { tenantId, uid: userId, enabled });

    // Return the canonical persisted state so the frontend can update without a reload
    const updated = await AsaasService.getAsaasData(tenantId);
    res.status(200).json({
      success: true,
      payout: updated?.payout ?? null,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const status = mapAsaasErrorStatus(err);
    if (status >= 500) {
      logger.error("Unexpected error in updateAsaasPayout", {
        errorMessage: err.message,
        uid: req.user?.uid,
        tenantId: req.user?.tenantId,
      });
    }
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
