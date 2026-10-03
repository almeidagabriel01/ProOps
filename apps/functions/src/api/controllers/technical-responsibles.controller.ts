import { Request, Response } from "express";
import { db } from "../../init";
import { logger } from "../../lib/logger";
import { isTenantAdminRole } from "../../lib/auth-context";
import { isStorageOverQuota } from "../services/projects/project.service";
import { deleteOrderFiles, loadOfTenant, storeOrderFile } from "../services/field-service/field-service.service";
import { SERVICE_CONTRACTS_COLLECTION } from "../services/field-service/contract-model";
import {
  ART_MAX_BYTES,
  ArtUploadSchema,
  TECHNICAL_RESPONSIBLES_COLLECTION,
  TechnicalResponsibleSchema,
  UpdateTechnicalResponsibleSchema,
  artFilePath,
  decodeArtPdf,
} from "../services/field-service/technical-responsible-model";

/**
 * Responsáveis técnicos do PMOC. Capacidade `fieldService` (montada por
 * prefixo em `field-service.routes.ts`); só o dono e os administradores
 * cadastram, como as demais Configurações da empresa. A lista é lida direto
 * no Firestore pelo front.
 */

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function fail(res: Response, error: unknown, fallback: string, event: string) {
  if (error instanceof HttpError) return res.status(error.status).json({ message: error.message });
  logger.error(event, { error: error instanceof Error ? error.message : String(error) });
  return res.status(500).json({ message: fallback });
}

function requireAdmin(req: Request): { tenantId: string; uid: string } {
  const tenantId = req.user?.tenantId;
  const uid = req.user?.uid;
  if (!tenantId || !uid) throw new HttpError(403, "Tenant não identificado.");
  if (!isTenantAdminRole(String(req.user?.role ?? "").toUpperCase())) {
    throw new HttpError(403, "Só o dono e os administradores cadastram responsáveis técnicos.");
  }
  return { tenantId, uid };
}

async function loadResponsible(req: Request, tenantId: string) {
  const found = await loadOfTenant(TECHNICAL_RESPONSIBLES_COLLECTION, req.params.id, tenantId);
  if (!found) throw new HttpError(404, "Responsável técnico não encontrado.");
  return found;
}

/** POST /v1/technical-responsibles */
export async function createTechnicalResponsible(req: Request, res: Response) {
  const parsed = TechnicalResponsibleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Dados inválidos." });
  try {
    const { tenantId, uid } = requireAdmin(req);
    const now = new Date().toISOString();
    const ref = db.collection(TECHNICAL_RESPONSIBLES_COLLECTION).doc();
    await ref.set({
      tenantId,
      name: parsed.data.name,
      profession: parsed.data.profession,
      council: parsed.data.council,
      registryNumber: parsed.data.registryNumber,
      artNumber: parsed.data.artNumber ?? null,
      artValidUntil: parsed.data.artValidUntil ?? null,
      artFile: null,
      active: parsed.data.active ?? true,
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
    });
    return res.status(201).json({ id: ref.id });
  } catch (error) {
    return fail(res, error, "Erro ao cadastrar o responsável técnico.", "technical_responsible_create_failed");
  }
}

/** PUT /v1/technical-responsibles/:id */
export async function updateTechnicalResponsible(req: Request, res: Response) {
  const parsed = UpdateTechnicalResponsibleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Dados inválidos." });
  try {
    const { tenantId } = requireAdmin(req);
    const found = await loadResponsible(req, tenantId);
    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) update[key] = value;
    }
    await found.ref.update(update);
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao atualizar o responsável técnico.", "technical_responsible_update_failed");
  }
}

/**
 * DELETE /v1/technical-responsibles/:id
 *
 * Contrato PMOC que ainda vale apontando para ele impede a exclusão: o plano
 * ficaria sem quem assina. Desative em vez de excluir.
 */
export async function deleteTechnicalResponsible(req: Request, res: Response) {
  try {
    const { tenantId } = requireAdmin(req);
    const found = await loadResponsible(req, tenantId);
    const inUse = await db
      .collection(SERVICE_CONTRACTS_COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("pmoc.responsibleId", "==", req.params.id)
      .limit(20)
      .get();
    if (inUse.docs.some((doc) => doc.data().status !== "ended")) {
      throw new HttpError(409, "Um contrato PMOC em vigor usa este responsável. Troque o responsável do contrato ou desative o cadastro.");
    }
    const file = found.data.artFile as { path?: string } | null;
    if (file?.path) await deleteOrderFiles([file.path]);
    await found.ref.delete();
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao excluir o responsável técnico.", "technical_responsible_delete_failed");
  }
}

/** POST /v1/technical-responsibles/:id/art. O PDF da ART; um por responsável, o novo substitui. */
export async function uploadTechnicalResponsibleArt(req: Request, res: Response) {
  const parsed = ArtUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: `Envie o PDF da ART com até ${Math.round(ART_MAX_BYTES / 1024)} KB.` });
  }
  try {
    const { tenantId } = requireAdmin(req);
    const found = await loadResponsible(req, tenantId);
    const buffer = decodeArtPdf(parsed.data.dataUrl);
    if (!buffer) {
      return res.status(400).json({ message: `Envie o PDF da ART com até ${Math.round(ART_MAX_BYTES / 1024)} KB.` });
    }
    if (await isStorageOverQuota(tenantId)) {
      return res.status(402).json({
        message: "O armazenamento do seu plano está cheio. Libere espaço ou faça upgrade.",
        code: "STORAGE_QUOTA_EXCEEDED",
      });
    }
    const path = artFilePath(tenantId, found.ref.id);
    const url = await storeOrderFile({ path, buffer, contentType: "application/pdf" });
    const artFile = { path, url, name: parsed.data.fileName, size: buffer.length, uploadedAt: new Date().toISOString() };
    await found.ref.update({ artFile, updatedAt: new Date().toISOString() });
    return res.status(201).json({ artFile });
  } catch (error) {
    return fail(res, error, "Erro ao enviar a ART.", "technical_responsible_art_upload_failed");
  }
}

/** DELETE /v1/technical-responsibles/:id/art */
export async function removeTechnicalResponsibleArt(req: Request, res: Response) {
  try {
    const { tenantId } = requireAdmin(req);
    const found = await loadResponsible(req, tenantId);
    const file = found.data.artFile as { path?: string } | null;
    if (file?.path) await deleteOrderFiles([file.path]);
    await found.ref.update({ artFile: null, updatedAt: new Date().toISOString() });
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao remover a ART.", "technical_responsible_art_remove_failed");
  }
}
