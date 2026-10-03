import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../../../init";
import { resolveFrontendAppOrigin } from "../../../lib/frontend-app-url";
import { tenantHasCapability } from "../../../lib/tenant-capabilities";
import { SharedProposalService } from "../shared-proposal.service";
import { SharedTransactionService } from "../shared-transactions.service";
import { createProjectShareLink } from "../projects/project.service";
import { buildOrderShareUrl, ensureOrderShareToken } from "../field-service/field-service.service";
import { buildPmocShareUrl, ensurePmocShareToken } from "../field-service/pmoc-document";
import {
  CLIENT_PORTAL_LINKS_COLLECTION,
  PORTAL_TOKEN_PATTERN,
  buildPortalContracts,
  buildPortalInvoices,
  buildPortalPayments,
  buildPortalProjects,
  buildPortalProposals,
  buildPortalServiceOrders,
  firstName,
  portalLinkDocId,
  proposalsNeedingShareCheck,
  type KanbanStatusInfo,
  type PortalView,
} from "./client-portal-model";

/** Quem aparece como autor do link criado pelo clique do cliente. */
export const CLIENT_PORTAL_ACTOR = "client_portal";

const LIST_LIMIT = 200;

export class ClientPortalError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface PortalLinkInfo {
  url: string | null;
  createdAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
}

function portalUrl(token: string): string {
  return `${resolveFrontendAppOrigin()}/share/portal/${token}`;
}

function newToken(): string {
  return randomBytes(18).toString("base64url");
}

function linkRef(tenantId: string, clientId: string) {
  return db.collection(CLIENT_PORTAL_LINKS_COLLECTION).doc(portalLinkDocId(tenantId, clientId));
}

/** O contato precisa existir e ser da empresa de quem pede. */
async function assertClientOfTenant(tenantId: string, clientId: string) {
  if (!clientId || clientId.includes("/")) throw new ClientPortalError(404, "Contato não encontrado.");
  const snap = await db.collection("clients").doc(clientId).get();
  if (!snap.exists || snap.data()?.tenantId !== tenantId) {
    throw new ClientPortalError(404, "Contato não encontrado.");
  }
  return snap.data() ?? {};
}

function toInfo(data: Record<string, unknown> | undefined): PortalLinkInfo {
  const token = typeof data?.token === "string" ? data.token : null;
  return {
    url: token ? portalUrl(token) : null,
    createdAt: (data?.createdAt as string | undefined) ?? null,
    lastViewedAt: (data?.lastViewedAt as string | undefined) ?? null,
    viewCount: Number(data?.viewCount ?? 0) || 0,
  };
}

export async function getPortalLink(tenantId: string, clientId: string): Promise<PortalLinkInfo> {
  await assertClientOfTenant(tenantId, clientId);
  const snap = await linkRef(tenantId, clientId).get();
  return toInfo(snap.exists ? snap.data() : undefined);
}

/** Devolve o link do contato, criando na primeira vez. */
export async function ensurePortalLink(tenantId: string, clientId: string, uid: string): Promise<PortalLinkInfo> {
  await assertClientOfTenant(tenantId, clientId);
  const ref = linkRef(tenantId, clientId);
  const data = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists && typeof snap.data()?.token === "string") return snap.data();
    const next = {
      tenantId,
      clientId,
      token: newToken(),
      createdAt: new Date().toISOString(),
      createdBy: uid,
      viewCount: 0,
      lastViewedAt: null,
    };
    tx.set(ref, next);
    return next;
  });
  return toInfo(data);
}

/** Troca o token: o link anterior para de funcionar na hora. */
export async function rotatePortalLink(tenantId: string, clientId: string, uid: string): Promise<PortalLinkInfo> {
  await assertClientOfTenant(tenantId, clientId);
  const next = {
    tenantId,
    clientId,
    token: newToken(),
    createdAt: new Date().toISOString(),
    createdBy: uid,
    viewCount: 0,
    lastViewedAt: null,
  };
  await linkRef(tenantId, clientId).set(next);
  return toInfo(next);
}

/** Desliga o portal do contato: sem token, nenhum link abre. */
export async function revokePortalLink(tenantId: string, clientId: string): Promise<void> {
  await assertClientOfTenant(tenantId, clientId);
  await linkRef(tenantId, clientId).delete();
}

/**
 * Token → empresa e contato. Link inexistente, empresa sem o plano ou contato
 * apagado dão o mesmo 404: quem tem um link velho não descobre o motivo.
 */
