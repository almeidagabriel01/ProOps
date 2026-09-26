import { randomUUID } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { db } from "../../../init";
import { logger } from "../../../lib/logger";
import { tenantHasCapability } from "../../../lib/tenant-capabilities";
import { resolveFrontendAppUrl } from "../../../lib/frontend-app-url";
import {
  buildStagesFromTemplate,
  defaultTemplateForNiche,
  projectIdForProposal,
  resolveProjectSettings,
  type ProjectDelivery,
  type ProjectSettings,
  type ProjectStage,
} from "./project-model";

export const PROJECTS_COLLECTION = "projects";
export const PROJECT_SETTINGS_COLLECTION = "project_settings";
export const SHARED_PROJECTS_COLLECTION = "shared_projects";
const SHARED_PROJECT_EXPIRATION_DAYS = 60;

export async function loadTenantNiche(tenantId: string): Promise<string> {
  const snap = await db.collection("tenants").doc(tenantId).get();
  return String(snap.data()?.niche || "");
}

export async function loadProjectSettings(tenantId: string): Promise<ProjectSettings> {
  const [snap, niche] = await Promise.all([
    db.collection(PROJECT_SETTINGS_COLLECTION).doc(tenantId).get(),
    loadTenantNiche(tenantId),
  ]);
  return resolveProjectSettings(snap.data() as Partial<ProjectSettings> | undefined, niche);
}

export async function saveProjectSettings(
  tenantId: string,
  input: Partial<ProjectSettings>,
  uid: string,
): Promise<ProjectSettings> {
  const ref = db.collection(PROJECT_SETTINGS_COLLECTION).doc(tenantId);
  await ref.set(
    { ...input, tenantId, updatedAt: new Date().toISOString(), updatedBy: uid },
    { merge: true },
  );
  return loadProjectSettings(tenantId);
}

function emptyDelivery(): ProjectDelivery {
  return { status: "none", sharedProjectId: null, acceptance: null };
}

/**
 * Cria o projeto de uma proposta. Idempotente: o id sai da proposta, então
 * aprovar, reverter e aprovar de novo encontra o mesmo projeto em vez de
 * criar outro. Devolve `created: false` quando ele já existia.
 */
export async function createProjectFromProposal(params: {
  tenantId: string;
  proposalId: string;
  proposal: Record<string, unknown>;
  uid: string;
  settings?: ProjectSettings;
}): Promise<{ projectId: string; created: boolean }> {
  const { tenantId, proposalId, proposal, uid } = params;
  const projectId = projectIdForProposal(proposalId);
  const ref = db.collection(PROJECTS_COLLECTION).doc(projectId);
  const settings = params.settings ?? (await loadProjectSettings(tenantId));
  const now = new Date().toISOString();

  const created = await db.runTransaction(async (t) => {
    const existing = await t.get(ref);
    if (existing.exists) return false;
    t.set(ref, {
      tenantId,
      proposalId,
      proposalTitle: (proposal.title as string | undefined) ?? null,
      proposalCode: (proposal.proposalCode as string | undefined) ?? null,
      clientId: (proposal.clientId as string | undefined) ?? null,
      clientName: (proposal.clientName as string | undefined) ?? null,
      clientPhone: (proposal.clientPhone as string | undefined) ?? null,
      clientEmail: (proposal.clientEmail as string | undefined) ?? null,
      address: (proposal.clientAddress as string | undefined) ?? null,
      title: String(proposal.title || "Projeto de instalação"),
      status: "active",
      stages: buildStagesFromTemplate(settings.stageTemplate),
      assigneeId: null,
      assigneeName: null,
      startDate: null,
      dueDate: null,
      notes: null,
      delivery: emptyDelivery(),
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
    });
    return true;
  });
  return { projectId, created };
}

/** Projeto avulso, sem proposta (obra de garantia, visita técnica). */
export async function createStandaloneProject(params: {
  tenantId: string;
  title: string;
  client: { id: string; name: string; phone?: string; email?: string; address?: string } | null;
  uid: string;
}): Promise<string> {
  const settings = await loadProjectSettings(params.tenantId);
  const now = new Date().toISOString();
  const ref = db.collection(PROJECTS_COLLECTION).doc();
  await ref.set({
    tenantId: params.tenantId,
    proposalId: null,
    proposalTitle: null,
    proposalCode: null,
    clientId: params.client?.id ?? null,
    clientName: params.client?.name ?? null,
    clientPhone: params.client?.phone ?? null,
    clientEmail: params.client?.email ?? null,
    address: params.client?.address ?? null,
    title: params.title,
    status: "active",
    stages: buildStagesFromTemplate(settings.stageTemplate),
    assigneeId: null,
    assigneeName: null,
    startDate: null,
    dueDate: null,
    notes: null,
    delivery: emptyDelivery(),
    createdAt: now,
    updatedAt: now,
    createdBy: params.uid,
  });
  return ref.id;
}

export interface ProjectOnApprovalOutcome {
  /** Id do projeto criado agora (modo `always`). */
  createdProjectId: string | null;
  /** A tela deve perguntar se a venda tem instalação (modo `ask`, sem projeto ainda). */
  suggest: boolean;
}

const NOTHING: ProjectOnApprovalOutcome = { createdProjectId: null, suggest: false };

/**
 * Chamado quando uma proposta vira aprovada. Com o plano, segue o modo da
 * empresa: `always` cria, `ask` devolve o convite para a tela perguntar,
 * `never` não faz nada. Nunca lança: a aprovação já aconteceu, e o projeto é
 * conveniência, não parte da venda.
 */
