/**
 * "Último acesso" da empresa, em texto curto para o painel do super admin.
 *
 * O registro é por evento (abriu a plataforma autenticado), gravado uma vez por
 * navegador por dia. A pergunta que ele responde é de dias, não de minutos, e o
 * texto acompanha: abaixo de uma hora ele diz só "há menos de 1 hora".
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatLastSeen(iso?: string | null, now: number = Date.now()): string {
  const raw = String(iso ?? "").trim();
  if (!raw) return "Nunca acessou";

  const seenMs = Date.parse(raw);
  if (!Number.isFinite(seenMs)) return "Nunca acessou";

  const diff = Math.max(0, now - seenMs);
  if (diff < HOUR) return "há menos de 1 hora";
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `há ${hours} ${hours === 1 ? "hora" : "horas"}`;
  }
  const days = Math.floor(diff / DAY);
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(days / 365);
  return `há ${years} ${years === 1 ? "ano" : "anos"}`;
}

/** Quanto tempo faz, em dias completos. `null` quando nunca acessou. */
export function daysSinceLastSeen(
  iso?: string | null,
  now: number = Date.now(),
): number | null {
  const seenMs = Date.parse(String(iso ?? "").trim());
  if (!Number.isFinite(seenMs)) return null;
  return Math.floor(Math.max(0, now - seenMs) / DAY);
}
