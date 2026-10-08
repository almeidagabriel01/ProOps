/**
 * Presença no painel do super admin: online, ausente ou a última sessão
 * ("entrou 10:15, saiu 10:20, 5 min"). O estado vem calculado do backend
 * (`lib/tenant-presence.ts`); aqui só se escreve o texto, sempre no fuso de
 * Brasília, como o "Último acesso" (`last-seen-format.ts`).
 */

import { daysSinceLastSeen, formatLastSeen, formatLastSeenExact } from "@/lib/last-seen-format";

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

export interface AccessDescription {
  /** Linha de cima: "Online agora", "Ausente" ou a data e hora do último acesso. */
  primary: string;
  /** Linha de baixo: "desde 17:16", "saiu há 2 h, ficou 4 min", "entrou há 9 min"... ou vazio. */
  secondary: string;
  /** `null` quando não há presença registrada (só o último acesso antigo). */
  status: PresenceStatus | null;
  /** Nunca acessou, ou o último acesso tem 30 dias ou mais: o painel destaca. */
  stale: boolean;
}

/**
 * Uma linha só para "quando esta empresa usou o ERP", juntando o último acesso
 * e a presença. Separados, eles pareciam se contradizer: "Último acesso 17:19"
 * ao lado de "Online desde 17:16", porque o último acesso anda a cada volta
 * para a aba e a sessão começa na entrada.
 *
 * - online ou ausente: o estado de agora, com o início da sessão;
 * - saiu: a hora da saída (o último aviso), "saiu há 2 h" e quanto ficou;
 * - sem presença depois do último acesso: a hora da entrada, "entrou há 9 min".
 */
export function describeAccess(
  lastSeenAt: string | null | undefined,
  presence: PresenceInfo | null | undefined,
  now: number = Date.now(),
): AccessDescription {
  const hasPresence = Boolean(presence?.lastHeartbeatAt);
  if (presence && hasPresence && presence.status !== "offline") {
    const started = formatPresenceTime(presence.sessionStartedAt, now);
    return presence.status === "online"
      ? { primary: "Online agora", secondary: started ? `desde ${started}` : "", status: "online", stale: false }
      : {
          primary: "Ausente",
          secondary: started ? `entrou ${started}, sem mexer` : "sem mexer",
          status: "away",
          stale: false,
        };
  }

  // A saída da presença é mais precisa que o último acesso, que só anda quando
  // a pessoa abre ou volta para a aba; vale o mais recente dos dois.
  const lastPresence = hasPresence ? presence!.lastHeartbeatAt : null;
  const lastSeenMs = Date.parse(String(lastSeenAt ?? ""));
  const presenceMs = Date.parse(String(lastPresence ?? ""));
  const usePresence = Number.isFinite(presenceMs) && (!Number.isFinite(lastSeenMs) || presenceMs >= lastSeenMs);
  const reference = usePresence ? lastPresence : lastSeenAt;

  const days = daysSinceLastSeen(reference, now);
  const relative = formatLastSeen(reference, now);
  const stayed =
    usePresence && presence
      ? `ficou ${formatSessionDuration(minutesBetween(presence.sessionStartedAt, presence.lastHeartbeatAt))}`
      : "";
  // A hora grande é a SAÍDA quando vem da presença e a ENTRADA quando vem só
  // do aviso de acesso (aba sem presença, como uma aberta antes da publicação
  // que a trouxe). Sem dizer qual, as duas linhas pareciam o mesmo dado.
  const when = relative ? `${usePresence ? "saiu" : "entrou"} ${relative}` : "";
  return {
    primary: formatLastSeenExact(reference),
    secondary: [when, stayed].filter(Boolean).join(", "),
    status: usePresence ? "offline" : null,
    stale: days === null || days >= 30,
  };
}
