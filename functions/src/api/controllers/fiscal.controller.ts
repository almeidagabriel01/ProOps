import { Request, Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import {
  buildFiscalDocumentId,
  getProposalFiscalDocument,
  getTenantFiscalConfig,
  isFiscalMockMode,
  requestFiscalCancellation,
  requestFiscalRetry,
  sanitizeTenantFiscalConfigInput,
  syncFiscalDocumentFromWebhook,
  validateTenantFiscalConfig,
  FISCAL_CONFIG_COLLECTION,
} from "../../fiscal/fiscal.service";
import { db } from "../../init";
import { resolveUserAndTenant } from "../../lib/auth-helpers";

function getWebhookSecretFromRequest(req: Request): string {
  const fromHeader = String(req.headers["x-focus-webhook-secret"] || "").trim();
  if (fromHeader) return fromHeader;
  const fromQuery = String(req.query.secret || "").trim();
  if (fromQuery) return fromQuery;
  const body =
    req.body && typeof req.body === "object"
      ? (req.body as Record<string, unknown>)
      : null;
  return String(body?.secret || "").trim();
}

export const getFiscalConfig = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { tenantId } = await resolveUserAndTenant(userId, req.user);
    const config = await getTenantFiscalConfig(tenantId);
    const mockMode = isFiscalMockMode();

    if (!config) {
      return res.status(200).json({
        success: true,
        config: null,
        readiness: validateTenantFiscalConfig(null),
        mockMode,
      });
    }

    return res.status(200).json({
      success: true,
      config,
      readiness: validateTenantFiscalConfig(config),
      mockMode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return res.status(500).json({ message });
  }
};

export const upsertFiscalConfig = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { tenantId, isMaster, isSuperAdmin } = await resolveUserAndTenant(
      userId,
      req.user,
    );

    if (!isMaster && !isSuperAdmin) {
      return res
        .status(403)
        .json({ message: "Apenas administradores podem editar configuracao fiscal." });
    }

    const existing = await getTenantFiscalConfig(tenantId);
    const sanitized = sanitizeTenantFiscalConfigInput(
      tenantId,
      (req.body || {}) as Record<string, unknown>,
      existing,
    );

    await db
      .collection(FISCAL_CONFIG_COLLECTION)
      .doc(tenantId)
      .set(
        {
          ...sanitized,
          createdAt: existing?.createdAt ? existing.createdAt : Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      );

    const config = await getTenantFiscalConfig(tenantId);
    return res.status(200).json({
      success: true,
      config,
      readiness: validateTenantFiscalConfig(config),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return res.status(500).json({ message });
  }
};

export const getProposalFiscalDocumentController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;
    const { tenantId } = await resolveUserAndTenant(userId, req.user);

    if (!id) {
      return res.status(400).json({ message: "ID invalido." });
    }

    const document = await getProposalFiscalDocument({ tenantId, proposalId: id });
    return res.status(200).json({
      success: true,
      document,
      documentId: buildFiscalDocumentId(id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return res.status(500).json({ message });
  }
};

export const retryProposalFiscalDocumentController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;
    const { tenantId } = await resolveUserAndTenant(userId, req.user);

    if (!id) {
      return res.status(400).json({ message: "ID invalido." });
    }

    const document = await requestFiscalRetry({
      tenantId,
      proposalId: id,
      actorId: userId,
    });

    return res.status(200).json({
      success: true,
      document,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return res.status(400).json({ message });
  }
};

export const cancelProposalFiscalDocumentController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;
    const { tenantId } = await resolveUserAndTenant(userId, req.user);

    if (!id) {
      return res.status(400).json({ message: "ID invalido." });
    }

    const document = await requestFiscalCancellation({
      tenantId,
      proposalId: id,
      actorId: userId,
    });

    return res.status(200).json({
      success: true,
      document,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return res.status(400).json({ message });
  }
};

export const focusWebhookController = async (req: Request, res: Response) => {
  try {
    const expectedSecret = String(process.env.FOCUS_NFE_WEBHOOK_SECRET || "").trim();
    if (expectedSecret) {
      const providedSecret = getWebhookSecretFromRequest(req);
      if (providedSecret !== expectedSecret) {
        return res.status(403).json({ message: "Webhook secret invalido." });
      }
    }

    const payload =
      req.body && typeof req.body === "object"
        ? (req.body as Record<string, unknown>)
        : {};
    const document = await syncFiscalDocumentFromWebhook({
      provider: "focus_nfe",
      payload,
    });

    return res.status(200).json({
      success: true,
      documentId: document?.id || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return res.status(400).json({ message });
  }
};
