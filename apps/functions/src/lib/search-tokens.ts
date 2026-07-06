/**
 * buildSearchTokens — gera tokens de busca indexáveis para consultas
 * `array-contains` no Firestore (busca as-you-type por prefixo).
 *
 * Normalização: lowercase, remoção de acentos (NFD), trim, quebra em
 * palavras por whitespace. Para cada palavra são gerados todos os prefixos
 * de 2 a 15 caracteres (palavras com menos de 2 chars são ignoradas).
 * Dedupe via Set, cap de 150 tokens por documento.
 *
 * O cliente web duplica APENAS a normalização do termo (mesmas regras) —
 * a fonte da verdade da geração de tokens é este helper.
 */

const MIN_PREFIX_LENGTH = 2;
const MAX_PREFIX_LENGTH = 15;
const MAX_TOKENS = 150;

/** Normaliza um valor para indexação/busca: lowercase, sem acentos, trim. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function buildSearchTokens(
  ...values: Array<string | undefined | null>
): string[] {
  const tokens = new Set<string>();

  for (const value of values) {
    if (typeof value !== "string" || !value) continue;

    const normalized = normalizeSearchText(value);
    if (!normalized) continue;

    for (const word of normalized.split(/\s+/)) {
      if (word.length < MIN_PREFIX_LENGTH) continue;

      const capped = word.slice(0, MAX_PREFIX_LENGTH);
      for (let length = MIN_PREFIX_LENGTH; length <= capped.length; length++) {
        tokens.add(capped.slice(0, length));
        if (tokens.size >= MAX_TOKENS) {
          return Array.from(tokens);
        }
      }
    }
  }

  return Array.from(tokens);
}
