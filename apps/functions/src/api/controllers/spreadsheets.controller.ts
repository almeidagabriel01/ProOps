import { Request, Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../../init";
import { resolveUserAndTenant } from "../../lib/auth-helpers";
import {
  enforceTenantPlanLimit,
  getTenantSpreadsheetsUsage,
  getTenantStorageUsageMb,
} from "../../lib/tenant-plan-policy";

type SpreadsheetInput = {
  name?: string;
  data?: unknown;
  dataJson?: string;
  dataFormat?: string;
  targetTenantId?: string;
};

function getEstimatedStorageIncreaseMb(input: SpreadsheetInput): number {
  if (typeof input.dataJson === "string") {
    const bytes = Buffer.byteLength(input.dataJson, "utf8");
    return Math.max(1, Math.ceil(bytes / (1024 * 1024)));
  }

  const serialized = JSON.stringify(input.data || {});
  const bytes = Buffer.byteLength(serialized, "utf8");
  return Math.max(1, Math.ceil(bytes / (1024 * 1024)));
}

export const createSpreadsheet = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const input = (req.body || {}) as SpreadsheetInput;

    const {
      tenantId: requesterTenantId,
      isSuperAdmin,
    } = await resolveUserAndTenant(userId, req.user);

    const targetTenantId =
      isSuperAdmin && input.targetTenantId
        ? String(input.targetTenantId).trim()
        : requesterTenantId;

    if (!targetTenantId) {
      return res.status(400).json({ message: "tenantId ausente para planilha." });
    }

    const spreadsheetsUsage = await getTenantSpreadsheetsUsage(targetTenantId);
    const spreadsheetsDecision = await enforceTenantPlanLimit({
      tenantId: targetTenantId,
      feature: "maxSpreadsheets",
      currentUsage: spreadsheetsUsage,
      uid: userId,
      requestId: req.requestId,
      route: req.path,
      isSuperAdmin,
    });
    if (!spreadsheetsDecision.allowed) {
      return res.status(spreadsheetsDecision.statusCode || 402).json({
        message:
          spreadsheetsDecision.message ||
          "Limite de planilhas atingido para o plano atual.",
        code: spreadsheetsDecision.code || "PLAN_LIMIT_EXCEEDED",
      });
    }

    const estimatedIncreaseMb = getEstimatedStorageIncreaseMb(input);
    const storageUsageMb = await getTenantStorageUsageMb(targetTenantId);
    const storageDecision = await enforceTenantPlanLimit({
      tenantId: targetTenantId,
      feature: "storageQuotaMB",
      currentUsage: storageUsageMb,
      incrementBy: estimatedIncreaseMb,
      uid: userId,
      requestId: req.requestId,
      route: req.path,
      isSuperAdmin,
    });
    if (!storageDecision.allowed) {
      return res.status(storageDecision.statusCode || 402).json({
        message:
          storageDecision.message ||
          "Quota de armazenamento atingida para o plano atual.",
        code: storageDecision.code || "PLAN_LIMIT_EXCEEDED",
      });
    }

    const now = Timestamp.now();
    const normalizedName = String(input.name || "").trim() || "Planilha";
    const dataJson =
      typeof input.dataJson === "string"
        ? input.dataJson
        : JSON.stringify(input.data || {});

    const docRef = await db.collection("spreadsheets").add({
      tenantId: targetTenantId,
      name: normalizedName,
      dataJson,
      dataFormat: String(input.dataFormat || "univer"),
      createdAt: now,
      updatedAt: now,
      createdById: userId,
    });

    return res.status(201).json({
      success: true,
      id: docRef.id,
      message: "Planilha criada com sucesso.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro ao criar planilha.";
    console.error("createSpreadsheet Error:", message);
    return res.status(500).json({ message });
  }
};

function resolveSpreadsheetJsonData(input: SpreadsheetInput): string | null {
  if (typeof input.dataJson === "string") {
    return input.dataJson;
  }
  if (Object.prototype.hasOwnProperty.call(input, "data")) {
    return JSON.stringify(input.data || {});
  }
  return null;
}

function computeSizeMb(raw: string): number {
  const bytes = Buffer.byteLength(raw || "", "utf8");
  return Math.max(0, Math.ceil(bytes / (1024 * 1024)));
}

export const updateSpreadsheet = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;
    const input = (req.body || {}) as SpreadsheetInput;

    if (!id) {
      return res.status(400).json({ message: "ID da planilha é obrigatório." });
    }

    const { tenantId: requesterTenantId, isSuperAdmin } =
      await resolveUserAndTenant(userId, req.user);

    const docRef = db.collection("spreadsheets").doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ message: "Planilha não encontrada." });
    }

    const existingData = docSnap.data() as
      | { tenantId?: string; dataJson?: string; data?: unknown }
      | undefined;
    const docTenantId = String(existingData?.tenantId || "").trim();
    if (!isSuperAdmin && docTenantId !== requesterTenantId) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    const nextDataJson = resolveSpreadsheetJsonData(input);
    if (nextDataJson !== null) {
      const currentDataJson =
        typeof existingData?.dataJson === "string"
          ? existingData.dataJson
          : JSON.stringify(existingData?.data || {});
      const deltaMb = Math.max(
        0,
        computeSizeMb(nextDataJson) - computeSizeMb(currentDataJson),
      );

      if (deltaMb > 0) {
        const storageUsageMb = await getTenantStorageUsageMb(docTenantId);
        const storageDecision = await enforceTenantPlanLimit({
          tenantId: docTenantId,
          feature: "storageQuotaMB",
          currentUsage: storageUsageMb,
          incrementBy: deltaMb,
          uid: userId,
          requestId: req.requestId,
          route: req.path,
          isSuperAdmin,
        });
        if (!storageDecision.allowed) {
          return res.status(storageDecision.statusCode || 402).json({
            message:
              storageDecision.message ||
              "Quota de armazenamento atingida para o plano atual.",
            code: storageDecision.code || "PLAN_LIMIT_EXCEEDED",
          });
        }
      }
    }

    const updatePayload: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };
    if (typeof input.name === "string") {
      updatePayload.name = input.name.trim();
    }
    if (typeof input.dataFormat === "string") {
      updatePayload.dataFormat = input.dataFormat;
    }
    if (nextDataJson !== null) {
      updatePayload.dataJson = nextDataJson;
      updatePayload.data = null;
    }

    await docRef.update(updatePayload);
    return res.json({ success: true, message: "Planilha atualizada." });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro ao atualizar planilha.";
    console.error("updateSpreadsheet Error:", message);
    return res.status(500).json({ message });
  }
};

export const deleteSpreadsheet = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "ID da planilha é obrigatório." });
    }

    const { tenantId: requesterTenantId, isSuperAdmin } =
      await resolveUserAndTenant(userId, req.user);

    const docRef = db.collection("spreadsheets").doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ message: "Planilha não encontrada." });
    }

    const data = docSnap.data() as { tenantId?: string } | undefined;
    const docTenantId = String(data?.tenantId || "").trim();
    if (!isSuperAdmin && docTenantId !== requesterTenantId) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    await docRef.delete();
    return res.json({ success: true, message: "Planilha removida." });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro ao remover planilha.";
    console.error("deleteSpreadsheet Error:", message);
    return res.status(500).json({ message });
  }
};
