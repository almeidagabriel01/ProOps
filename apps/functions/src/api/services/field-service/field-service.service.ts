import { randomUUID } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import type { Transaction } from "firebase-admin/firestore";
import { db } from "../../../init";
import { logger } from "../../../lib/logger";
import {
  EQUIPMENT_COLLECTION,
  SERVICE_ORDERS_COLLECTION,
  SERVICE_ORDER_COUNTERS_COLLECTION,
  STOCK_MOVEMENTS_COLLECTION,
  formatOrderCode,
  stockConsumption,
  stockDelta,
  stockMovementId,
  type ServiceOrderItem,
} from "./field-service-model";

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

export { SERVICE_ORDERS_COLLECTION, EQUIPMENT_COLLECTION };
