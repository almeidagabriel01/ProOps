import { randomBytes } from "node:crypto";
import { db } from "../../../init";
import {
  DEFAULT_GROUP,
  DRE_GROUPS,
  normalizeCategoryName,
  type DreGroup,
  type TransactionKind,
} from "./dre-model";

/**
 * Lista de categorias de lançamento da empresa, cada uma num grupo do DRE.
 * Um documento por empresa (`transaction_categories/{tenantId}`), com a lista
 * inteira: é pequena, sai numa leitura só, e nome repetido é conferido na
 * mesma transação que grava.
 *
 * O lançamento continua guardando o NOME (`category`), como sempre guardou:
 * busca, cartão e exportação seguem funcionando, e o DRE casa pelo nome
 * normalizado. Renomear leva o nome novo aos lançamentos.
 */

export const TRANSACTION_CATEGORIES_COLLECTION = "transaction_categories";
export const MAX_CATEGORIES = 300;

export interface TransactionCategory {
  id: string;
  name: string;
  kind: TransactionKind;
  group: DreGroup;
}

export class CategoryError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** A empresa começa com estas, além das que já usava. */
export const DEFAULT_CATEGORIES: Array<Omit<TransactionCategory, "id">> = [
  { name: "Vendas", kind: "income", group: "revenue" },
  { name: "Serviços", kind: "income", group: "revenue" },
  { name: "Impostos", kind: "expense", group: "deduction" },
  { name: "Materiais", kind: "expense", group: "cost" },
  { name: "Mão de obra", kind: "expense", group: "cost" },
  { name: "Aluguel", kind: "expense", group: "operating" },
  { name: "Salários", kind: "expense", group: "operating" },
  { name: "Marketing", kind: "expense", group: "operating" },
  { name: "Taxas bancárias", kind: "expense", group: "other_expense" },
];

/** Grupo sugerido para uma categoria que a empresa já usava. Ajustável depois. */
export function suggestGroup(name: string, kind: TransactionKind): DreGroup {
  const n = normalizeCategoryName(name);
  if (kind === "income") {
    return /(rendimento|juros|reembolso|estorno)/.test(n) ? "other_income" : "revenue";
  }
  if (/(imposto|simples|\bdas\b|iss|icms|tributo)/.test(n)) return "deduction";
  if (/(material|materiais|mao de obra|fornecedor|mercadoria|produto|compra|insumo|instalac)/.test(n)) return "cost";
  if (/(tarifa|taxa bancaria|juros|multa)/.test(n)) return "other_expense";
  return DEFAULT_GROUP.expense;
}

function newId(): string {
  return randomBytes(8).toString("hex");
}

function sanitizeItems(value: unknown): TransactionCategory[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is TransactionCategory => {
      const c = item as Partial<TransactionCategory>;
      return (
        typeof c?.id === "string" &&
        typeof c?.name === "string" &&
        (c.kind === "income" || c.kind === "expense") &&
        typeof c.group === "string" &&
        c.group in DRE_GROUPS &&
        DRE_GROUPS[c.group as DreGroup].kind === c.kind
      );
    })
    .map(({ id, name, kind, group }) => ({ id, name, kind, group }));
}

/**
 * As categorias que já estão nos lançamentos (as 5.000 mais recentes, uma vez
 * só por empresa), com o grupo sugerido pelo nome.
 */
async function categoriesInUse(tenantId: string): Promise<Array<Omit<TransactionCategory, "id">>> {
  const snap = await db
    .collection("transactions")
    .where("tenantId", "==", tenantId)
    .orderBy("date", "desc")
    .select("category", "type")
    .limit(5000)
    .get();
  const seen = new Map<string, Omit<TransactionCategory, "id">>();
  for (const doc of snap.docs) {
    const data = doc.data();
    const kind = data.type === "income" || data.type === "expense" ? (data.type as TransactionKind) : null;
    const name = typeof data.category === "string" ? data.category.trim().replace(/\s+/g, " ") : "";
    if (!kind || !name || name.length > 100) continue;
    const key = `${kind}:${normalizeCategoryName(name)}`;
    if (!seen.has(key)) seen.set(key, { name, kind, group: suggestGroup(name, kind) });
  }
  return [...seen.values()];
}

/** Monta a lista inicial: as que a empresa usa, e as padrão que faltarem. */
export function buildInitialCategories(inUse: Array<Omit<TransactionCategory, "id">>): TransactionCategory[] {
  const items: TransactionCategory[] = [];
  const keys = new Set<string>();
  for (const category of [...inUse, ...DEFAULT_CATEGORIES]) {
    const key = `${category.kind}:${normalizeCategoryName(category.name)}`;
    if (keys.has(key) || items.length >= MAX_CATEGORIES) continue;
    keys.add(key);
    items.push({ ...category, id: newId() });
  }
  return items;
}

