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

/**
 * Tokens do telefone, pelos DÍGITOS: a busca de Contatos acha o número
 * digitado do início (com ou sem 55, com ou sem DDD) e pelos 4 últimos
 * dígitos. Pela regra genérica, "(35) 99999-1234" viraria as palavras "(35)"
 * e "99999-1234", e "3599999" não acharia nada.
 */
export function buildPhoneSearchTokens(phone: string | undefined | null): string[] {
  if (typeof phone !== "string") return [];
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return [];

  const variants = new Set<string>([digits]);
  if (digits.startsWith("55") && digits.length >= 12) variants.add(digits.slice(2));
  for (const variant of Array.from(variants)) {
    if (variant.length >= 10 && variant.length <= 11) variants.add(variant.slice(2));
  }

  const tokens = new Set<string>();
  for (const variant of variants) {
    const capped = variant.slice(0, MAX_PREFIX_LENGTH);
    for (let length = MIN_PREFIX_LENGTH; length <= capped.length; length++) {
      tokens.add(capped.slice(0, length));
    }
  }
  tokens.add(digits.slice(-4));
  return Array.from(tokens);
}

/** Tokens de um contato: nome, e-mail e telefone por palavra, mais os dígitos do telefone. */
export function buildClientSearchTokens(
  name: string | undefined | null,
  email: string | undefined | null,
  phone: string | undefined | null,
): string[] {
  const tokens = new Set(buildSearchTokens(name, email, phone));
  for (const token of buildPhoneSearchTokens(phone)) tokens.add(token);
  return Array.from(tokens);
}

/**
 * Termo de busca → consulta indexada: o token para `array-contains` e as
 * palavras (ou dígitos) para refinar o resultado. Mesma regra do front
 * (`apps/web/src/lib/search-term.ts`): termo sem letra e com 2+ dígitos é
 * telefone; senão vale a primeira palavra com 2+ caracteres. `null` quando o
 * termo não tem nada indexável.
 */
export function parseSearchQuery(term: string): {
  token: string;
  words: string[];
  digits: string | null;
} | null {
  const trimmed = String(term || "").trim();
  if (!trimmed) return null;
  if (!/[a-z]/i.test(normalizeSearchText(trimmed))) {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length >= MIN_PREFIX_LENGTH) {
      const capped = digits.slice(0, MAX_PREFIX_LENGTH);
      return { token: capped, words: [], digits: capped };
    }
  }
  const words = normalizeSearchText(trimmed).split(/\s+/).filter(Boolean);
  const first = words.find((w) => w.length >= MIN_PREFIX_LENGTH);
  if (!first) return null;
  return { token: first.slice(0, MAX_PREFIX_LENGTH), words, digits: null };
}

/** true quando todas as palavras aparecem em algum dos campos (sem acento/caixa). */
export function matchesAllWords(words: string[], fields: Array<string | undefined | null>): boolean {
  const haystacks = fields.map((f) => normalizeSearchText(String(f || "")));
  return words.every((word) => haystacks.some((h) => h.includes(word)));
}
