import { db } from "../../init";
import { Timestamp } from "firebase-admin/firestore";
import { sanitizeText, sanitizeRichText } from "../../utils/sanitize";

// ===== Interfaces =====

export interface ProposalListItem {
  id: string;
  title: string;
  clientName: string;
  status: string;
  totalValue: number;
  createdAt: string;
}

export interface ProposalDoc {
  id: string;
  tenantId: string;
  title: string;
  clientId?: string;
  clientName?: string;
  status: string;
  totalValue: number;
  products?: unknown[];
  notes?: string;
  validUntil?: string;
  discount?: number;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  createdById?: string;
}

export interface CreateProposalParams {
  clientId: string;
  title?: string;
  items: Array<{
    productId?: string;
    name: string;
    quantity: number;
    price: number;
    description?: string;
  }>;
  notes?: string;
  validUntil?: string;
  discount?: number;
}

export interface UpdateProposalParams {
  title?: string;
  notes?: string;
  validUntil?: string;
  discount?: number;
  items?: Array<{
    productId?: string;
    name: string;
    quantity: number;
    price: number;
    description?: string;
  }>;
}

// ===== Service Functions =====

export async function listProposals(
  tenantId: string,
  opts?: {
    status?: string;
    search?: string;
    limit?: number;
    orderBy?: "createdAt" | "updatedAt" | "title" | "clientName";
    direction?: "asc" | "desc";
  },
): Promise<ProposalListItem[]> {
  const maxLimit = Math.min(opts?.limit || 10, 50);
  const orderField = opts?.orderBy ?? "createdAt";
  const orderDir = opts?.direction ?? "desc";

  let query: FirebaseFirestore.Query = db
    .collection("proposals")
    .where("tenantId", "==", tenantId)
    .orderBy(orderField, orderDir)
    .limit(maxLimit);

  if (opts?.status) {
    query = db
      .collection("proposals")
      .where("tenantId", "==", tenantId)
      .where("status", "==", opts.status)
      .orderBy(orderField, orderDir)
      .limit(maxLimit);
  }

  const snap = await query.get();

  let results: ProposalListItem[] = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title || "",
      clientName: data.clientName || "",
      status: data.status || "draft",
      totalValue: data.totalValue || 0,
      createdAt: data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : String(data.createdAt || ""),
    };
  });

  if (opts?.search) {
    const search = opts.search.toLowerCase();
    results = results.filter(
      (p) =>
        p.title.toLowerCase().includes(search) ||
        p.clientName.toLowerCase().includes(search),
    );
  }

  return results;
}

export async function getProposal(
  proposalId: string,
  tenantId: string,
): Promise<ProposalDoc> {
  const snap = await db.collection("proposals").doc(proposalId).get();

  if (!snap.exists) {
    throw new Error("Proposta não encontrada.");
  }

  const data = snap.data()!;

  if (data.tenantId !== tenantId) {
    throw new Error("Proposta não pertence a este tenant.");
  }

  const { pdf: _pdf, pdfGenerationLock: _lock, ...rest } = data;

  return {
    id: snap.id,
    ...rest,
  } as ProposalDoc;
}

export async function createProposal(
  params: CreateProposalParams,
  tenantId: string,
  uid: string,
): Promise<{ id: string; title: string; status: string }> {
  // Look up client name
  let clientName = "";
  if (params.clientId) {
    const clientSnap = await db.collection("clients").doc(params.clientId).get();
    if (clientSnap.exists) {
      const clientData = clientSnap.data()!;
      if (clientData.tenantId !== tenantId) {
        throw new Error("Cliente não pertence a este tenant.");
      }
      clientName = clientData.name || "";
    }
  }

  // Map items to products format and calculate total
  const products = params.items.map((item) => ({
    productId: item.productId || null,
    name: sanitizeText(item.name),
    quantity: item.quantity,
    price: item.price,
    description: item.description ? sanitizeRichText(item.description) : "",
    subtotal: item.quantity * item.price,
  }));

  const subtotal = products.reduce((sum, p) => sum + p.subtotal, 0);
  const discount = params.discount || 0;
  const totalValue = Math.max(0, subtotal - (subtotal * discount) / 100);

  const title = params.title
    ? sanitizeText(params.title)
    : `Proposta para ${clientName || "Cliente"}`;

  const now = Timestamp.now();
  const proposalRef = db.collection("proposals").doc();

  const proposalData: Record<string, unknown> = {
    tenantId,
    title,
    clientId: params.clientId || null,
    clientName,
    status: "draft",
    products,
    totalValue: Math.round(totalValue * 100) / 100,
    discount: discount,
    createdById: uid,
    createdAt: now,
    updatedAt: now,
  };

  if (params.notes) proposalData.notes = sanitizeRichText(params.notes);
  if (params.validUntil) proposalData.validUntil = params.validUntil;

  await proposalRef.set(proposalData);

  return { id: proposalRef.id, title, status: "draft" };
}

