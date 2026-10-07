/**
 * Presença no painel do super admin: online, ausente ou a última sessão
 * ("entrou 10:15, saiu 10:20, 5 min"). O estado vem calculado do backend
 * (`lib/tenant-presence.ts`); aqui só se escreve o texto, sempre no fuso de
 * Brasília, como o "Último acesso" (`last-seen-format.ts`).
 */

export type PresenceStatus = "online" | "away" | "offline";

export interface PresenceInfo {
  status: PresenceStatus;
  sessionStartedAt: string | null;
  lastHeartbeatAt: string | null;
}

const TIME_ZONE = "America/Sao_Paulo";

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

const dayFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
});

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function parse(iso?: string | null): number | null {
  const ms = Date.parse(String(iso ?? ""));
  return Number.isFinite(ms) ? ms : null;
}

/** "10:15", ou "06/10 10:15" quando não é hoje. */
export function formatPresenceTime(iso?: string | null, now: number = Date.now()): string {
  const ms = parse(iso);
  if (ms === null) return "";
  const date = new Date(ms);
  const time = timeFormatter.format(date);
  return dayKeyFormatter.format(date) === dayKeyFormatter.format(new Date(now))
    ? time
    : `${dayFormatter.format(date)} ${time}`;
}

/** "menos de 1 min", "5 min", "2 h", "1 h 05". */
export function formatSessionDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 1) return "menos de 1 min";
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

function minutesBetween(fromIso?: string | null, toIso?: string | null): number {
  const from = parse(fromIso);
  const to = parse(toIso);
  if (from === null || to === null) return 0;
  return Math.max(0, (to - from) / 60000);
}

export const PRESENCE_STATUS_LABELS: Record<PresenceStatus, string> = {
  online: "Online",
  away: "Ausente",
  offline: "Offline",
};

/**
 * Uma linha que responde "está aí ou já saiu?":
 * - "Online desde 10:15"
 * - "Ausente, entrou 10:15"
 * - "Saiu 10:20, ficou 5 min"
 */
export function describePresence(info: PresenceInfo | null | undefined, now: number = Date.now()): string {
  if (!info?.lastHeartbeatAt) return "";
  const started = formatPresenceTime(info.sessionStartedAt, now);
  if (info.status === "online") return `Online desde ${started}`;
  if (info.status === "away") return `Ausente, entrou ${started}`;
  const duration = formatSessionDuration(minutesBetween(info.sessionStartedAt, info.lastHeartbeatAt));
  return `Saiu ${formatPresenceTime(info.lastHeartbeatAt, now)}, ficou ${duration}`;
}
