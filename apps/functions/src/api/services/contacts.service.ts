import { db } from "../../init";
import { Timestamp } from "firebase-admin/firestore";
import { sanitizeText, sanitizeRichText } from "../../utils/sanitize";
import { cpf, cnpj } from "cpf-cnpj-validator";

// CRITICAL: collection name is "clients", not "contacts"
const CLIENTS_COLLECTION = "clients";

// ===== Interfaces =====

export interface ContactListItem {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface ContactDoc {
  id: string;
  tenantId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  types?: string[];
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  createdById?: string;
}

export interface CreateContactParams {
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  address?: string;
  notes?: string;
}

export interface UpdateContactParams {
  name?: string;
  email?: string;
  phone?: string;
  document?: string;
  address?: string;
  notes?: string;
  types?: string[];
}

// ===== Helpers =====

function validateDocument(doc: string): void {
  const digits = doc.replace(/\D/g, "");
  const isValid = digits.length === 11
    ? cpf.isValid(digits)
    : digits.length === 14
      ? cnpj.isValid(digits)
      : false;
  if (!isValid) throw new Error("INVALID_DOCUMENT_FORMAT");
}

// ===== Service Functions =====

export async function listContacts(
  tenantId: string,
  opts?: {
    search?: string;
    limit?: number;
    orderBy?: "createdAt" | "name" | "updatedAt";
    direction?: "asc" | "desc";
  },
): Promise<ContactListItem[]> {
  const maxLimit = Math.min(opts?.limit || 10, 50);
  const orderField = opts?.orderBy ?? "createdAt";
  const orderDir = opts?.direction ?? "desc";

  const snap = await db
    .collection(CLIENTS_COLLECTION)
    .where("tenantId", "==", tenantId)
    .orderBy(orderField, orderDir)
    .limit(maxLimit)
    .get();

  let results: ContactListItem[] = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name || "",
      email: data.email || "",
      phone: data.phone || "",
    };
  });

  if (opts?.search) {
    const search = opts.search.toLowerCase();
    results = results.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.email.toLowerCase().includes(search) ||
        c.phone.toLowerCase().includes(search),
    );
  }

  return results;
}

export async function getContact(
  contactId: string,
  tenantId: string,
): Promise<ContactDoc> {
  const snap = await db.collection(CLIENTS_COLLECTION).doc(contactId).get();

  if (!snap.exists) {
    throw new Error("Contato não encontrado.");
  }

  const data = snap.data()!;

  if (data.tenantId !== tenantId) {
    throw new Error("Contato não pertence a este tenant.");
  }

  return { id: snap.id, ...data } as ContactDoc;
}

export async function createContact(
  params: CreateContactParams,
  tenantId: string,
  uid: string,
): Promise<{ id: string; name: string }> {
  const name = sanitizeText(params.name);
  const now = Timestamp.now();
  const contactRef = db.collection(CLIENTS_COLLECTION).doc();

  const contactData: Record<string, unknown> = {
    tenantId,
    name,
    types: ["cliente"],
    source: "ai",
    sourceId: null,
    createdById: uid,
    createdAt: now,
    updatedAt: now,
  };

  if (params.email) contactData.email = params.email.toLowerCase().trim();
  if (params.phone) contactData.phone = params.phone;
  if (params.address) contactData.address = sanitizeRichText(params.address);
  if (params.notes) contactData.notes = sanitizeRichText(params.notes);
  if (params.document) {
    validateDocument(params.document);
    contactData.document = params.document.replace(/\D/g, "");
  }

  await contactRef.set(contactData);

  return { id: contactRef.id, name };
}

export async function updateContact(
  contactId: string,
  updates: UpdateContactParams,
  tenantId: string,
): Promise<{ id: string; updated: boolean }> {
  const snap = await db.collection(CLIENTS_COLLECTION).doc(contactId).get();

  if (!snap.exists) {
    throw new Error("Contato não encontrado.");
  }

  const data = snap.data()!;

  if (data.tenantId !== tenantId) {
    throw new Error("Contato não pertence a este tenant.");
  }

  const safeUpdate: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };

  if (updates.name !== undefined) safeUpdate.name = sanitizeText(updates.name);
  if (updates.email !== undefined) safeUpdate.email = updates.email;
  if (updates.phone !== undefined) safeUpdate.phone = updates.phone;
  if (updates.document !== undefined) {
    validateDocument(updates.document);
    safeUpdate.document = updates.document.replace(/\D/g, "");
  }
  if (updates.address !== undefined) safeUpdate.address = sanitizeRichText(updates.address);
  if (updates.notes !== undefined) safeUpdate.notes = sanitizeRichText(updates.notes);
  if (updates.types !== undefined) safeUpdate.types = updates.types;

  await db.collection(CLIENTS_COLLECTION).doc(contactId).update(safeUpdate);

  return { id: contactId, updated: true };
}

export async function deleteContact(
  contactId: string,
  tenantId: string,
): Promise<{ id: string; name: string; deleted: boolean }> {
  const snap = await db.collection(CLIENTS_COLLECTION).doc(contactId).get();

  if (!snap.exists) {
    throw new Error("Contato não encontrado.");
  }

  const data = snap.data()!;

  if (data.tenantId !== tenantId) {
    throw new Error("Contato não pertence a este tenant.");
  }

  const name = data.name || "";

  await db.collection(CLIENTS_COLLECTION).doc(contactId).delete();

  return { id: contactId, name, deleted: true };
}