export async function resolvePortalToken(token: string): Promise<{ tenantId: string; clientId: string; linkId: string }> {
  if (!PORTAL_TOKEN_PATTERN.test(token)) throw new ClientPortalError(404, "Link indisponível.");
  const snap = await db.collection(CLIENT_PORTAL_LINKS_COLLECTION).where("token", "==", token).limit(1).get();
  const doc = snap.docs[0];
  const tenantId = String(doc?.data()?.tenantId ?? "");
  const clientId = String(doc?.data()?.clientId ?? "");
  if (!doc || !tenantId || !clientId) throw new ClientPortalError(404, "Link indisponível.");
  const [enabled, client] = await Promise.all([
    tenantHasCapability(tenantId, "clientPortal"),
    db.collection("clients").doc(clientId).get(),
  ]);
  if (!enabled || !client.exists || client.data()?.tenantId !== tenantId) {
    throw new ClientPortalError(404, "Link indisponível.");
  }
  return { tenantId, clientId, linkId: doc.id };
}

function docsOf(snap: FirebaseFirestore.QuerySnapshot) {
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() as Record<string, unknown> }));
}

function byClient(collection: string, tenantId: string, clientId: string) {
  return db
    .collection(collection)
    .where("tenantId", "==", tenantId)
    .where("clientId", "==", clientId)
    .limit(LIST_LIMIT)
    .get();
}

/**
 * Das propostas em coluna que não diz se já foram enviadas, as que a empresa
 * já compartilhou com o cliente (link externo; o link interno do PDF não
 * conta). Consulta só por `proposalId`, em lotes de 30, sem índice composto.
 */
async function loadSharedProposalIds(tenantId: string, proposalIds: string[]): Promise<Set<string>> {
  const shared = new Set<string>();
  for (let i = 0; i < proposalIds.length; i += 30) {
    const chunk = proposalIds.slice(i, i + 30);
    const snap = await db.collection("shared_proposals").where("proposalId", "in", chunk).limit(300).get();
    for (const doc of snap.docs) {
      const data = doc.data();
      if (data.tenantId !== tenantId || data.purpose === "system_pdf_render") continue;
      shared.add(String(data.proposalId));
    }
  }
  return shared;
}

function todayInBrazil(nowMs: number): string {
  return new Date(nowMs - 3 * 3_600_000).toISOString().slice(0, 10);
}

export async function publicPortalView(token: string, nowMs = Date.now()): Promise<PortalView> {
  const { tenantId, clientId, linkId } = await resolvePortalToken(token);

  const [tenantSnap, clientSnap, proposals, transactions, projects, invoices, kanban, canCharge, hasFieldService] =
    await Promise.all([
      db.collection("tenants").doc(tenantId).get(),
      db.collection("clients").doc(clientId).get(),
      byClient("proposals", tenantId, clientId),
      byClient("transactions", tenantId, clientId),
      byClient("projects", tenantId, clientId),
      byClient("invoices", tenantId, clientId),
      db.collection("kanban_statuses").where("tenantId", "==", tenantId).limit(100).get(),
      tenantHasCapability(tenantId, "onlinePayments"),
      tenantHasCapability(tenantId, "fieldService"),
    ]);
  // A assistência só entra se o plano a tiver: o link do comprovante e o do
  // PMOC também pedem a capacidade, e não abririam.
  const [serviceOrders, contracts] = hasFieldService
    ? await Promise.all([byClient("service_orders", tenantId, clientId), byClient("service_contracts", tenantId, clientId)])
    : [null, null];

  const kanbanById = new Map<string, KanbanStatusInfo>(
    kanban.docs.map((doc) => [doc.id, doc.data() as KanbanStatusInfo]),
  );
  const tenant = tenantSnap.data() ?? {};
  const proposalDocs = docsOf(proposals);
  const sharedIds = await loadSharedProposalIds(tenantId, proposalsNeedingShareCheck(proposalDocs, kanbanById));

  // Registro de visita, sem travar a página se falhar.
  void db
    .collection(CLIENT_PORTAL_LINKS_COLLECTION)
    .doc(linkId)
    .update({ lastViewedAt: new Date(nowMs).toISOString(), viewCount: FieldValue.increment(1) })
    .catch(() => undefined);

  return {
    company: {
      name: String(tenant.name || "Empresa"),
      logoUrl: (tenant.logoUrl as string | undefined) ?? null,
      primaryColor: (tenant.primaryColor as string | undefined) ?? null,
    },
    client: { firstName: firstName(clientSnap.data()?.name) },
    proposals: buildPortalProposals(proposalDocs, kanbanById, sharedIds),
    payments: buildPortalPayments(docsOf(transactions), todayInBrazil(nowMs)),
    canPayOnline: canCharge && tenant.asaasEnabled === true,
    projects: buildPortalProjects(docsOf(projects)),
    invoices: buildPortalInvoices(docsOf(invoices)),
    serviceOrders: serviceOrders ? buildPortalServiceOrders(docsOf(serviceOrders), nowMs) : [],
    contracts: contracts ? buildPortalContracts(docsOf(contracts)) : [],
  };
}

