/**
 * NCM suggestion from a product's name and description.
 *
 * NCM is the only fiscal field with no default and no derivation, and there
 * are over 10.000 codes — nobody memorizes them. Olist Tiny solved this with
 * AI suggestions ranked by confidence, and it is the single highest-leverage
 * thing the ERP can do for the catalogue.
 *
 * Two deliberate constraints:
 *
 *  - **Suggestions are never applied automatically.** The classification is the
 *    client's tax liability, not ours. The model proposes, a human confirms.
 *  - **The parsing is defensive.** A model that returns prose, a fenced code
 *    block, or a malformed code must degrade to "no suggestion", never to a
 *    wrong NCM silently written to a product.
 */

const NCM_LENGTH = 8;
const MAX_SUGGESTIONS = 3;
const MAX_INPUT_LENGTH = 300;

export interface NcmSuggestion {
  /** 8 digits, no punctuation. */
  ncm: string;
  /** Human-readable description of the tariff heading. */
  descricao: string;
  /** Model-reported confidence, 0 to 1. */
  confianca: number;
}

export interface NcmSuggestionInput {
  nome: string;
  descricao?: string;
  categoria?: string;
  fabricante?: string;
}

export const NCM_SYSTEM_PROMPT = [
  "Você é um especialista em classificação fiscal brasileira (NCM - Nomenclatura Comum do Mercosul).",
  "Receberá a descrição de um produto e deve sugerir os códigos NCM mais prováveis.",
  "",
  "Regras obrigatórias:",
  "- Responda APENAS com um array JSON válido, sem texto antes ou depois, sem markdown.",
  `- No máximo ${MAX_SUGGESTIONS} sugestões, da mais provável para a menos provável.`,
  '- Cada item deve ter exatamente: {"ncm": "00000000", "descricao": "...", "confianca": 0.0}',
  "- O campo ncm deve ter exatamente 8 dígitos, sem pontos.",
  "- confianca é um número entre 0 e 1.",
  "- Se não houver informação suficiente para classificar, responda [].",
  "- Nunca invente um código para parecer útil: prefira retornar [] a chutar.",
].join("\n");

/** Truncates and trims so a long description cannot blow the prompt budget. */
function clamp(value: string | undefined): string {
  return String(value || "").trim().slice(0, MAX_INPUT_LENGTH);
}

export function buildNcmPrompt(input: NcmSuggestionInput): string {
  const lines = [`Produto: ${clamp(input.nome)}`];

  const descricao = clamp(input.descricao);
  if (descricao) lines.push(`Descrição: ${descricao}`);

  const categoria = clamp(input.categoria);
  if (categoria) lines.push(`Categoria: ${categoria}`);

  const fabricante = clamp(input.fabricante);
  if (fabricante) lines.push(`Fabricante: ${fabricante}`);

  lines.push("", "Sugira os NCMs mais prováveis para este produto.");
  return lines.join("\n");
}

/**
 * Strips a markdown fence, which models add even when told not to.
 * Returns the inner content, or the original string when unfenced.
 */
function stripCodeFence(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : raw.trim();
}

function normalizeConfidence(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  // Models occasionally answer with a percentage instead of a fraction.
  const scaled = parsed > 1 && parsed <= 100 ? parsed / 100 : parsed;
  return Math.min(1, Math.max(0, scaled));
}

/**
 * Parses the model output into validated suggestions.
 *
 * Never throws: any malformed shape yields an empty list, because "no
 * suggestion" is a fine outcome and a wrong NCM is not. Codes are deduplicated
 * and sorted by descending confidence.
 */
export function parseNcmSuggestions(raw: string): NcmSuggestion[] {
  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const seen = new Set<string>();
  const suggestions: NcmSuggestion[] = [];

  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;

    const candidate = item as Record<string, unknown>;
    const ncm = String(candidate.ncm ?? "").replace(/\D/g, "");
    if (ncm.length !== NCM_LENGTH || seen.has(ncm)) continue;

    seen.add(ncm);
    suggestions.push({
      ncm,
      descricao: String(candidate.descricao ?? "").trim().slice(0, 200),
      confianca: normalizeConfidence(candidate.confianca),
    });
  }

  return suggestions
    .sort((a, b) => b.confianca - a.confianca)
    .slice(0, MAX_SUGGESTIONS);
}

/** Max tokens the suggestion response needs — three short JSON objects. */
export const NCM_MAX_OUTPUT_TOKENS = 400;
