import { toISODateString } from "@/utils/date-utils";

/** Espelho de `DEFAULT_PROPOSAL_VALIDITY_DAYS` do backend (`proposal-numbering.ts`). */
export const DEFAULT_PROPOSAL_VALIDITY_DAYS = 30;

/**
 * Data de validade sugerida para a proposta nova: hoje + N dias, em data local.
 *
 * `days` vem da configuração da empresa. Ausente (backend antigo, leitura que
 * falhou) ou inválido, cai no padrão: o campo é obrigatório, e deixá-lo vazio
 * custava uma ida ao calendário em toda proposta.
 */
export function defaultProposalValidUntil(
  days: number | null | undefined,
  today: Date = new Date(),
): string {
  const validDays =
    typeof days === "number" && Number.isInteger(days) && days >= 1
      ? days
      : DEFAULT_PROPOSAL_VALIDITY_DAYS;
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  date.setDate(date.getDate() + validDays);
  return toISODateString(date);
}
