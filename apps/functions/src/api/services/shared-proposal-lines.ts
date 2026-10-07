/**
 * O que uma linha da proposta pode levar para fora da empresa.
 *
 * Na proposta gravada, `unitPrice` é o CUSTO do produto e `markup` é a margem
 * (o preço de venda é calculado no front). O link público e o PDF só precisam
 * do total da linha, então aqui `unitPrice` passa a ser o unitário de VENDA e
 * tudo que revela custo ou margem sai.
 */

const COST_KEYS = [
  "markup",
  "pricingModel",
  "price",
  "basePrice",
  "cost",
  "costPrice",
  "priceManuallyEdited",
] as const;

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Unitário de venda da linha. O total é a fonte da verdade (é ele que o PDF
 * soma); só quando falta é que o preço é recalculado pelo custo e markup, no
 * modelo padrão.
 */
export function sellingUnitPrice(line: Record<string, unknown>): number {
  const quantity = toNumber(line.quantity);
  const total = Number(line.total);
  if (Number.isFinite(total) && quantity > 0) {
    return roundCents(total / quantity);
  }
  const cost = toNumber(line.unitPrice);
  const markup = toNumber(line.markup);
  return roundCents(cost * (1 + markup / 100));
}

export function stripCostFromSharedLine<T extends Record<string, unknown>>(
  line: T,
): T {
  const safe: Record<string, unknown> = { ...line };
  const quantity = toNumber(line.quantity);
  const unit = sellingUnitPrice(line);
  safe.unitPrice = unit;
  if (!Number.isFinite(Number(line.total))) {
    safe.total = roundCents(unit * quantity);
  }
  COST_KEYS.forEach((key) => {
    delete safe[key];
  });
  return safe as T;
}
