import { Timestamp } from "firebase-admin/firestore";

/**
 * Quantos docs a busca indexada da Lia lê antes de refinar e ordenar em
 * memória. A consulta por `array-contains` não combina com `orderBy` sem um
 * índice por campo de ordenação, então a ordem é aplicada depois.
 */
export const INDEXED_SEARCH_SCAN_LIMIT = 200;

function sortableValue(value: unknown): number | string {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return /^\d{4}-\d{2}-\d{2}/.test(value) && Number.isFinite(ms) ? ms : value.toLowerCase();
  }
  return "";
}

/** Ordena docs por um campo (datas mistas Timestamp/ISO, texto sem caixa). */
export function sortDocsByField<T extends { data: () => Record<string, unknown> }>(
  docs: T[],
  field: string,
  direction: "asc" | "desc",
): T[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...docs].sort((a, b) => {
    const va = sortableValue(a.data()[field]);
    const vb = sortableValue(b.data()[field]);
    if (va === vb) return 0;
    return (va < vb ? -1 : 1) * sign;
  });
}
