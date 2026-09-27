import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { db } from "../../../init";
import { resolveFrontendAppOrigin } from "../../../lib/frontend-app-url";
import { tenantHasCapability } from "../../../lib/tenant-capabilities";
import { buildDre, brazilMonthStartIso, nextMonth, validateRange } from "../finance-reports/dre.service";
import type { DreBasis } from "../finance-reports/dre-model";
import {
  ACCOUNTANT_LINKS_COLLECTION,
  ACCOUNTANT_TOKEN_PATTERN,
  buildAccountantInvoices,
  buildAccountantReceived,
  buildAccountantTransactions,
} from "./accountant-model";

export class AccountantError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface AccountantLinkInfo {
  url: string | null;
  createdAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
}

const LIST_LIMIT = 5000;

function linkUrl(token: string): string {
  return `${resolveFrontendAppOrigin()}/share/contador/${token}`;
}

function ref(tenantId: string) {
  return db.collection(ACCOUNTANT_LINKS_COLLECTION).doc(tenantId);
}

function toInfo(data: Record<string, unknown> | undefined): AccountantLinkInfo {
  const token = typeof data?.token === "string" ? data.token : null;
  return {
    url: token ? linkUrl(token) : null,
    createdAt: (data?.createdAt as string | undefined) ?? null,
    lastViewedAt: (data?.lastViewedAt as string | undefined) ?? null,
    viewCount: Number(data?.viewCount ?? 0) || 0,
  };
}

function freshLink(tenantId: string, uid: string) {
  return {
    tenantId,
    token: randomBytes(18).toString("base64url"),
    createdAt: new Date().toISOString(),
    createdBy: uid,
    viewCount: 0,
    lastViewedAt: null,
  };
}

export async function getAccountantLink(tenantId: string): Promise<AccountantLinkInfo> {
  const snap = await ref(tenantId).get();
  return toInfo(snap.exists ? snap.data() : undefined);
}

/** O link da empresa, criado na primeira vez. */
export async function ensureAccountantLink(tenantId: string, uid: string): Promise<AccountantLinkInfo> {
  const data = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref(tenantId));
    if (snap.exists && typeof snap.data()?.token === "string") return snap.data();
    const next = freshLink(tenantId, uid);
    tx.set(ref(tenantId), next);
    return next;
  });
  return toInfo(data);
}

/** Token novo: o link anterior para de abrir na hora. */
export async function rotateAccountantLink(tenantId: string, uid: string): Promise<AccountantLinkInfo> {
  const next = freshLink(tenantId, uid);
  await ref(tenantId).set(next);
  return toInfo(next);
}

export async function revokeAccountantLink(tenantId: string): Promise<void> {
  await ref(tenantId).delete();
}

/**
 * Token -> empresa. Link inexistente ou empresa sem o financeiro dão o mesmo
 * 404. As seções de nota dependem do plano de cada uma.
 */
export async function resolveAccountantToken(token: string) {
  if (!ACCOUNTANT_TOKEN_PATTERN.test(token)) throw new AccountantError(404, "Link indisponível.");
  const snap = await db.collection(ACCOUNTANT_LINKS_COLLECTION).where("token", "==", token).limit(1).get();
  const doc = snap.docs[0];
  const tenantId = String(doc?.data()?.tenantId ?? "");
  if (!doc || !tenantId) throw new AccountantError(404, "Link indisponível.");
  const [financial, fiscal, fiscalReceiving] = await Promise.all([
    tenantHasCapability(tenantId, "financial"),
    tenantHasCapability(tenantId, "fiscal"),
    tenantHasCapability(tenantId, "fiscalReceiving"),
  ]);
  if (!financial) throw new AccountantError(404, "Link indisponível.");
  return { tenantId, linkId: doc.id, sections: { invoices: fiscal, received: fiscalReceiving } };
}

export async function accountantOverview(token: string) {
  const { tenantId, linkId, sections } = await resolveAccountantToken(token);
  const tenant = (await db.collection("tenants").doc(tenantId).get()).data() ?? {};
  void db
    .collection(ACCOUNTANT_LINKS_COLLECTION)
    .doc(linkId)
    .update({ lastViewedAt: new Date().toISOString(), viewCount: FieldValue.increment(1) })
    .catch(() => undefined);
  return {
    company: {
      name: String(tenant.name || "Empresa"),
      logoUrl: (tenant.logoUrl as string | undefined) ?? null,
      primaryColor: (tenant.primaryColor as string | undefined) ?? null,
    },
    sections: { dre: true, transactions: true, ...sections },
  };
}

export async function accountantDre(token: string, params: { from: string; to: string; basis: DreBasis }) {
  const { tenantId } = await resolveAccountantToken(token);
  return buildDre(tenantId, params);
}

function todayInBrazil(): string {
  return new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
}

