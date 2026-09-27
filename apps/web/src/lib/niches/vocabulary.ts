/**
 * Vocabulário do domínio de cada nicho: o LOCAL da obra (ambiente, área,
 * pavimento) e o GRUPO de produtos da proposta (solução, sistema, kit), com a
 * concordância de gênero do português.
 *
 * Texto de tela que fala desses conceitos monta a frase com estes helpers, em
 * vez de escrever "ambiente" ou "solução": em segurança o local é "área" e o
 * grupo é "sistema", e a frase precisa concordar ("Nova área", "este sistema").
 *
 * Puro, sem React: o PDF (`/share`, sem TenantProvider) usa
 * `getNicheConfig(tenantNiche).vocabulary` direto. No app, use
 * `useNicheVocabulary()` (`hooks/useNicheVocabulary.ts`).
 *
 * Regra de escrita: uma frase, um termo variável. Frase com dois termos de
 * gênero independente ("o sistema X já está no ambiente Y") vira duas frases.
 */

export type Gender = "m" | "f";

/** Sempre em minúsculas; use `cap` para o início de frase ou título. */
export interface Term {
  singular: string;
  plural: string;
  gender: Gender;
}

export interface NicheVocabulary {
  /** Onde os produtos são instalados: ambiente, área, pavimento. */
  place: Term;
  /** O conjunto que entra na proposta de uma vez: solução, sistema. */
  group: Term;
  /** Exemplos de local, para placeholder e texto de ajuda. */
  placeExamples: string;
  /** Exemplos de grupo, para placeholder e texto de ajuda. */
  groupExamples: string;
  /** Exemplo de nome no cadastro de produto. */
  productNamePlaceholder: string;
}

export const term = (singular: string, plural: string, gender: Gender): Term => ({
  singular,
  plural,
  gender,
});

/** Escolhe a forma pelo gênero do termo: `pick(t, "excluído", "excluída")`. */
export function pick(t: Term, masculine: string, feminine: string): string {
  return t.gender === "f" ? feminine : masculine;
}

export const cap = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

// Artigos, contrações e determinantes que concordam com o termo.
export const o = (t: Term) => pick(t, "o", "a");
export const os = (t: Term) => pick(t, "os", "as");
export const um = (t: Term) => pick(t, "um", "uma");
export const do_ = (t: Term) => pick(t, "do", "da");
export const dos = (t: Term) => pick(t, "dos", "das");
export const no = (t: Term) => pick(t, "no", "na");
export const nos = (t: Term) => pick(t, "nos", "nas");
export const ao = (t: Term) => pick(t, "ao", "à");
export const pelo = (t: Term) => pick(t, "pelo", "pela");
export const este = (t: Term) => pick(t, "este", "esta");
export const deste = (t: Term) => pick(t, "deste", "desta");
export const neste = (t: Term) => pick(t, "neste", "nesta");
export const novo = (t: Term) => pick(t, "novo", "nova");
export const nenhum = (t: Term) => pick(t, "nenhum", "nenhuma");
export const outro = (t: Term) => pick(t, "outro", "outra");
export const outros = (t: Term) => pick(t, "outros", "outras");
export const primeiro = (t: Term) => pick(t, "primeiro", "primeira");
export const seu = (t: Term) => pick(t, "seu", "sua");
export const seus = (t: Term) => pick(t, "seus", "suas");
export const todos = (t: Term) => pick(t, "todos", "todas");
export const cada = (t: Term) => pick(t, "cada um", "cada uma");
export const ele = (t: Term) => pick(t, "ele", "ela");
export const nele = (t: Term) => pick(t, "nele", "nela");

/** "1 área", "3 áreas". */
export function count(t: Term, n: number): string {
  return `${n} ${n === 1 ? t.singular : t.plural}`;
}
