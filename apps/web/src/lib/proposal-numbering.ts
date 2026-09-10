/**
 * Montagem do código da proposta no lado do cliente.
 *
 * É uma CÓPIA da regra do backend (`api/controllers/proposal-numbering.ts`),
 * que é quem aloca o número de verdade. Existe para a tela de configuração
 * mostrar a prévia enquanto a pessoa mexe nos campos, sem uma ida ao servidor
 * por tecla digitada.
 *
 * Fica em `lib/` e não junto do service de propósito: o service importa o
 * `api-client`, que puxa o SDK do Firebase, e quem precisa só da aritmética
 * passaria a inicializar auth, firestore e storage junto.
 *
 * Guard da paridade com o backend: `src/__tests__/proposal-code-preview.test.ts`.
 */

/** Mesma normalização do backend: maiúsculas, sem acento, só letras e dígitos. */
export function normalizePraca(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 8);
}

/** Sequencial com zeros à esquerda + ano de dois dígitos + praça. */
export function buildProposalCodePreview(params: {
  number: number;
  year: number;
  praca?: string | null;
  digits?: number;
}): string {
  const digits = Math.min(10, Math.max(1, Math.floor(params.digits ?? 5) || 5));
  const sequencial = String(Math.max(1, Math.floor(params.number))).padStart(
    digits,
    "0",
  );
  const ano = String(params.year % 100).padStart(2, "0");
  return `${sequencial}${ano}${normalizePraca(params.praca)}`;
}