export async function accountantTransactions(token: string, params: { from: string; to: string }) {
  const { tenantId } = await resolveAccountantToken(token);
  validateRange(params.from, params.to);
  const [{ transactions, truncated }, wallets] = await Promise.all([
    loadTransactionsWithIds(tenantId, params.from, params.to),
    db.collection("wallets").where("tenantId", "==", tenantId).limit(200).get(),
  ]);
  const walletNames = new Map<string, string>();
  for (const w of wallets.docs) walletNames.set(w.id, String(w.data().name ?? ""));
  return {
    transactions: buildAccountantTransactions(transactions, { ...params, walletNames, today: todayInBrazil() }),
    truncated,
  };
}

/** Mesma consulta do DRE em caixa (data e pagamento no período), com os ids. */
async function loadTransactionsWithIds(tenantId: string, from: string, to: string) {
  const [byDate, byPaid] = await Promise.all([
    db
      .collection("transactions")
      .where("tenantId", "==", tenantId)
      .where("date", ">=", `${from}-01`)
      .where("date", "<", `${nextMonth(to)}-01`)
      .limit(LIST_LIMIT)
      .get(),
    db
      .collection("transactions")
      .where("tenantId", "==", tenantId)
      .where("paidAt", ">=", brazilMonthStartIso(from))
      .where("paidAt", "<", brazilMonthStartIso(nextMonth(to)))
      .limit(LIST_LIMIT)
      .get(),
  ]);
  const docs = new Map<string, Record<string, unknown>>();
  for (const doc of [...byDate.docs, ...byPaid.docs]) docs.set(doc.id, doc.data());
  return {
    transactions: [...docs.entries()].map(([id, data]) => ({ id, data })),
    truncated: byDate.size >= LIST_LIMIT || byPaid.size >= LIST_LIMIT,
  };
}

export async function accountantInvoices(token: string, params: { from: string; to: string }) {
  const { tenantId, sections } = await resolveAccountantToken(token);
  if (!sections.invoices) throw new AccountantError(404, "Notas fiscais não fazem parte do plano da empresa.");
  validateRange(params.from, params.to);
  const snap = await db
    .collection("invoices")
    .where("tenantId", "==", tenantId)
    .where("createdAt", ">=", brazilMonthStartIso(params.from))
    .where("createdAt", "<", brazilMonthStartIso(nextMonth(params.to)))
    .orderBy("createdAt", "desc")
    .limit(LIST_LIMIT)
    .get();
  return { invoices: buildAccountantInvoices(snap.docs.map((d) => ({ id: d.id, data: d.data() }))) };
}

export async function accountantReceived(token: string, params: { from: string; to: string }) {
  const { tenantId, sections } = await resolveAccountantToken(token);
  if (!sections.received) throw new AccountantError(404, "Notas de entrada não fazem parte do plano da empresa.");
  validateRange(params.from, params.to);
  const snap = await db
    .collection("received_invoices")
    .where("tenantId", "==", tenantId)
    .where("dataEmissao", ">=", `${params.from}-01`)
    .where("dataEmissao", "<", `${nextMonth(params.to)}-01`)
    .orderBy("dataEmissao", "desc")
    .limit(LIST_LIMIT)
    .get();
  return { received: buildAccountantReceived(snap.docs.map((d) => ({ id: d.id, data: d.data() }))) };
}

export type DocumentSource = "invoice" | "received";
export type DocumentKind = "pdf" | "xml";

/**
 * O arquivo de uma nota, conferindo que ela é da empresa do link. Primeiro a
 * cópia do nosso Storage; sem ela, o endereço do provedor (que abre sem login).
 */
export async function accountantDocument(
  token: string,
  source: DocumentSource,
  id: string,
  kind: DocumentKind,
): Promise<{ buffer: Buffer; fileName: string } | { redirect: string }> {
  const { tenantId, sections } = await resolveAccountantToken(token);
  if ((source === "invoice" && !sections.invoices) || (source === "received" && !sections.received) || !id || id.includes("/")) {
    throw new AccountantError(404, "Documento não encontrado.");
  }
  const collection = source === "invoice" ? "invoices" : "received_invoices";
  const snap = await db.collection(collection).doc(id).get();
  const data = snap.data();
  if (!snap.exists || !data || data.tenantId !== tenantId) throw new AccountantError(404, "Documento não encontrado.");
  if (source === "invoice" && data.status !== "authorized" && data.status !== "cancelled") {
    throw new AccountantError(404, "Documento não encontrado.");
  }
  const path = kind === "pdf" ? data.storagePdfPath : data.storageXmlPath;
  const number = String(data.numero ?? id);
  const fileName = `${source === "invoice" ? "nota" : "entrada"}-${number}.${kind}`;
  if (typeof path === "string" && path) {
    const file = getStorage().bucket().file(path);
    const [exists] = await file.exists();
    if (exists) {
      const [buffer] = await file.download();
      return { buffer, fileName };
    }
  }
  const url = source === "invoice" ? (kind === "pdf" ? data.pdfUrl : data.xmlUrl) : null;
  if (typeof url === "string" && /^https:\/\//i.test(url)) return { redirect: url };
  throw new AccountantError(404, "Documento não encontrado.");
}