export async function resolveProjectOnApproval(params: {
  tenantId: string;
  proposalId: string;
  proposal: Record<string, unknown>;
  uid: string;
}): Promise<ProjectOnApprovalOutcome> {
  try {
    if (!(await tenantHasCapability(params.tenantId, "projects"))) return NOTHING;
    const settings = await loadProjectSettings(params.tenantId);
    if (settings.onApproval === "never") return NOTHING;
    if (settings.onApproval === "always") {
      const result = await createProjectFromProposal({ ...params, settings });
      return { createdProjectId: result.created ? result.projectId : null, suggest: false };
    }
    // Perguntar só faz sentido se a obra ainda não existe (reaprovar não pergunta de novo).
    const existing = await db
      .collection(PROJECTS_COLLECTION)
      .doc(projectIdForProposal(params.proposalId))
      .get();
    return { createdProjectId: null, suggest: !existing.exists };
  } catch (error) {
    logger.warn("project_on_approval_failed", {
      tenantId: params.tenantId,
      proposalId: params.proposalId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NOTHING;
  }
}

export async function loadProjectOfTenant(projectId: string, tenantId: string) {
  const ref = db.collection(PROJECTS_COLLECTION).doc(projectId);
  const snap = await ref.get();
  const data = snap.data();
  if (!snap.exists || data?.tenantId !== tenantId) return null;
  return { ref, data: data as Record<string, unknown> };
}

// ---------------------------------------------------------------------------
// Fotos: sobem pelo backend porque o técnico é membro, e as regras do Storage
// só deixam master e admin gravarem direto do navegador.
// ---------------------------------------------------------------------------

export function projectPhotoPath(
  tenantId: string,
  projectId: string,
  stageId: string,
  photoId: string,
  extension: string,
): string {
  return `tenants/${tenantId}/projects/${projectId}/${stageId}/${photoId}.${extension}`;
}

export async function storeProjectPhoto(params: {
  path: string;
  buffer: Buffer;
  contentType: string;
}): Promise<string> {
  const bucket = getStorage().bucket();
  const token = randomUUID();
  await bucket.file(params.path).save(params.buffer, {
    resumable: false,
    contentType: params.contentType,
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(params.path)}?alt=media&token=${token}`;
}

export async function deleteProjectPhotos(paths: string[]): Promise<void> {
  const bucket = getStorage().bucket();
  await Promise.all(
    paths.map((p) =>
      bucket
        .file(p)
        .delete({ ignoreNotFound: true })
        .catch((error: unknown) =>
          logger.warn("project_photo_delete_failed", {
            path: p,
            error: error instanceof Error ? error.message : String(error),
          }),
        ),
    ),
  );
}

export async function isStorageOverQuota(tenantId: string): Promise<boolean> {
  const snap = await db.collection("tenant_storage_usage").doc(tenantId).get();
  return snap.data()?.overQuota === true;
}

// ---------------------------------------------------------------------------
// Link de entrega (aceite do cliente)
// ---------------------------------------------------------------------------

export function buildProjectShareUrl(token: string): string {
  return new URL(`/share/project/${token}`, resolveFrontendAppUrl()).toString();
}

/** Um link por projeto: reenviar devolve o mesmo, com o prazo renovado. */
export async function createProjectShareLink(params: {
  tenantId: string;
  projectId: string;
  uid: string;
}): Promise<{ url: string; sharedProjectId: string }> {
  const expiresAt = new Date(Date.now() + SHARED_PROJECT_EXPIRATION_DAYS * 86_400_000).toISOString();
  const existing = await db
    .collection(SHARED_PROJECTS_COLLECTION)
    .where("tenantId", "==", params.tenantId)
    .where("projectId", "==", params.projectId)
    .limit(1)
    .get();
  if (!existing.empty) {
    const doc = existing.docs[0];
    await doc.ref.update({ expiresAt });
    return { url: buildProjectShareUrl(String(doc.data().token)), sharedProjectId: doc.id };
  }
  const token = randomUUID();
  const ref = await db.collection(SHARED_PROJECTS_COLLECTION).add({
    tenantId: params.tenantId,
    projectId: params.projectId,
    token,
    createdAt: new Date().toISOString(),
    createdBy: params.uid,
    expiresAt,
  });
  return { url: buildProjectShareUrl(token), sharedProjectId: ref.id };
}

export async function resolveProjectShareToken(token: string) {
  if (!token) return null;
  const snap = await db
    .collection(SHARED_PROJECTS_COLLECTION)
    .where("token", "==", token)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const data = doc.data();
  if (data.expiresAt && new Date(String(data.expiresAt)) < new Date()) {
    throw new Error("EXPIRED_LINK");
  }
  return {
    id: doc.id,
    tenantId: String(data.tenantId),
    projectId: String(data.projectId),
  };
}

/** O que o cliente vê no link: sem notas internas, sem ids de membro. */
export function toClientProjectView(project: Record<string, unknown>) {
  const stages = (project.stages as ProjectStage[] | undefined) ?? [];
  const delivery = (project.delivery as ProjectDelivery | undefined) ?? emptyDelivery();
  return {
    title: project.title,
    clientName: project.clientName ?? null,
    address: project.address ?? null,
    status: project.status,
    stages: stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      status: stage.status,
      completedAt: stage.completedAt,
      checklist: stage.checklist.map((item) => ({ id: item.id, text: item.text, done: item.done })),
      photos: stage.photos.map((photo) => ({ id: photo.id, url: photo.url, caption: photo.caption })),
    })),
    delivery: {
      status: delivery.status,
      acceptance: delivery.acceptance
        ? { name: delivery.acceptance.name, acceptedAt: delivery.acceptance.acceptedAt }
        : null,
    },
  };
}

export { defaultTemplateForNiche };
