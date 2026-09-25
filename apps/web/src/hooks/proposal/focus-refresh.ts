/**
 * Intervalo mínimo entre recargas do catálogo disparadas por foco da aba no
 * formulário de proposta. Antes, cada troca de aba apagava o cache e baixava de
 * novo produtos, serviços, sistemas e ambientes.
 */
export const PROPOSAL_FOCUS_REFRESH_MIN_INTERVAL_MS = 5 * 60_000;

export function shouldRefreshOnFocus(
  lastRefreshAt: number | null,
  nowMs: number,
  minIntervalMs: number = PROPOSAL_FOCUS_REFRESH_MIN_INTERVAL_MS,
): boolean {
  if (lastRefreshAt === null) return true;
  return nowMs - lastRefreshAt >= minIntervalMs;
}
