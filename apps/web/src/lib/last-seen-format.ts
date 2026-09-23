/**
 * "Último acesso" da empresa no painel do super admin: dia e horário exatos,
 * mais o tempo relativo.
 *
 * O registro é por evento (abriu a plataforma ou voltou para a aba), e a hora
 * gravada é a daquele instante, então a tela pode mostrar o horário exato. A
 * primeira versão arredondava tudo abaixo de uma hora para "há menos de 1
 * hora", herança de quando o registro tinha janela de 15 minutos.
 *
 * O horário sai sempre no fuso de Brasília, não no do navegador: o painel
 * compara empresas entre si, e um super admin viajando veria outro relógio.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const TIME_ZONE = "America/Sao_Paulo";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

function parse(iso?: string | null): number | null {
  const ms = Date.parse(String(iso ?? "").trim());
  return Number.isFinite(ms) ? ms : null;
}

/** "23/09/2026 às 14:32", ou "Nunca acessou". */
export function formatLastSeenExact(iso?: string | null): string {
  const ms = parse(iso);
  if (ms === null) return "Nunca acessou";
  const date = new Date(ms);
  return `${dateFormatter.format(date)} às ${timeFormatter.format(date)}`;
}

/** "agora", "há 12 min", "há 3 h", "ontem", "há 9 dias"... ou "" sem registro. */
export function formatLastSeen(iso?: string | null, now: number = Date.now()): string {
  const ms = parse(iso);
  if (ms === null) return "";

  const diff = Math.max(0, now - ms);
  if (diff < MINUTE) return "agora";
  if (diff < HOUR) return `há ${Math.floor(diff / MINUTE)} min`;
  if (diff < DAY) return `há ${Math.floor(diff / HOUR)} h`;
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
  const ms = parse(iso);
  if (ms === null) return null;
  return Math.floor(Math.max(0, now - ms) / DAY);
}