function ref(tenantId: string) {
  return db.collection(TRANSACTION_CATEGORIES_COLLECTION).doc(tenantId);
}

export async function listCategories(tenantId: string): Promise<TransactionCategory[]> {
  const snap = await ref(tenantId).get();
  if (snap.exists) return sanitizeItems(snap.data()?.items);
  const initial = buildInitialCategories(await categoriesInUse(tenantId));
  // `create` e não `set`: duas abas abrindo juntas não semeiam duas vezes.
  await ref(tenantId)
    .create({ tenantId, items: initial, seededAt: new Date().toISOString() })
    .catch(() => undefined);
  const after = await ref(tenantId).get();
  return sanitizeItems(after.data()?.items);
}

function assertGroup(kind: TransactionKind, group: DreGroup) {
  if (!(group in DRE_GROUPS) || DRE_GROUPS[group].kind !== kind) {
    throw new CategoryError(400, "Grupo do DRE inválido para esse tipo.");
  }
}

function assertUniqueName(items: TransactionCategory[], kind: TransactionKind, name: string, ignoreId?: string) {
  const key = normalizeCategoryName(name);
  if (items.some((c) => c.id !== ignoreId && c.kind === kind && normalizeCategoryName(c.name) === key)) {
    throw new CategoryError(409, "Já existe uma categoria com esse nome.");
  }
}

export async function createCategory(
  tenantId: string,
  input: { name: string; kind: TransactionKind; group?: DreGroup },
): Promise<TransactionCategory> {
  await listCategories(tenantId);
  const group = input.group ?? suggestGroup(input.name, input.kind);
  assertGroup(input.kind, group);
  const created: TransactionCategory = { id: newId(), name: input.name, kind: input.kind, group };
  await db.runTransaction(async (tx) => {
    const items = sanitizeItems((await tx.get(ref(tenantId))).data()?.items);
    if (items.length >= MAX_CATEGORIES) throw new CategoryError(400, "Limite de categorias atingido.");
    assertUniqueName(items, input.kind, input.name);
    tx.set(ref(tenantId), { tenantId, items: [...items, created], updatedAt: new Date().toISOString() }, { merge: true });
  });
  return created;
}

/**
 * Nome e grupo. Renomear leva o nome novo a todo lançamento da empresa com o
 * nome antigo, do mesmo tipo, em lotes de 400.
 */
export async function updateCategory(
  tenantId: string,
  id: string,
  input: { name?: string; group?: DreGroup },
): Promise<{ category: TransactionCategory; renamed: number }> {
  let before: TransactionCategory | undefined;
  let after: TransactionCategory | undefined;
  await db.runTransaction(async (tx) => {
    const items = sanitizeItems((await tx.get(ref(tenantId))).data()?.items);
    before = items.find((c) => c.id === id);
    if (!before) throw new CategoryError(404, "Categoria não encontrada.");
    const name = input.name ?? before.name;
    const group = input.group ?? before.group;
    assertGroup(before.kind, group);
    if (input.name) assertUniqueName(items, before.kind, name, id);
    after = { ...before, name, group };
    tx.set(
      ref(tenantId),
      { items: items.map((c) => (c.id === id ? after : c)), updatedAt: new Date().toISOString() },
      { merge: true },
    );
  });
  const old = before as TransactionCategory;
  const next = after as TransactionCategory;
  let renamed = 0;
  if (old.name !== next.name) renamed = await renameInTransactions(tenantId, old, next.name);
  return { category: next, renamed };
}

async function renameInTransactions(tenantId: string, old: TransactionCategory, name: string): Promise<number> {
  let total = 0;
  for (let round = 0; round < 50; round++) {
    const snap = await db
      .collection("transactions")
      .where("tenantId", "==", tenantId)
      .where("category", "==", old.name)
      .where("type", "==", old.kind)
      .limit(400)
      .get();
    if (snap.empty) break;
    const batch = db.batch();
    const now = new Date().toISOString();
    for (const doc of snap.docs) batch.update(doc.ref, { category: name, updatedAt: now });
    await batch.commit();
    total += snap.size;
    // Os renomeados saem da consulta, então a próxima volta pega os seguintes.
    if (snap.size < 400) break;
  }
  return total;
}

/** Tira da lista. Os lançamentos mantêm o nome e vão para o grupo padrão do tipo. */
export async function deleteCategory(tenantId: string, id: string): Promise<void> {
  await db.runTransaction(async (tx) => {
    const items = sanitizeItems((await tx.get(ref(tenantId))).data()?.items);
    if (!items.some((c) => c.id === id)) throw new CategoryError(404, "Categoria não encontrada.");
    tx.set(
      ref(tenantId),
      { items: items.filter((c) => c.id !== id), updatedAt: new Date().toISOString() },
      { merge: true },
    );
  });
}
