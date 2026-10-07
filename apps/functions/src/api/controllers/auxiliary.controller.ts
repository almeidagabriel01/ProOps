import { Request, Response } from "express";
import { db } from "../../init";
import { Timestamp } from "firebase-admin/firestore";
import {
  hasPagePermission,
  resolveUserAndTenant,
} from "../../lib/auth-helpers";
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

/**
 * Os recursos auxiliares nao tem tela propria: cada um pertence ao modulo que
 * o consome, e e a permissao DESSE modulo que os gateia. ambientes e sistemas
 * sao Solucoes; custom_fields e proposal_templates sao Propostas; options sao
 * as listas dos cadastros (categoria e fabricante de Produtos e Servicos, e a
 * lista antiga de carteiras do lancamento), entao basta a permissao de uma
 * dessas telas.
 *
 * Ate 2026-10 a exclusao nao conferia permissao nenhuma (qualquer membro,
 * ate o tecnico, apagava ambientes, sistemas e categorias pela API), a edicao
 * exigia tambem "Excluir", e as options conferiam Propostas, que nao as usa.
 */
type AuxPages = string | readonly string[];

async function hasAnyPagePermission(
  req: Request,
  pages: AuxPages,
  action: "canCreate" | "canEdit" | "canDelete",
): Promise<boolean> {
  const list = typeof pages === "string" ? [pages] : pages;
  for (const pageId of list) {
    if (await hasPagePermission(req.user, pageId, action)) return true;
  }
  return false;
}

const OPTION_PAGES = ["products", "services", "transactions"] as const;
const handleCreate = async (
  req: Request,
  res: Response,
  collectionName: string,
  pageId: AuxPages,
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

    if (!(await hasAnyPagePermission(req, pageId, "canCreate"))) {
      return res.status(403).json({ message: "Sem permissao para criar." });
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
  pageId: AuxPages,
) => {
  try {
    const { id } = req.params;
    const userId = req.user!.uid;
    const input = (req.body || {}) as Record<string, unknown>;

    if (!(await hasAnyPagePermission(req, pageId, "canEdit"))) {
      return res.status(403).json({ message: "Sem permissao para editar." });
    }

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
  pageId: AuxPages,
) => {
  try {
    const { id } = req.params;
    const userId = req.user!.uid;

    if (!(await hasAnyPagePermission(req, pageId, "canDelete"))) {
      return res.status(403).json({ message: "Sem permissao para excluir." });
    }

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
  handleCreate(req, res, "ambientes", "solutions", ["name"]);
export const updateAmbiente = (req: Request, res: Response) =>
  handleUpdate(req, res, "ambientes", "solutions");
export const deleteAmbiente = (req: Request, res: Response) =>
  handleDelete(req, res, "ambientes", "solutions");

export const createSistema = (req: Request, res: Response) =>
  handleCreate(req, res, "sistemas", "solutions", ["name"]);
export const updateSistema = (req: Request, res: Response) =>
  handleUpdate(req, res, "sistemas", "solutions");
export const deleteSistema = (req: Request, res: Response) =>
  handleDelete(req, res, "sistemas", "solutions");

export const createCustomField = (req: Request, res: Response) =>
  handleCreate(req, res, "customFields", "proposals", ["label", "type"]);
export const updateCustomField = (req: Request, res: Response) =>
  handleUpdate(req, res, "customFields", "proposals");
export const deleteCustomField = (req: Request, res: Response) =>
  handleDelete(req, res, "customFields", "proposals");

export const createOption = (req: Request, res: Response) =>
  handleCreate(req, res, "options", OPTION_PAGES, ["label"]);
export const updateOption = (req: Request, res: Response) =>
  handleUpdate(req, res, "options", OPTION_PAGES);
export const deleteOption = (req: Request, res: Response) =>
  handleDelete(req, res, "options", OPTION_PAGES);

export const createProposalTemplate = (req: Request, res: Response) =>
  handleCreate(req, res, "proposalTemplates", "proposals", ["name", "content"]);
export const updateProposalTemplate = (req: Request, res: Response) =>
  handleUpdate(req, res, "proposalTemplates", "proposals");
export const deleteProposalTemplate = (req: Request, res: Response) =>
  handleDelete(req, res, "proposalTemplates", "proposals");
