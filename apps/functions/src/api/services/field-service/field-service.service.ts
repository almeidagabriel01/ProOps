import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import type { Transaction } from "firebase-admin/firestore";
import { db } from "../../../init";
import { logger } from "../../../lib/logger";
import { resolveFrontendAppUrl } from "../../../lib/frontend-app-url";
import { renderPageToPdfBuffer, resolveAppBaseUrl } from "../core-pdf.service";
import {
  EQUIPMENT_COLLECTION,
  SERVICE_ORDERS_COLLECTION,
  SERVICE_ORDER_COUNTERS_COLLECTION,
  STOCK_MOVEMENTS_COLLECTION,
  catalogKey,
  formatOrderCode,
  stockConsumption,
  stockDelta,
  stockMovementId,
  type ServiceOrderItem,
} from "./field-service-model";
import {
  normalizeProductPricingModel,
  parsePricingNumber,
  roundPricingValue,
} from "../../../shared/dimension-pricing";

/**
 * Leitura e gravação de equipamentos e ordens de serviço. As regras de negócio
 * puras ficam em `field-service-model.ts`; aqui só o que toca o Firestore e o
 * Storage.
 */

export async function loadOfTenant(collection: string, id: string, tenantId: string) {
  const ref = db.collection(collection).doc(id);
  const snap = await ref.get();
  const data = snap.data();
  if (!snap.exists || data?.tenantId !== tenantId) return null;
  return { ref, data: data as Record<string, unknown> };
}

/**
 * Preço de VENDA de um item do catálogo, como o seletor da OS mostra: o do
 * produto é custo mais markup (a primeira faixa, no produto por altura); o do
 * serviço é o preço dele.
 */
export function catalogSellingPrice(kind: "product" | "service", data: Record<string, unknown>): number {
  if (kind === "service") return roundPricingValue(Math.max(0, parsePricingNumber(data.price)));
  const model = normalizeProductPricingModel(data.pricingModel);
  if (model.mode === "curtain_height") {
    const tier = model.tiers[0];
    return tier ? roundPricingValue(tier.basePrice * (1 + tier.markup / 100)) : 0;
  }
  const base = Math.max(0, parsePricingNumber(data.price));
  const markup = Math.max(0, parsePricingNumber(data.markup));
  return roundPricingValue(base * (1 + markup / 100));
}

/** Preço de venda dos itens do catálogo pedidos, só os da empresa. */
export async function loadCatalogPrices(
  items: ReadonlyArray<{ kind: "product" | "service"; refId: string | null }>,
  tenantId: string,
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  const wanted = new Map<string, { kind: "product" | "service"; refId: string }>();
  for (const item of items) {
    if (item.refId) wanted.set(catalogKey(item.kind, item.refId), { kind: item.kind, refId: item.refId });
  }
  await Promise.all(
    [...wanted.entries()].map(async ([key, { kind, refId }]) => {
      const found = await loadOfTenant(kind === "product" ? "products" : "services", refId, tenantId);
      if (found) prices.set(key, catalogSellingPrice(kind, found.data));
    }),
  );
  return prices;
}

export interface ClientSnapshot {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
}

function joinAddress(raw: unknown): string | null {
  if (typeof raw === "string") return raw.trim() || null;
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const parts = [a.street, a.number, a.complement, a.neighborhood, a.city, a.state]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * O cliente copiado para a OS. O técnico não tem acesso a Contatos, e a OS
 * precisa mostrar a ele nome, telefone e endereço de onde ir.
 */
export async function loadClientSnapshot(clientId: string, tenantId: string): Promise<ClientSnapshot | null> {
  const found = await loadOfTenant("clients", clientId, tenantId);
  if (!found) return null;
  const c = found.data;
  return {
    id: clientId,
    name: String(c.name ?? ""),
    phone: typeof c.phone === "string" && c.phone.trim() ? c.phone.trim() : null,
    address: joinAddress(c.address),
  };
}

/** O membro que vai atender, desde que seja da mesma empresa. */
export async function loadTechnician(uid: string, tenantId: string): Promise<{ uid: string; name: string } | null> {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists || snap.data()?.tenantId !== tenantId) return null;
  return { uid, name: String(snap.data()?.name ?? "") };
}

