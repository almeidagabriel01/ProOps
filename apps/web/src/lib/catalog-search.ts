import { normalizeSortText } from "@/lib/sort-text";

interface SearchableCatalogItem {
  name?: string;
  category?: string;
  manufacturer?: string;
}

/**
 * Filtra itens do catálogo por um termo digitado, sem diferenciar acento nem
 * caixa ("iluminacao" acha "Iluminação"). Cada palavra do termo precisa
 * aparecer em algum dos campos: nome, categoria ou fabricante.
 */
export function filterCatalogItems<T extends SearchableCatalogItem>(
  items: T[],
  query: string,
): T[] {
  const terms = normalizeSortText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return items;

  return items.filter((item) => {
    const haystack = normalizeSortText(
      [item.name, item.category, item.manufacturer].filter(Boolean).join(" "),
    );
    return terms.every((term) => haystack.includes(term));
  });
}
