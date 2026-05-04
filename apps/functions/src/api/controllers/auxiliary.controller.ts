import { Request, Response } from "express";
import { db } from "../../init";
import { Timestamp } from "firebase-admin/firestore";
import { resolveUserAndTenant } from "../../lib/auth-helpers";
import { isSuperAdminClaim } from "../../lib/request-auth";

function sanitizeCreateInput(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const {
    id: _ignoredId,
    tenantId: _ignoredTenantId,
    targetTenantId: _ignoredTargetTenantId,
    createdAt: _ignoredCreatedAt,
    updatedAt: _ignoredUpdatedAt,
    ...safeInput
  } = input;
  return safeInput;
}

function sanitizeUpdateInput(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const {
    id: _ignoredId,
    tenantId: _ignoredTenantId,
    targetTenantId: _ignoredTargetTenantId,
    createdAt: _ignoredCreatedAt,
    ...safeInput
  } = input;
  return safeInput;
}

function mapAuxiliaryError(error: unknown): { status: number; message: string } {
  const message = error instanceof Error ? error.message : "Erro desconhecido";
  if (
    message.startsWith("FORBIDDEN_") ||
    message.startsWith("AUTH_CLAIMS_MISSING_")
  ) {
    return { status: 403, message: "Permissao negada" };
  }
  return { status: 500, message };
}

function resolveEffectiveTenantId(
  req: Request,
  input: Record<string, unknown>,
  requesterTenantId: string,
): string {
  const targetTenantId =
    typeof input.targetTenantId === "string" ? input.targetTenantId.trim() : "";

  if (isSuperAdminClaim(req) && targetTenantId) {
    return targetTenantId;
  }

  return requesterTenantId;
}

const handleCreate = async (
  req: Request,
  res: Response,
  collectionName: string,
  requiredFields: string[],
) => {
  try {
    const userId = req.user!.uid;
    const input = (req.body || {}) as Record<string, unknown>;

    for (const field of requiredFields) {
      const value = input[field];
      if (
        value === undefined ||
        value === null ||
        (typeof value === "string" && !value.trim())
      ) {
        return res.status(400).json({ message: `${field} e obrigatorio.` });
      }
    }

    const { tenantId: requesterTenantId } = await resolveUserAndTenant(
      userId,
      req.user,
    );

    const effectiveTenantId = resolveEffectiveTenantId(
      req,
      input,
      requesterTenantId,
    );

    const now = Timestamp.now();
    const docData: Record<string, unknown> = {
      ...sanitizeCreateInput(input),
      tenantId: effectiveTenantId,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection(collectionName).add(docData);

    return res.status(201).json({
      success: true,
      id: docRef.id,
      message: "Criado com sucesso.",
    });
  } catch (error: unknown) {
    console.error(`Error creating ${collectionName}:`, error);
    const mapped = mapAuxiliaryError(error);
    return res.status(mapped.status).json({ message: mapped.message });
  }
};

const handleUpdate = async (
  req: Request,
  res: Response,
  collectionName: string,
) => {
  try {
    const { id } = req.params;
    const userId = req.user!.uid;
    const input = (req.body || {}) as Record<string, unknown>;

    const { tenantId, isSuperAdmin } = await resolveUserAndTenant(userId, req.user);

    const docRef = db.collection(collectionName).doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ message: "Documento nao encontrado." });
    }

    const data = docSnap.data();
    if (!isSuperAdmin && data?.tenantId !== tenantId) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    const updateData = {
      ...sanitizeUpdateInput(input),
      updatedAt: Timestamp.now(),
    };

    await docRef.update(updateData);

    return res.json({ success: true, message: "Atualizado com sucesso." });
  } catch (error: unknown) {
    console.error(`Error updating ${collectionName}:`, error);
    const mapped = mapAuxiliaryError(error);
    return res.status(mapped.status).json({ message: mapped.message });
  }
};

const handleDelete = async (
  req: Request,
  res: Response,
  collectionName: string,
) => {
  try {
    const { id } = req.params;
    const userId = req.user!.uid;

    const { tenantId, isSuperAdmin } = await resolveUserAndTenant(userId, req.user);

    const docRef = db.collection(collectionName).doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ message: "Documento nao encontrado." });
    }

    const data = docSnap.data();
    if (!isSuperAdmin && data?.tenantId !== tenantId) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    await docRef.delete();

    return res.json({ success: true, message: "Removido com sucesso." });
  } catch (error: unknown) {
    console.error(`Error deleting ${collectionName}:`, error);
    const mapped = mapAuxiliaryError(error);
    return res.status(mapped.status).json({ message: mapped.message });
  }
};

export const createAmbiente = (req: Request, res: Response) =>
  handleCreate(req, res, "ambientes", ["name"]);
export const updateAmbiente = (req: Request, res: Response) =>
  handleUpdate(req, res, "ambientes");
export const deleteAmbiente = (req: Request, res: Response) =>
  handleDelete(req, res, "ambientes");

export const createSistema = (req: Request, res: Response) =>
  handleCreate(req, res, "sistemas", ["name"]);
export const updateSistema = (req: Request, res: Response) =>
  handleUpdate(req, res, "sistemas");
export const deleteSistema = (req: Request, res: Response) =>
  handleDelete(req, res, "sistemas");

export const createCustomField = (req: Request, res: Response) =>
  handleCreate(req, res, "customFields", ["label", "type"]);
export const updateCustomField = (req: Request, res: Response) =>
  handleUpdate(req, res, "customFields");
export const deleteCustomField = (req: Request, res: Response) =>
  handleDelete(req, res, "customFields");

export const createOption = (req: Request, res: Response) =>
  handleCreate(req, res, "options", ["label"]);
export const updateOption = (req: Request, res: Response) =>
  handleUpdate(req, res, "options");
export const deleteOption = (req: Request, res: Response) =>
  handleDelete(req, res, "options");

export const createProposalTemplate = (req: Request, res: Response) =>
  handleCreate(req, res, "proposalTemplates", ["name", "content"]);
export const updateProposalTemplate = (req: Request, res: Response) =>
  handleUpdate(req, res, "proposalTemplates");
export const deleteProposalTemplate = (req: Request, res: Response) =>
  handleDelete(req, res, "proposalTemplates");
