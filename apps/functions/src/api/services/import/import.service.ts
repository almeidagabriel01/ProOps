import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { DocumentReference } from "firebase-admin/firestore";
import { db } from "../../../init";
import { buildClientSearchTokens } from "../../../lib/search-tokens";
import {
  enforceTenantPlanLimit,
  getTenantClientsUsage,
  getTenantProductsUsage,
} from "../../../lib/tenant-plan-policy";
import { sanitizeRichText, sanitizeText } from "../../../utils/sanitize";
import {
  clientKeys,
  normalizeKey,
  planImport,
  validateClientRow,
  validateProductRow,
  validateServiceRow,
  type ClientImportValue,
  type ImportRowReport,
  type ProductImportValue,
  type RawRow,
  type ServiceImportValue,
} from "./import-model";

export type ImportKind = "clients" | "products" | "services";

export class ImportError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export interface ImportContext {
  tenantId: string;
  uid: string;
  /** Doc do dono, onde fica o contador `usage.*` do cadastro manual. */
  ownerRef: DocumentReference;
  isSuperAdmin: boolean;
  requestId?: string;
  route?: string;
}

export interface ImportOutcome {
  reports: ImportRowReport[];
  created: number;
  dryRun: boolean;
}

const EXISTING_LIMIT = 20_000;
const BATCH_SIZE = 400;

async function existingClientKeys(tenantId: string): Promise<Set<string>> {
  const snap = await db
    .collection("clients")
    .where("tenantId", "==", tenantId)
    .select("document", "email", "phone")
    .limit(EXISTING_LIMIT)
    .get();
  const keys = new Set<string>();
  for (const doc of snap.docs) for (const key of clientKeys(doc.data())) keys.add(key);
  return keys;
}

async function existingNames(collection: "products" | "services", tenantId: string): Promise<Set<string>> {
  const snap = await db
    .collection(collection)
    .where("tenantId", "==", tenantId)
    .select("name")
    .limit(EXISTING_LIMIT)
    .get();
  return new Set(snap.docs.map((doc) => `name:${normalizeKey(doc.data().name)}`));
}

/** Confere o teto do plano para o lote inteiro de uma vez. */
async function assertPlanRoom(ctx: ImportContext, kind: ImportKind, count: number) {
  if (count === 0) return;
  const clients = kind === "clients";
  const decision = await enforceTenantPlanLimit({
    tenantId: ctx.tenantId,
    feature: clients ? "maxClients" : "maxProducts",
    loadCurrentUsage: () => (clients ? getTenantClientsUsage(ctx.tenantId) : getTenantProductsUsage(ctx.tenantId)),
    incrementBy: count,
    uid: ctx.uid,
    requestId: ctx.requestId,
    route: ctx.route,
    isSuperAdmin: ctx.isSuperAdmin,
  });
  if (!decision.allowed) {
    const what = clients ? "contatos" : "produtos e serviços";
    throw new ImportError(
      decision.statusCode || 402,
      `A planilha passa do limite de ${what} do seu plano. Importe menos linhas ou faça upgrade.`,
      decision.code || "PLAN_LIMIT_EXCEEDED",
    );
  }
}

/** Grava em lotes e soma o contador de uso do cadastro manual uma vez só. */
async function writeAll(
  ctx: ImportContext,
  collection: ImportKind,
  docs: Record<string, unknown>[],
  usageField: "usage.clients" | "usage.products",
) {
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const data of docs.slice(i, i + BATCH_SIZE)) batch.set(db.collection(collection).doc(), data);
    await batch.commit();
  }
  const now = Timestamp.now();
  const increment = { [usageField]: FieldValue.increment(docs.length), updatedAt: now };
  await ctx.ownerRef.set(increment, { merge: true }).catch(() => undefined);
  const company = db.collection("companies").doc(ctx.tenantId);
  const companySnap = await company.get();
  if (companySnap.exists) await company.update(increment);
}

export async function importClients(ctx: ImportContext, rows: RawRow[], dryRun: boolean): Promise<ImportOutcome> {
  const existing = await existingClientKeys(ctx.tenantId);
  const { reports, accepted } = planImport<ClientImportValue>(rows, validateClientRow, clientKeys, existing);
  if (dryRun || accepted.length === 0) return { reports, created: 0, dryRun };
  await assertPlanRoom(ctx, "clients", accepted.length);

  const now = Timestamp.now();
  const docs = accepted.map(({ value }) => {
    const name = sanitizeText(value.name);
    const data: Record<string, unknown> = {
      tenantId: ctx.tenantId,
      name,
      types: value.types,
      source: "import",
      sourceId: null,
      searchTokens: buildClientSearchTokens(name, value.email, value.phone),
      createdAt: now,
      updatedAt: now,
    };
    if (value.email) data.email = value.email;
    if (value.phone) data.phone = value.phone;
    if (value.document) data.document = value.document;
    if (value.address) data.address = sanitizeRichText(value.address);
    if (value.notes) data.notes = sanitizeRichText(value.notes);
    return data;
  });
  await writeAll(ctx, "clients", docs, "usage.clients");
  return { reports, created: docs.length, dryRun };
}

