/**
 * Normalização de termo de busca para consultas indexadas via `searchTokens`
 * (array-contains). Duplica APENAS as regras de normalização do backend —
 * a fonte da verdade da geração de tokens é
 * apps/functions/src/lib/search-tokens.ts (lowercase, sem acentos NFD, trim,
 * palavras por whitespace, prefixos de 2 a 15 chars).
 */

const MIN_TOKEN_LENGTH = 2;
const MAX_TOKEN_LENGTH = 15;

/** Normaliza e quebra o termo em palavras (lowercase, sem acentos, trim). */
export function normalizeSearchWords(term: string): string[] {
  return term
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Primeira palavra utilizável como token indexado (>= 2 chars, truncada em
 * 15 chars — mesmo cap de prefixo do backend). `null` se o termo não tem
 * palavra utilizável (ex.: termo com menos de 2 chars).
 */
export function firstSearchToken(term: string): string | null {
  const word = normalizeSearchWords(term).find(
    (w) => w.length >= MIN_TOKEN_LENGTH,
  );
  return word ? word.slice(0, MAX_TOKEN_LENGTH) : null;
}
