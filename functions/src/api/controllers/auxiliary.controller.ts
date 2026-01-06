import { Request, Response } from "express";
import { db } from "../../init";
import { Timestamp } from "firebase-admin/firestore";
import { resolveUserAndTenant } from "../../lib/auth-helpers";

// Helper to handle standard CRUD (Create, Update, Delete) for auxiliary collections
// Collections: ambientes, sistemas, customFields, options, proposalTemplates
// All these have: tenantId, createdAt, updatedAt, and various specific fields.

const handleCreate = async (
  req: Request,
  res: Response,
  collectionName: string,
  requiredFields: string[]
) => {
  try {
    const userId = req.user!.uid;
    const input = req.body;

    // Basic Validation
    for (const field of requiredFields) {
      if (!input[field]) {
        return res.status(400).json({ message: `${field} é obrigatório.` });
      }
    }

    const { tenantId, isSuperAdmin } = await resolveUserAndTenant(userId);

    // Permission: usually being authenticated and part of tenant is enough for auxiliary?
    // The original code checked: getTenantId, then docData = { tenantId, ... }
    // We assume if you are in the tenant, you can manage basic config, OR we should check role.
    // Ideally only ADMIN/MASTER/SUPERADMIN can manage configs.
    // Original code: "auth.uid" -> "getTenantId". If success, proceed.
    // We should probably enforce isMaster || isSuperAdmin to be professional.

    // if (!isMaster && !isSuperAdmin) return res.status(403).json({ message: "Permissão negada." });

    const now = Timestamp.now();
    const docData: Record<string, unknown> = {
      tenantId:
        isSuperAdmin && input.targetTenantId ? input.targetTenantId : tenantId,
      ...input,
      createdAt: now,
      updatedAt: now,
    };

    // Remove sensitive or computed fields if passed
    delete docData.id;
    delete docData.targetTenantId; // Clean up

    const docRef = await db.collection(collectionName).add(docData);

    return res.status(201).json({
      success: true,
      id: docRef.id,
      message: "Criado com sucesso.",
    });
  } catch (error: unknown) {
    console.error(`Error creating ${collectionName}:`, error);
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};

const handleUpdate = async (
  req: Request,
  res: Response,
  collectionName: string
) => {
  try {
    const { id } = req.params;
    const userId = req.user!.uid;
    const input = req.body;

    const { tenantId, isSuperAdmin } = await resolveUserAndTenant(userId);

    const docRef = db.collection(collectionName).doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ message: "Documento não encontrado." });
    }

    const data = docSnap.data();
    if (!isSuperAdmin && data?.tenantId !== tenantId) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    const updateData = {
      ...input,
      updatedAt: Timestamp.now(),
    };
    // Protect immutable fields
    delete updateData.tenantId;
    delete updateData.createdAt;
    delete updateData.id;

    await docRef.update(updateData);

    return res.json({ success: true, message: "Atualizado com sucesso." });
  } catch (error: unknown) {
    console.error(`Error updating ${collectionName}:`, error);
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};

const handleDelete = async (
  req: Request,
  res: Response,
  collectionName: string
) => {
  try {
    const { id } = req.params;
    const userId = req.user!.uid;

    const { tenantId, isSuperAdmin } = await resolveUserAndTenant(userId);

    const docRef = db.collection(collectionName).doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ message: "Documento não encontrado." });
    }

    const data = docSnap.data();
    if (!isSuperAdmin && data?.tenantId !== tenantId) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    await docRef.delete();

    return res.json({ success: true, message: "Removido com sucesso." });
  } catch (error: unknown) {
    console.error(`Error deleting ${collectionName}:`, error);
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};

// Export specific handlers
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
