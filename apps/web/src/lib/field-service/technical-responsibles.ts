import type { Council, TechnicalResponsible } from "@/types/field-service";

/**
 * Regras de tela dos responsáveis técnicos do PMOC. A situação da ART segue a
 * mesma régua do backend (`artStatus` em
 * `technical-responsible-model.ts`), que é quem avisa na rotina diária.
 */

export const COUNCIL_OPTIONS: { value: Council; label: string }[] = [
  { value: "CREA", label: "CREA (engenheiro)" },
  { value: "CFT", label: "CFT (técnico industrial)" },
  { value: "CAU", label: "CAU (arquiteto)" },
];

/** O PDF da ART vai em base64 num corpo de 1 MB: uns 700 KB de arquivo. */
export const ART_MAX_BYTES = 700 * 1024;

export const ART_EXPIRING_DAYS = 30;

export type ArtStatus = "missing" | "valid" | "expiring" | "expired";

export function artStatus(artValidUntil: string | null | undefined, today: string): ArtStatus {
  if (!artValidUntil) return "missing";
  if (artValidUntil < today) return "expired";
  const limit = new Date(`${today}T12:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + ART_EXPIRING_DAYS);
  return artValidUntil <= limit.toISOString().slice(0, 10) ? "expiring" : "valid";
}

export const ART_STATUS_LABELS: Record<ArtStatus, string> = {
  missing: "Sem validade",
  valid: "ART em dia",
  expiring: "ART vencendo",
  expired: "ART vencida",
};

export const ART_STATUS_STYLES: Record<ArtStatus, string> = {
  missing: "border-slate-300 bg-slate-500/10 text-slate-700 dark:border-slate-600 dark:text-slate-300",
  valid: "border-emerald-300 bg-emerald-500/15 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-300",
  expiring: "border-amber-300 bg-amber-500/15 text-amber-700 dark:border-amber-500/40 dark:text-amber-300",
  expired: "border-red-300 bg-red-500/15 text-red-700 dark:border-red-500/40 dark:text-red-300",
};

/** Ativos primeiro, depois por nome. */
export function sortResponsibles(list: readonly TechnicalResponsible[]): TechnicalResponsible[] {
  return [...list].sort(
    (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "pt-BR"),
  );
}

/** Hoje no fuso de Brasília, em "AAAA-MM-DD". */
export function todayInBrazil(now = new Date()): string {
  return new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
