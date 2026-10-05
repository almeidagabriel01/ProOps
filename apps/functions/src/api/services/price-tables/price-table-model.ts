import { z } from "zod";

/**
 * Tabelas de preço: o catálogo é a tabela PADRÃO (sem documento) e cada
 * documento de `price_tables` é uma tabela específica, escolhida no cadastro
 * do cliente (`clients.priceTableId`) e aplicada nas propostas dele.
 *
 * Uma tabela tem as duas formas que o dono pediu:
 *
 * - `adjustmentPercent`: ajuste sobre o PREÇO DE VENDA padrão de todo item do
 *   catálogo (negativo = desconto, positivo = acréscimo). Vale para produtos,
 *   inclusive os por faixa de altura, e para serviços.
 * - `productPrices` / `servicePrices`: preço de venda próprio por item, na
 *   unidade de medida dele (unidade, m², m linear). Vence o percentual para
 *   aquele item. Produto por faixa de altura não tem preço próprio: o preço
 *   dele depende da faixa, e um número só não diz qual.
 *
 * Arquivo puro (sem Firestore): validação e normalização, testáveis sem infra.
 */

/** Tabelas por empresa. Também é o `.limit()` da listagem. */
export const MAX_PRICE_TABLES = 50;
/** Preços próprios por tabela, somando produtos e serviços. */
export const MAX_PRICE_TABLE_ITEMS = 500;
export const MIN_ADJUSTMENT_PERCENT = -99.99;
export const MAX_ADJUSTMENT_PERCENT = 1000;
export const MAX_ITEM_PRICE = 100_000_000;

export interface PriceTableData {
  tenantId: string;
  name: string;
  adjustmentPercent: number;
  productPrices: Record<string, number>;
  servicePrices: Record<string, number>;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface PriceTableView extends Omit<PriceTableData, "tenantId"> {
  id: string;
}

/** O que o seletor do cadastro do contato precisa: sem os preços. */
export interface PriceTableOption {
  id: string;
  name: string;
  adjustmentPercent: number;
}

/** Centavo mais próximo, metade para longe do zero (-7,555 vira -7,56, não -7,55). */
export function roundCents(value: number): number {
  return (Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100)) / 100;
}

const itemIdSchema = z.string().trim().min(1).max(128);

const priceSchema = z
  .number({ message: "Preço inválido." })
  .finite("Preço inválido.")
  .gt(0, "O preço próprio precisa ser maior que zero.")
  .max(MAX_ITEM_PRICE, "Preço acima do permitido.")
  .transform(roundCents);

const priceMapSchema = z.record(itemIdSchema, priceSchema);

const nameSchema = z
  .string({ message: "Informe o nome da tabela." })
  .trim()
  .min(1, "Informe o nome da tabela.")
  .max(80, "O nome da tabela pode ter até 80 caracteres.")
  .transform((value) => value.replace(/\s+/g, " "));

const adjustmentSchema = z
  .number({ message: "Percentual inválido." })
  .finite("Percentual inválido.")
  .min(MIN_ADJUSTMENT_PERCENT, "O desconto precisa ser menor que 100%.")
  .max(MAX_ADJUSTMENT_PERCENT, "O acréscimo pode ser de até 1000%.")
  .transform(roundCents);

export const CreatePriceTableSchema = z
  .object({
    name: nameSchema,
    adjustmentPercent: adjustmentSchema.default(0),
    productPrices: priceMapSchema.default({}),
    servicePrices: priceMapSchema.default({}),
  })
  .strict()
  .refine(
    (v) =>
      Object.keys(v.productPrices).length + Object.keys(v.servicePrices).length <=
      MAX_PRICE_TABLE_ITEMS,
    `Uma tabela pode ter até ${MAX_PRICE_TABLE_ITEMS} preços próprios.`,
  );

export const UpdatePriceTableSchema = z
  .object({
    name: nameSchema.optional(),
    adjustmentPercent: adjustmentSchema.optional(),
    productPrices: priceMapSchema.optional(),
    servicePrices: priceMapSchema.optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.name !== undefined ||
      v.adjustmentPercent !== undefined ||
      v.productPrices !== undefined ||
      v.servicePrices !== undefined,
    "Nada para alterar.",
  );

export type CreatePriceTableInput = z.infer<typeof CreatePriceTableSchema>;
export type UpdatePriceTableInput = z.infer<typeof UpdatePriceTableSchema>;

/** Lê um mapa de preços gravado, descartando o que não é preço válido. */
export function readPriceMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) out[id] = raw;
  }
  return out;
}

function readIso(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return "";
}

export function toPriceTableView(id: string, data: Record<string, unknown>): PriceTableView {
  const adjustment = Number(data.adjustmentPercent);
  return {
    id,
    name: String(data.name ?? ""),
    adjustmentPercent: Number.isFinite(adjustment) ? adjustment : 0,
    productPrices: readPriceMap(data.productPrices),
    servicePrices: readPriceMap(data.servicePrices),
    createdAt: readIso(data.createdAt),
    updatedAt: readIso(data.updatedAt),
    createdBy: typeof data.createdBy === "string" ? data.createdBy : null,
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : null,
  };
}

export function toPriceTableOption(view: PriceTableView): PriceTableOption {
  return { id: view.id, name: view.name, adjustmentPercent: view.adjustmentPercent };
}

/** Ordem de exibição: por nome, sem diferenciar acento nem caixa. */
export function sortPriceTables<T extends { name: string }>(tables: T[]): T[] {
  return [...tables].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
  );
}
