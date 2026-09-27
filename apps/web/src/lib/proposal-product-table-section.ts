import { cap, type NicheVocabulary } from "@/lib/niches/vocabulary";

/**
 * Valor GRAVADO em `section.content` da seção `product-table` do PDF, e
 * comparado como marcador pela normalização do editor. É dado, não texto de
 * tela: mudar o valor faria toda proposta já salva parecer fora do padrão e
 * ser reescrita. O que a tela mostra sai de `productTableSectionLabel`.
 */
export const PRODUCT_TABLE_SECTION_MARKER = "Sistemas / Ambientes / Produtos";

/**
 * Os termos do bloco, no plural e em minúsculas: o grupo e o local, sem
 * repetir quando o nicho usa o mesmo termo para os dois (persianas, em que
 * cada grupo é o próprio ambiente).
 */
function productTableTerms(v: NicheVocabulary): string[] {
  return v.group.plural === v.place.plural
    ? [v.group.plural]
    : [v.group.plural, v.place.plural];
}

/** Título do bloco no editor: "Soluções / Ambientes / Produtos". */
export function productTableSectionLabel(v: NicheVocabulary): string {
  return [...productTableTerms(v).map(cap), "Produtos"].join(" / ");
}

/** Nome curto do bloco dentro de uma frase: "Produtos/Soluções/Ambientes". */
export function productTableSectionShortName(v: NicheVocabulary): string {
  return ["Produtos", ...productTableTerms(v).map(cap)].join("/");
}

/** O conteúdo do bloco numa frase: "soluções, ambientes e produtos". */
export function productTableSectionContents(v: NicheVocabulary): string {
  const terms = [...productTableTerms(v), "produtos"];
  return `${terms.slice(0, -1).join(", ")} e ${terms[terms.length - 1]}`;
}
