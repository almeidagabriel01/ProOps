import { db } from "../../../init";
import {
  MAX_PRICE_TABLES,
  MAX_PRICE_TABLE_ITEMS,
  sortPriceTables,
  toPriceTableView,
  type CreatePriceTableInput,
  type PriceTableView,
  type UpdatePriceTableInput,
} from "./price-table-model";

/**
 * Leitura e escrita de `price_tables`. Toda consulta filtra pela empresa que
 * vem do token (o controller resolve), e a escrita é só por aqui: as rules
 * negam gravação pelo navegador.
 */

const COLLECTION = "price_tables";

export class PriceTableError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export async function listPriceTables(tenantId: string): Promise<PriceTableView[]> {
  const snap = await db
    .collection(COLLECTION)
    .where("tenantId", "==", tenantId)
    .limit(MAX_PRICE_TABLES)
    .get();
  return sortPriceTables(snap.docs.map((d) => toPriceTableView(d.id, d.data())));
}

async function loadOwnedTable(tenantId: string, id: string) {
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.tenantId !== tenantId) {
    // Tabela de outra empresa responde igual à inexistente: não confirma que o id existe.
    throw new PriceTableError(404, "Tabela de preço não encontrada.");
  }
  return { ref, data: snap.data() as Record<string, unknown> };
}

export async function getPriceTable(tenantId: string, id: string): Promise<PriceTableView> {
  const { data } = await loadOwnedTable(tenantId, id);
  return toPriceTableView(id, data);
}

/**
 * Confere o `priceTableId` que o cadastro do contato manda: tem que ser uma
 * tabela da mesma empresa. Chamado pelo controller de contatos.
 */
export async function assertPriceTableBelongsToTenant(tenantId: string, id: string): Promise<void> {
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists || snap.data()?.tenantId !== tenantId) {
    throw new PriceTableError(400, "Tabela de preço inválida.");
  }
}

/**
 * Os preços próprios apontam para itens do catálogo DESTA empresa, e produto
 * por faixa de altura não tem preço próprio (o preço dele depende da faixa).
 */
async function validateItemPrices(
  tenantId: string,
  productPrices: Record<string, number> | undefined,
  servicePrices: Record<string, number> | undefined,
): Promise<void> {
  const check = async (collection: "products" | "services", ids: string[]) => {
    if (ids.length === 0) return;
    const snaps = await db.getAll(...ids.map((id) => db.collection(collection).doc(id)));
    for (const snap of snaps) {
      const data = snap.data();
      if (!snap.exists || data?.tenantId !== tenantId) {
        throw new PriceTableError(
          400,
          collection === "products"
            ? "Um dos produtos da tabela não existe mais no catálogo."
            : "Um dos serviços da tabela não existe mais no catálogo.",
        );
      }
      const mode = (data?.pricingModel as { mode?: unknown } | undefined)?.mode;
      if (collection === "products" && mode === "curtain_height") {
        throw new PriceTableError(
          400,
          `"${String(data?.name ?? "Produto")}" tem preço por faixa de altura: nele vale só o percentual da tabela.`,
        );
      }
    }
  };
  await check("products", Object.keys(productPrices ?? {}));
  await check("services", Object.keys(servicePrices ?? {}));
}

export async function createPriceTable(
  tenantId: string,
  uid: string,
  input: CreatePriceTableInput,
): Promise<PriceTableView> {
  const count = await db.collection(COLLECTION).where("tenantId", "==", tenantId).count().get();
  if (count.data().count >= MAX_PRICE_TABLES) {
    throw new PriceTableError(
      400,
      `A empresa pode ter até ${MAX_PRICE_TABLES} tabelas de preço.`,
    );
  }
  await validateItemPrices(tenantId, input.productPrices, input.servicePrices);

  const now = new Date().toISOString();
  const data = {
    tenantId,
    name: input.name,
    adjustmentPercent: input.adjustmentPercent,
    productPrices: input.productPrices,
    servicePrices: input.servicePrices,
    createdAt: now,
    updatedAt: now,
    createdBy: uid,
    updatedBy: uid,
  };
  const ref = await db.collection(COLLECTION).add(data);
  return toPriceTableView(ref.id, data);
}

export async function updatePriceTable(
  tenantId: string,
  id: string,
  uid: string,
  input: UpdatePriceTableInput,
): Promise<PriceTableView> {
  const { ref, data } = await loadOwnedTable(tenantId, id);
  await validateItemPrices(tenantId, input.productPrices, input.servicePrices);

  const update: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    updatedBy: uid,
  };
  if (input.name !== undefined) update.name = input.name;
  if (input.adjustmentPercent !== undefined) update.adjustmentPercent = input.adjustmentPercent;
  if (input.productPrices !== undefined) update.productPrices = input.productPrices;
  if (input.servicePrices !== undefined) update.servicePrices = input.servicePrices;

  const merged = { ...data, ...update };
  const total =
    Object.keys((merged.productPrices as object) ?? {}).length +
    Object.keys((merged.servicePrices as object) ?? {}).length;
  // O schema conta cada mapa enviado; aqui conta o resultado, quando só um dos dois veio.
  if (total > MAX_PRICE_TABLE_ITEMS) {
    throw new PriceTableError(
      400,
      `Uma tabela pode ter até ${MAX_PRICE_TABLE_ITEMS} preços próprios.`,
    );
  }

  await ref.update(update);
  return toPriceTableView(id, merged);
}

/**
 * Recusa excluir tabela que algum cliente usa, dizendo quantos. Desvincular
 * em silêncio mudaria o preço das próximas propostas desses clientes sem
 * ninguém ter decidido isso.
 */
export async function deletePriceTable(tenantId: string, id: string): Promise<void> {
  const { ref } = await loadOwnedTable(tenantId, id);
  const usage = await db
    .collection("clients")
    .where("tenantId", "==", tenantId)
    .where("priceTableId", "==", id)
    .count()
    .get();
  const inUse = usage.data().count;
  if (inUse > 0) {
    throw new PriceTableError(
      409,
      inUse === 1
        ? "Esta tabela está em uso por 1 cliente. Troque a tabela dele antes de excluir."
        : `Esta tabela está em uso por ${inUse} clientes. Troque a tabela deles antes de excluir.`,
    );
  }
  await ref.delete();
}