/**
 * Categoria e fabricante são listas da empresa (`options`): o que a planilha
 * trouxe de novo entra na lista, senão o seletor do cadastro não o mostraria.
 */
async function ensureOptions(tenantId: string, type: "product_categories" | "product_manufacturers", labels: string[]) {
  const wanted = new Map<string, string>();
  for (const label of labels) if (label) wanted.set(normalizeKey(label), label);
  if (wanted.size === 0) return;
  const snap = await db
    .collection("options")
    .where("tenantId", "==", tenantId)
    .where("type", "==", type)
    .limit(2000)
    .get();
  for (const doc of snap.docs) wanted.delete(normalizeKey(doc.data().label));
  if (wanted.size === 0) return;
  const batch = db.batch();
  const now = Timestamp.now();
  for (const label of wanted.values()) {
    batch.set(db.collection("options").doc(), { tenantId, type, label, createdAt: now, updatedAt: now });
  }
  await batch.commit();
}

export async function importProducts(
  ctx: ImportContext,
  rows: RawRow[],
  dryRun: boolean,
  options: { allowPerMeter: boolean },
): Promise<ImportOutcome> {
  const existing = await existingNames("products", ctx.tenantId);
  const { reports, accepted } = planImport<ProductImportValue>(
    rows,
    (row) => validateProductRow(row, options),
    (value) => [`name:${normalizeKey(value.name)}`],
    existing,
  );
  if (dryRun || accepted.length === 0) return { reports, created: 0, dryRun };
  await assertPlanRoom(ctx, "products", accepted.length);

  const values = accepted.map((a) => a.value);
  await Promise.all([
    ensureOptions(ctx.tenantId, "product_categories", values.map((v) => v.category)),
    ensureOptions(ctx.tenantId, "product_manufacturers", values.map((v) => v.manufacturer)),
  ]);
  const now = Timestamp.now();
  const docs = values.map((value) => ({
    tenantId: ctx.tenantId,
    name: sanitizeText(value.name),
    description: value.description ? sanitizeRichText(value.description) : "",
    price: value.price,
    markup: value.markup,
    pricingModel: { mode: value.perMeter ? "curtain_meter" : "standard" },
    manufacturer: sanitizeText(value.manufacturer),
    category: sanitizeText(value.category),
    inventoryValue: value.stock,
    inventoryUnit: value.perMeter ? "meter" : "unit",
    stock: value.stock,
    status: "active",
    images: [],
    ...(value.ncm ? { ncm: value.ncm } : {}),
    createdAt: now,
    updatedAt: now,
  }));
  await writeAll(ctx, "products", docs, "usage.products");
  return { reports, created: docs.length, dryRun };
}

export async function importServices(ctx: ImportContext, rows: RawRow[], dryRun: boolean): Promise<ImportOutcome> {
  const existing = await existingNames("services", ctx.tenantId);
  const { reports, accepted } = planImport<ServiceImportValue>(
    rows,
    validateServiceRow,
    (value) => [`name:${normalizeKey(value.name)}`],
    existing,
  );
  if (dryRun || accepted.length === 0) return { reports, created: 0, dryRun };
  // Serviço conta no mesmo teto dos produtos, como no cadastro manual.
  await assertPlanRoom(ctx, "services", accepted.length);

  const values = accepted.map((a) => a.value);
  await ensureOptions(ctx.tenantId, "product_categories", values.map((v) => v.category));
  const now = Timestamp.now();
  const docs = values.map((value) => ({
    tenantId: ctx.tenantId,
    name: sanitizeText(value.name),
    description: value.description ? sanitizeRichText(value.description) : "",
    // O cadastro de serviço guarda o preço como texto.
    price: String(value.price),
    category: sanitizeText(value.category),
    status: "active",
    images: [],
    createdAt: now,
    updatedAt: now,
  }));
  await writeAll(ctx, "services", docs, "usage.products");
  return { reports, created: docs.length, dryRun };
}
