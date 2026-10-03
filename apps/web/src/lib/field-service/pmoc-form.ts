import {
  PMOC_FREQUENCIES,
  PMOC_FREQUENCY_LABELS,
  type PmocCategory,
  type PmocFrequency,
  type PmocItem,
} from "./pmoc";

/**
 * Regras de tela do PMOC no contrato. Separado de `pmoc.ts`, que é o espelho
 * do backend com paridade testada e não pode ganhar nada que o backend não tem.
 */

/** Teto do backend (`MAX_PMOC_ITEMS` em `contract-model.ts`). */
export const MAX_PMOC_ITEMS = 60;

/** Item escrito pela empresa: id próprio, que não colide com os da norma. */
export function newPmocItem(category: PmocCategory, now = Date.now()): PmocItem {
  const suffix = Math.random().toString(36).slice(2, 7);
  return { id: `custom_${now.toString(36)}_${suffix}`, category, text: "", frequency: "monthly" };
}

export interface PmocFormErrors {
  items?: string;
  occupants?: string;
  climatizedArea?: string;
}

/** Número inteiro ou com vírgula, vazio vira `null`; `undefined` quando inválido. */
export function parseOptionalNumber(value: string, integer = false): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  if (integer && !Number.isInteger(parsed)) return undefined;
  return parsed;
}

export function validatePmocForm(form: { items: PmocItem[]; occupants: string; climatizedArea: string }): PmocFormErrors {
  const errors: PmocFormErrors = {};
  if (form.items.length === 0) errors.items = "O PMOC precisa de ao menos um item.";
  else if (form.items.length > MAX_PMOC_ITEMS) errors.items = `No máximo ${MAX_PMOC_ITEMS} itens no PMOC.`;
  else if (form.items.some((item) => item.text.trim().length < 2)) errors.items = "Descreva cada item do PMOC.";
  if (parseOptionalNumber(form.occupants, true) === undefined) errors.occupants = "Use um número inteiro.";
  if (parseOptionalNumber(form.climatizedArea) === undefined) errors.climatizedArea = "Use um número, em m².";
  return errors;
}

const PLURAL: Record<PmocFrequency, string> = {
  monthly: "mensais",
  quarterly: "trimestrais",
  semiannual: "semestrais",
  annual: "anuais",
};

/** "16 itens: 6 mensais, 6 trimestrais, 4 semestrais". */
export function pmocItemsSummary(items: readonly PmocItem[]): string {
  if (items.length === 0) return "Nenhum item no plano.";
  const parts = PMOC_FREQUENCIES.map((frequency) => {
    const count = items.filter((item) => item.frequency === frequency).length;
    if (count === 0) return null;
    return count === 1 ? `1 ${PMOC_FREQUENCY_LABELS[frequency].toLowerCase()}` : `${count} ${PLURAL[frequency]}`;
  }).filter(Boolean);
  return `${items.length} ${items.length === 1 ? "item" : "itens"}: ${parts.join(", ")}`;
}
