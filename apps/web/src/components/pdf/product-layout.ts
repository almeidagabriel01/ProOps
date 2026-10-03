import type { PdfProductLayout } from "@/types/pdf-display-settings";

/**
 * Como os produtos aparecem no PDF da proposta, escolhido no editor de PDF e
 * gravado em `pdfSettings.productLayout`.
 *
 * "default" é o PDF de sempre e o valor de toda proposta que nunca escolheu:
 * cards dois por linha dentro dos grupos (ambientes, soluções) e um card
 * grande por linha nos itens avulsos. Os outros valem nos dois lugares.
 */
export type { PdfProductLayout };

export const PDF_PRODUCT_LAYOUTS: ReadonlyArray<{
  value: PdfProductLayout;
  label: string;
  description: string;
}> = [
  {
    value: "default",
    label: "Padrão",
    description: "Cards em grade nos grupos e um por linha nos itens avulsos.",
  },
  {
    value: "grid",
    label: "Grade",
    description: "Dois cards por linha em toda a proposta.",
  },
  {
    value: "list",
    label: "Lista",
    description: "Um card por linha em toda a proposta.",
  },
  {
    value: "table",
    label: "Tabela",
    description: "Uma linha por item, compacta, com miniatura e valor.",
  },
];

export function resolvePdfProductLayout(value: unknown): PdfProductLayout {
  return PDF_PRODUCT_LAYOUTS.some((layout) => layout.value === value)
    ? (value as PdfProductLayout)
    : "default";
}

/** Dentro de um grupo: dois cards por linha, um, ou tabela. */
export function groupProductArrangement(layout: PdfProductLayout): "pairs" | "single" | "table" {
  if (layout === "table") return "table";
  return layout === "list" ? "single" : "pairs";
}

/** Itens avulsos: o card grande de sempre, pares de cards, ou tabela. */
export function looseProductArrangement(layout: PdfProductLayout): "rows" | "pairs" | "table" {
  if (layout === "table") return "table";
  return layout === "grid" ? "pairs" : "rows";
}

/** Separa os itens em linhas de `size` (1 ou 2). */
export function chunkProducts<T>(products: readonly T[], size: 1 | 2): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < products.length; index += size) {
    rows.push(products.slice(index, index + size));
  }
  return rows;
}