export type PortalItemKind = "proposal" | "payment" | "project" | "service_order" | "pmoc";

const KIND_COLLECTION: Record<PortalItemKind, string> = {
  proposal: "proposals",
  payment: "transactions",
  project: "projects",
  service_order: "service_orders",
  pmoc: "service_contracts",
};

/**
 * O cliente clicou num item: confere que ele é DESTE contato e devolve o link
 * da página pública que já existe, criando só agora. O que o portal não lista
 * (rascunho, comissão, obra cancelada) também não abre por aqui.
 */
export async function openPortalItem(token: string, kind: PortalItemKind, itemId: string): Promise<{ url: string }> {
  const { tenantId, clientId } = await resolvePortalToken(token);
  if (!itemId || itemId.includes("/")) throw new ClientPortalError(404, "Item não encontrado.");
  const snap = await db.collection(KIND_COLLECTION[kind]).doc(itemId).get();
  const data = snap.data();
  if (!snap.exists || !data || data.tenantId !== tenantId || data.clientId !== clientId) {
    throw new ClientPortalError(404, "Item não encontrado.");
  }
  const entry = [{ id: itemId, data: data as Record<string, unknown> }];

  if (kind === "proposal") {
    const kanban = await db.collection("kanban_statuses").doc(String(data.status ?? "_")).get().catch(() => null);
    const kanbanById = new Map<string, KanbanStatusInfo>(
      kanban?.exists ? [[kanban.id, kanban.data() as KanbanStatusInfo]] : [],
    );
    const sharedIds = await loadSharedProposalIds(tenantId, proposalsNeedingShareCheck(entry, kanbanById));
    const listed = buildPortalProposals(entry, kanbanById, sharedIds);
    if (listed.length === 0) throw new ClientPortalError(404, "Item não encontrado.");
    const link = await SharedProposalService.createShareLink(itemId, tenantId, CLIENT_PORTAL_ACTOR);
    return { url: link.shareUrl };
  }

  if (kind === "payment") {
    if (buildPortalPayments(entry, "0000-00-00").length === 0) throw new ClientPortalError(404, "Item não encontrado.");
    // O link que a empresa já mandou fica como está: `createShareLink`
    // sobrescreveria a validade escolhida (inclusive "sem validade").
    const existing = await SharedTransactionService.getShareLinkInfo(itemId, tenantId);
    const stillValid = existing.exists && (!existing.expiresAt || new Date(existing.expiresAt).getTime() > Date.now());
    if (stillValid && existing.shareUrl) return { url: existing.shareUrl };
    const link = await SharedTransactionService.createShareLink(itemId, tenantId, CLIENT_PORTAL_ACTOR, 30);
    return { url: link.shareUrl };
  }

  if (kind === "service_order" || kind === "pmoc") {
    if (!(await tenantHasCapability(tenantId, "fieldService"))) {
      throw new ClientPortalError(404, "Item não encontrado.");
    }
    if (kind === "service_order") {
      if (buildPortalServiceOrders(entry).length === 0) throw new ClientPortalError(404, "Item não encontrado.");
      const token = await ensureOrderShareToken({ tenantId, orderId: itemId, uid: CLIENT_PORTAL_ACTOR });
      return { url: buildOrderShareUrl(token) };
    }
    if (!buildPortalContracts(entry)[0]?.isPmoc) throw new ClientPortalError(404, "Item não encontrado.");
    const token = await ensurePmocShareToken({ tenantId, contractId: itemId, uid: CLIENT_PORTAL_ACTOR });
    return { url: buildPmocShareUrl(token) };
  }

  if (buildPortalProjects(entry).length === 0) throw new ClientPortalError(404, "Item não encontrado.");
  const link = await createProjectShareLink({ tenantId, projectId: itemId, uid: CLIENT_PORTAL_ACTOR });
  return { url: link.url };
}