/** Os equipamentos citados na OS existem e são do mesmo cliente. */
export async function loadEquipmentLabels(
  ids: readonly string[],
  tenantId: string,
  clientId: string,
): Promise<{ id: string; label: string }[] | null> {
  if (ids.length === 0) return [];
  const refs = ids.map((id) => db.collection(EQUIPMENT_COLLECTION).doc(id));
  const snaps = await db.getAll(...refs);
  const out: { id: string; label: string }[] = [];
  for (const snap of snaps) {
    const data = snap.data();
    if (!snap.exists || data?.tenantId !== tenantId || data?.clientId !== clientId) return null;
    const detail = [data.brand, data.model].filter((v) => typeof v === "string" && v).join(" ");
    out.push({ id: snap.id, label: detail ? `${data.name} (${detail})` : String(data.name) });
  }
  return out;
}

/**
 * Número sequencial da OS. Lido e gravado na mesma transação que cria a OS,
 * então duas OS abertas ao mesmo tempo nunca saem com o mesmo número.
 */
export async function allocateOrderNumber(t: Transaction, tenantId: string): Promise<{ number: number; code: string }> {
  const ref = db.collection(SERVICE_ORDER_COUNTERS_COLLECTION).doc(tenantId);
  const snap = await t.get(ref);
  const current = Number(snap.data()?.nextNumber);
  const number = Number.isInteger(current) && current > 0 ? current : 1;
  t.set(ref, { tenantId, nextNumber: number + 1, updatedAt: new Date().toISOString() }, { merge: true });
  return { number, code: formatOrderCode(number) };
}

export interface StockSyncResult {
  applied: Record<string, number>;
  /** Produtos que ficaram com saldo negativo. A OS não é bloqueada por isso. */
  negative: { productId: string; name: string; balance: number }[];
}

/**
 * Leva o estoque ao que a OS consome, lançando só a diferença (`stockDelta`).
 *
 * Tudo dentro da transação de quem chama: o saldo do produto e o movimento são
 * gravados juntos, e o mapa `stockApplied` da OS avança no mesmo commit. Por
 * isso repetir a mesma conclusão não baixa duas vezes.
 *
 * Produto sem controle de estoque (sem `inventoryValue` numérico) não ganha
 * movimento: não há saldo para acompanhar. Produto apagado do catálogo idem.
 */
export async function syncOrderStock(params: {
  t: Transaction;
  tenantId: string;
  orderId: string;
  orderCode: string;
  revision: number;
  items: readonly ServiceOrderItem[];
  applied: Record<string, number>;
  uid: string;
  now: string;
  /** Cancelamento: o desejado é zero e tudo volta ao estoque. */
  release?: boolean;
}): Promise<StockSyncResult> {
  const desired = params.release ? {} : stockConsumption(params.items);
  const delta = stockDelta(desired, params.applied);
  const ids = Object.keys(delta);
  const applied = { ...params.applied };
  const negative: StockSyncResult["negative"] = [];
  if (ids.length === 0) return { applied, negative };

  const refs = ids.map((id) => db.collection("products").doc(id));
  const snaps = await params.t.getAll(...refs);
  const names = new Map(params.items.map((i) => [i.refId, i.name]));

  for (const snap of snaps) {
    const productId = snap.id;
    const data = snap.data();
    const current = data?.inventoryValue;
    const tracked = snap.exists && data?.tenantId === params.tenantId && typeof current === "number";
    // O que não é acompanhado conta como aplicado: senão a diferença voltaria
    // a cada conclusão, para sempre.
    applied[productId] = desired[productId] ?? 0;
    if (!tracked) continue;

    const quantity = delta[productId];
    const balance = Math.round((current - quantity) * 1000) / 1000;
    params.t.update(snap.ref, { inventoryValue: balance, stock: balance, updatedAt: new Date(params.now) });
    params.t.set(db.collection(STOCK_MOVEMENTS_COLLECTION).doc(stockMovementId(params.orderId, params.revision, productId)), {
      tenantId: params.tenantId,
      productId,
      productName: String(data?.name ?? names.get(productId) ?? ""),
      quantity: -quantity,
      unit: data?.inventoryUnit === "meter" ? "meter" : "unit",
      balanceAfter: balance,
      reason: quantity > 0 ? "service_order" : "service_order_return",
      refType: "service_order",
      refId: params.orderId,
      refLabel: params.orderCode,
      createdAt: params.now,
      createdBy: params.uid,
    });
    if (balance < 0) negative.push({ productId, name: String(data?.name ?? ""), balance });
  }
  for (const id of Object.keys(applied)) if (applied[id] === 0) delete applied[id];
  return { applied, negative };
}