export async function updateProposal(
  proposalId: string,
  updates: UpdateProposalParams,
  tenantId: string,
): Promise<{ id: string; updated: boolean }> {
  const snap = await db.collection("proposals").doc(proposalId).get();

  if (!snap.exists) {
    throw new Error("Proposta não encontrada.");
  }

  const data = snap.data()!;

  if (data.tenantId !== tenantId) {
    throw new Error("Proposta não pertence a este tenant.");
  }

  if (data.status !== "draft") {
    throw new Error("Somente propostas em rascunho podem ser editadas.");
  }

  const safeUpdate: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };

  if (updates.title !== undefined) safeUpdate.title = sanitizeText(updates.title);
  if (updates.notes !== undefined) safeUpdate.notes = sanitizeRichText(updates.notes);
  if (updates.validUntil !== undefined) safeUpdate.validUntil = updates.validUntil;
  if (updates.discount !== undefined) safeUpdate.discount = updates.discount;

  if (updates.items !== undefined) {
    const products = updates.items.map((item) => ({
      productId: item.productId || null,
      name: sanitizeText(item.name),
      quantity: item.quantity,
      price: item.price,
      description: item.description ? sanitizeRichText(item.description) : "",
      subtotal: item.quantity * item.price,
    }));

    const subtotal = products.reduce((sum, p) => sum + p.subtotal, 0);
    const discount = (updates.discount ?? data.discount ?? 0) as number;
    const totalValue = Math.max(0, subtotal - (subtotal * discount) / 100);

    safeUpdate.products = products;
    safeUpdate.totalValue = Math.round(totalValue * 100) / 100;
  }

  await db.collection("proposals").doc(proposalId).update(safeUpdate);

  return { id: proposalId, updated: true };
}

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["sent"],
  sent: ["approved", "rejected"],
};

export async function updateProposalStatus(
  proposalId: string,
  newStatus: string,
  tenantId: string,
  reason?: string,
): Promise<{ id: string; oldStatus: string; newStatus: string }> {
  const snap = await db.collection("proposals").doc(proposalId).get();

  if (!snap.exists) {
    throw new Error("Proposta não encontrada.");
  }

  const data = snap.data()!;

  if (data.tenantId !== tenantId) {
    throw new Error("Proposta não pertence a este tenant.");
  }

  const oldStatus = data.status as string;
  const allowed = VALID_STATUS_TRANSITIONS[oldStatus] || [];

  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Transição de status inválida: ${oldStatus} → ${newStatus}. Permitido: ${allowed.join(", ") || "nenhum"}.`,
    );
  }

  if (newStatus === "rejected" && !reason) {
    throw new Error("Motivo é obrigatório para rejeitar uma proposta.");
  }

  const safeUpdate: Record<string, unknown> = {
    status: newStatus,
    updatedAt: Timestamp.now(),
  };

  if (reason) safeUpdate.rejectionReason = sanitizeText(reason);

  await db.collection("proposals").doc(proposalId).update(safeUpdate);

  return { id: proposalId, oldStatus, newStatus };
}

export async function deleteProposal(
  proposalId: string,
  tenantId: string,
): Promise<{ id: string; title: string; deleted: boolean }> {
  const snap = await db.collection("proposals").doc(proposalId).get();

  if (!snap.exists) {
    throw new Error("Proposta não encontrada.");
  }

  const data = snap.data()!;

  if (data.tenantId !== tenantId) {
    throw new Error("Proposta não pertence a este tenant.");
  }

  const title = data.title || "";

  await db.collection("proposals").doc(proposalId).delete();

  return { id: proposalId, title, deleted: true };
}
