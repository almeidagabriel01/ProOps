import { stripCostFromSharedLine } from "../../api/services/shared-proposal-lines";
import { catalogSellingPrice } from "../../shared/catalog-selling-price";

/**
 * O que a Lia devolve ao modelo segue os dados sensíveis do catálogo de
 * permissões: sem "Ver custo" saem custo, markup e as faixas com custo; sem
 * "Ver estoque" sai o estoque. O modelo repetiria ao membro qualquer número
 * que recebesse, então o corte é antes de entregar.
 */
export interface SensitiveAccess {
  viewCost: boolean;
  viewStock: boolean;
  viewBalance: boolean;
}

const COST_KEYS = ["price", "markup", "pricingModel", "cost", "basePrice"];
const STOCK_KEYS = ["inventoryValue", "stock", "inventoryUnit"];

export function projectProductForViewer<T extends Record<string, unknown>>(
  product: T,
  access: Pick<SensitiveAccess, "viewCost" | "viewStock">,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...product };
  if (out.sellingPrice === undefined) {
    out.sellingPrice = catalogSellingPrice("product", product);
  }
  if (!access.viewCost) for (const key of COST_KEYS) delete out[key];
  if (!access.viewStock) for (const key of STOCK_KEYS) delete out[key];
  return out;
}

export function projectProposalForViewer<T extends Record<string, unknown>>(
  proposal: T,
  access: Pick<SensitiveAccess, "viewCost">,
): Record<string, unknown> {
  if (access.viewCost) return proposal;
  const out: Record<string, unknown> = { ...proposal };
  if (Array.isArray(out.products)) {
    out.products = (out.products as Array<Record<string, unknown>>).map((line) => stripCostFromSharedLine(line));
  }
  return out;
}

/** Sem "Ver saldo", a carteira vai ao modelo com nome e tipo, sem o saldo. */
export function projectWalletForViewer<T extends object>(
  wallet: T,
  access: Pick<SensitiveAccess, "viewBalance">,
): Record<string, unknown> {
  const rest = { ...wallet } as Record<string, unknown>;
  if (access.viewBalance) return rest;
  delete rest.balance;
  return rest;
}
