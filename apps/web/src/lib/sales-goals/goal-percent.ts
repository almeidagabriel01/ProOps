/**
 * Percentual atingido, ou null sem meta. Passa de 100 quando a meta é batida.
 * Puro, para a tela de metas e o card do Dashboard dizerem o mesmo número.
 */
export function goalPercent(achieved: number, target: number | null): number | null {
  if (!target || target <= 0) return null;
  return Math.round((achieved / target) * 100);
}