// ---------------------------------------------------------------------------
// Arquivos: fotos e a assinatura sobem pelo backend, como as fotos da obra. O
// técnico é membro, e as regras do Storage só deixam master e admin gravarem
// direto do navegador.
// ---------------------------------------------------------------------------

export function orderFilePath(tenantId: string, orderId: string, fileName: string): string {
  return `tenants/${tenantId}/service_orders/${orderId}/${fileName}`;
}

export async function storeOrderFile(params: { path: string; buffer: Buffer; contentType: string }): Promise<string> {
  const bucket = getStorage().bucket();
  const token = randomUUID();
  await bucket.file(params.path).save(params.buffer, {
    resumable: false,
    contentType: params.contentType,
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(params.path)}?alt=media&token=${token}`;
}

export async function deleteOrderFiles(paths: string[]): Promise<void> {
  const bucket = getStorage().bucket();
  await Promise.all(
    paths.map((p) =>
      bucket
        .file(p)
        .delete({ ignoreNotFound: true })
        .catch((error: unknown) =>
          logger.warn("service_order_file_delete_failed", {
            path: p,
            error: error instanceof Error ? error.message : String(error),
          }),
        ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Link público da OS: o comprovante do atendimento para o cliente, e a página
// que o Chromium do backend imprime no PDF.
// ---------------------------------------------------------------------------

export const SHARED_SERVICE_ORDERS_COLLECTION = "shared_service_orders";

export function buildOrderShareUrl(token: string): string {
  return new URL(`/share/os/${token}`, resolveFrontendAppUrl()).toString();
}

/**
 * Um link por OS, reaproveitado: o token mora na própria OS
 * (`shareToken`) e o documento do link tem o token como id, então abrir o
 * link é uma leitura por id, sem consulta.
 */
export async function ensureOrderShareToken(params: {
  tenantId: string;
  orderId: string;
  uid: string | null;
}): Promise<string> {
  const ref = db.collection(SERVICE_ORDERS_COLLECTION).doc(params.orderId);
  return db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const current = snap.data()?.shareToken;
    if (typeof current === "string" && current) return current;
    const token = randomBytes(24).toString("base64url");
    t.set(db.collection(SHARED_SERVICE_ORDERS_COLLECTION).doc(token), {
      tenantId: params.tenantId,
      serviceOrderId: params.orderId,
      createdAt: new Date().toISOString(),
      createdBy: params.uid,
    });
    t.update(ref, { shareToken: token });
    return token;
  });
}

export async function resolveOrderShareToken(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const snap = await db.collection(SHARED_SERVICE_ORDERS_COLLECTION).doc(token).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  const order = await loadOfTenant(SERVICE_ORDERS_COLLECTION, String(data.serviceOrderId), String(data.tenantId));
  if (!order || order.data.shareToken !== token) return null;
  return { tenantId: String(data.tenantId), orderId: order.ref.id, data: order.data };
}

/**
 * O que o cliente vê: sem ids de membro, sem caminho de Storage, sem o
 * histórico de reabertura nem o IP de quem assinou.
 */
export function toClientOrderView(order: Record<string, unknown>) {
  const signature = order.signature as Record<string, unknown> | null;
  const items = (order.items as ServiceOrderItem[] | undefined) ?? [];
  return {
    code: order.code,
    type: order.type,
    status: order.status,
    title: order.title,
    description: order.description ?? null,
    clientName: order.clientName ?? null,
    address: order.address ?? null,
    equipmentLabels: (order.equipmentLabels as string[] | undefined) ?? [],
    technicianName: order.technicianName ?? null,
    scheduledStart: order.scheduledStart ?? null,
    checkInAt: order.checkInAt ?? null,
    checkOutAt: order.checkOutAt ?? null,
    completedAt: order.completedAt ?? null,
    checklist: ((order.checklist as Array<Record<string, unknown>> | undefined) ?? []).map((c) => ({
      text: c.text,
      done: c.done === true,
    })),
    items: items.map((i) => ({ name: i.name, kind: i.kind, quantity: i.quantity, unitPrice: i.unitPrice })),
    totals: order.totals ?? { products: 0, services: 0, total: 0 },
    report: order.report ?? null,
    photos: ((order.photos as Array<Record<string, unknown>> | undefined) ?? []).map((p) => ({
      url: p.url,
      caption: p.caption ?? null,
    })),
    signature: signature
      ? {
          name: signature.name,
          document: signature.document ?? null,
          imageUrl: signature.imageUrl,
          signedAt: signature.signedAt,
          contentHash: signature.contentHash,
        }
      : null,
    noSignatureReason: order.noSignatureReason ?? null,
  };
}

/** Mude quando o layout impresso mudar: o cache antigo deixa de valer. */
const ORDER_PDF_TEMPLATE_VERSION = "service-order-pdf-v1";

export function orderPdfPath(tenantId: string, orderId: string): string {
  // `pdf` no caminho: gerado pelo sistema, fora da conta do armazenamento.
  return `tenants/${tenantId}/service_orders/${orderId}/pdf/os.pdf`;
}

export function orderPdfVersion(order: Record<string, unknown>, tenant: Record<string, unknown>): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        ORDER_PDF_TEMPLATE_VERSION,
        order.updatedAt ?? null,
        order.status ?? null,
        tenant.name ?? null,
        tenant.logoUrl ?? null,
        tenant.primaryColor ?? null,
      ]),
    )
    .digest("hex");
}

/**
 * O PDF da OS, impresso da página pública pelo Chromium, com cache no Storage
 * enquanto a OS e a marca da empresa não mudarem.
 */
export async function generateOrderPdf(params: {
  tenantId: string;
  orderId: string;
  uid: string | null;
}): Promise<{ buffer: Buffer; code: string }> {
  const found = await loadOfTenant(SERVICE_ORDERS_COLLECTION, params.orderId, params.tenantId);
  if (!found) throw new Error("SERVICE_ORDER_NOT_FOUND");
  const tenantSnap = await db.collection("tenants").doc(params.tenantId).get();
  const version = orderPdfVersion(found.data, tenantSnap.data() ?? {});
  const path = orderPdfPath(params.tenantId, params.orderId);
  const file = getStorage().bucket().file(path);
  const code = String(found.data.code ?? "OS");

  const [exists] = await file.exists();
  if (exists) {
    const [metadata] = await file.getMetadata();
    if (metadata.metadata?.versionHash === version) {
      const [cached] = await file.download();
      if (cached.subarray(0, 5).toString("ascii") === "%PDF-") return { buffer: cached, code };
    }
  }

  const token = await ensureOrderShareToken(params);
  const buffer = await renderPageToPdfBuffer({
    url: `${buildOrderShareUrl(token)}?print=1`,
    readySelector: '[data-pdf-service-order-ready="1"]',
    appOrigin: resolveAppBaseUrl(),
    vercelBypassSecret: process.env.VERCEL_PROTECTION_BYPASS_SECRET || "",
  });
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("INVALID_PDF_HEADER");
  try {
    await file.save(buffer, {
      contentType: "application/pdf",
      resumable: false,
      metadata: { cacheControl: "private, max-age=3600", metadata: { versionHash: version } },
    });
  } catch (error) {
    logger.warn("service_order_pdf_cache_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return { buffer, code };
}

export { SERVICE_ORDERS_COLLECTION, EQUIPMENT_COLLECTION };
