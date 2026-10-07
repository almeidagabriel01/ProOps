import { db } from "../init";
import { logger } from "./logger";
import { countsAsTenantAccess, TENANT_PRESENCE_COLLECTION } from "./tenant-last-seen";
import { recordTenantActivity } from "./tenant-activity";

/**
 * Quem está online agora, por empresa e por pessoa, para o painel do super
 * admin.
 *
 * O "Último acesso" (`tenant-last-seen.ts`) só sabe quando alguém ENTROU. Ele
 * não distingue quem entrou às 10h15 e continua usando de quem entrou às 10h15,
 * olhou algo e saiu. Isto responde as duas coisas com um aviso periódico: cada
 * aba aberta manda `POST /v1/session/heartbeat` a cada minuto
 * (`hooks/use-presence-heartbeat.ts`), dizendo se a pessoa está em uso (aba à
 * vista e mexeu nos últimos 5 minutos) ou não.
 *
 * - **online**: houve um aviso "em uso" nos últimos `ACTIVE_WINDOW_MS`;
 * - **ausente**: a aba segue aberta (avisos chegando), mas sem uso;
 * - **offline**: nenhum aviso há mais de `OFFLINE_AFTER_MS`. A sessão termina
 *   no horário do último aviso, que é a hora de saída.
 *
 * Mora em `tenant_presence/{tenantId}` (a sessão da empresa) e
 * `tenant_presence/{tenantId}/people/{uid}` (a de cada pessoa), fora do doc
 * `tenants/{id}` pelo mesmo motivo do último acesso: aquele doc é escutado em
 * tempo real por toda aba da empresa. Só o backend lê e grava.
 *
 * Cada sessão encerrada vira um `session_ended` na atividade da empresa, com a
 * duração. O encerramento é preguiçoso: acontece no próximo aviso da pessoa ou
 * quando o painel consulta a presença (`closeStaleSessions`), sem rotina
 * agendada.
 *
 * Super admin não conta, nem no "Acessar Painel", como no último acesso.
 */

export const PRESENCE_PEOPLE_SUBCOLLECTION = "people";

/** Sem aviso há mais que isto, a pessoa saiu. Folga para o navegador atrasar timer de aba em segundo plano. */
export const OFFLINE_AFTER_MS = 3 * 60 * 1000;
/** Um aviso "em uso" dentro desta janela mantém a pessoa online. Os avisos são de minuto em minuto. */
export const ACTIVE_WINDOW_MS = 2 * 60 * 1000;
/** Antirrepetição por pessoa: várias abas abertas não viram várias escritas por minuto. */
export const HEARTBEAT_DEDUPE_MS = 45 * 1000;
/** Encerramento de sessões paradas roda no máximo uma vez por minuto por instância. */
const CLOSE_STALE_THROTTLE_MS = 60 * 1000;

export type PresenceStatus = "online" | "away" | "offline";

export interface PresenceTimes {
  lastHeartbeatAt?: string | null;
  lastActiveAt?: string | null;
}

function parseMs(iso?: string | null): number | null {
  const ms = Date.parse(String(iso ?? ""));
  return Number.isFinite(ms) ? ms : null;
}

export function presenceStatus(times: PresenceTimes, nowMs: number): PresenceStatus {
  const heartbeat = parseMs(times.lastHeartbeatAt);
  if (heartbeat === null || nowMs - heartbeat > OFFLINE_AFTER_MS) return "offline";
  const active = parseMs(times.lastActiveAt);
  if (active !== null && nowMs - active <= ACTIVE_WINDOW_MS) return "online";
  return "away";
}

export interface SessionState {
  sessionStartedAt: string;
  lastHeartbeatAt: string;
  lastActiveAt: string | null;
  open: boolean;
}

export interface SessionTransition {
  next: SessionState;
  /** Sessão anterior que já tinha acabado quando este aviso chegou. */
  closed: { startedAt: string; endedAt: string } | null;
}

/**
 * Aplica um aviso à sessão gravada. Se a anterior parou de avisar há mais de
 * `OFFLINE_AFTER_MS` (ou já foi encerrada), ela acabou no último aviso e este
 * abre uma nova.
 */
export function applyHeartbeat(
  previous: Partial<SessionState> | null | undefined,
  nowMs: number,
  active: boolean,
): SessionTransition {
  const nowIso = new Date(nowMs).toISOString();
  const lastHeartbeat = parseMs(previous?.lastHeartbeatAt);
  const continues =
    previous?.open === true &&
    lastHeartbeat !== null &&
    Boolean(previous.sessionStartedAt) &&
    nowMs - lastHeartbeat <= OFFLINE_AFTER_MS;

  if (continues) {
    return {
      next: {
        sessionStartedAt: String(previous!.sessionStartedAt),
        lastHeartbeatAt: nowIso,
        lastActiveAt: active ? nowIso : (previous!.lastActiveAt ?? null),
        open: true,
      },
      closed: null,
    };
  }

  const closed =
    previous?.open === true && previous.sessionStartedAt && previous.lastHeartbeatAt
      ? { startedAt: String(previous.sessionStartedAt), endedAt: String(previous.lastHeartbeatAt) }
      : null;
  return {
    next: {
      sessionStartedAt: nowIso,
      lastHeartbeatAt: nowIso,
      lastActiveAt: active ? nowIso : null,
      open: true,
    },
    closed,
  };
}

/** Duração em minutos inteiros, para a atividade. */
export function sessionDurationMinutes(startedAt: string, endedAt: string): number {
  const start = parseMs(startedAt);
  const end = parseMs(endedAt);
  if (start === null || end === null) return 0;
  return Math.max(0, Math.round((end - start) / 60000));
}

const lastBeatByUser = new Map<string, { at: number; active: boolean }>();
const MAX_TRACKED_USERS = 5000;
let lastCloseStaleAt = 0;

export function clearPresenceCachesForTest(): void {
  lastBeatByUser.clear();
  lastCloseStaleAt = 0;
}

export function shouldWriteHeartbeat(
  last: { at: number; active: boolean } | undefined,
  nowMs: number,
  active: boolean,
): boolean {
  if (!last) return true;
  // Voltar a mexer (ou parar) muda o estado: grava na hora.
  if (last.active !== active) return true;
  return nowMs - last.at >= HEARTBEAT_DEDUPE_MS;
}

async function recordSessionEnded(input: {
  tenantId: string;
  uid: string;
  role?: string | null;
  startedAt: string;
  endedAt: string;
}): Promise<void> {
  const endedMs = parseMs(input.endedAt) ?? Date.now();
  await recordTenantActivity({
    tenantId: input.tenantId,
    uid: input.uid,
    role: input.role,
    type: "session_ended",
    source: "server",
    atMs: endedMs,
    meta: { durationMinutes: sessionDurationMinutes(input.startedAt, input.endedAt) },
    // Id fixo pela sessão: o aviso seguinte e o painel podem encerrar a mesma
    // sessão ao mesmo tempo, e ela entra uma vez só.
    docId: `session_${input.tenantId}_${input.uid}_${parseMs(input.startedAt) ?? 0}`,
  });
}

export interface HeartbeatInput {
  tenantId?: string | null;
  uid?: string | null;
  role?: string | null;
  name?: string | null;
  email?: string | null;
  active: boolean;
  nowMs?: number;
}

/** Registra um aviso de presença. Nunca lança. */
export async function recordHeartbeat(input: HeartbeatInput): Promise<void> {
  if (!countsAsTenantAccess(input)) return;
  const uid = String(input.uid || "").trim();
  if (!uid) return;
  const tenantId = String(input.tenantId).trim();
  const nowMs = input.nowMs ?? Date.now();
  const cacheKey = `${tenantId}:${uid}`;
  if (!shouldWriteHeartbeat(lastBeatByUser.get(cacheKey), nowMs, input.active)) return;
  lastBeatByUser.set(cacheKey, { at: nowMs, active: input.active });
  if (lastBeatByUser.size > MAX_TRACKED_USERS) {
    const oldest = lastBeatByUser.keys().next().value;
    if (oldest) lastBeatByUser.delete(oldest);
  }

  const tenantRef = db.collection(TENANT_PRESENCE_COLLECTION).doc(tenantId);
  const personRef = tenantRef.collection(PRESENCE_PEOPLE_SUBCOLLECTION).doc(uid);

  try {
    const closedPerson = await db.runTransaction(async (tx) => {
      const [tenantSnap, personSnap] = await tx.getAll(tenantRef, personRef);
      const tenantData = tenantSnap.exists ? tenantSnap.data() : undefined;
      const company = applyHeartbeat(
        tenantData
          ? {
              sessionStartedAt: tenantData.sessionStartedAt,
              lastHeartbeatAt: tenantData.lastHeartbeatAt,
              lastActiveAt: tenantData.lastActiveAt,
              open: tenantData.hasOpenSession === true,
            }
          : null,
        nowMs,
        input.active,
      );
      const person = applyHeartbeat(
        personSnap.exists ? (personSnap.data() as Partial<SessionState>) : null,
        nowMs,
        input.active,
      );

      tx.set(
        tenantRef,
        {
          tenantId,
          sessionStartedAt: company.next.sessionStartedAt,
          lastHeartbeatAt: company.next.lastHeartbeatAt,
          lastActiveAt: company.next.lastActiveAt,
          hasOpenSession: true,
        },
        { merge: true },
      );
      tx.set(personRef, {
        uid,
        tenantId,
        name: String(input.name || "").slice(0, 120),
        email: String(input.email || "").slice(0, 160),
        role: String(input.role || "").toLowerCase().slice(0, 32),
        ...person.next,
        endedAt: null,
      });
      return person.closed;
    });

    if (closedPerson) {
      await recordSessionEnded({ tenantId, uid, role: input.role, ...closedPerson });
    }
  } catch (err) {
    // Falhou: o próximo aviso tenta de novo.
    lastBeatByUser.delete(cacheKey);
    logger.warn("presence_heartbeat_failed", {
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Encerra as sessões que pararam de avisar: grava a saída e a atividade.
 * Chamado pelo painel antes de ler a presença. Nunca lança.
 */
export async function closeStaleSessions(options: { nowMs?: number; force?: boolean } = {}): Promise<void> {
  const nowMs = options.nowMs ?? Date.now();
  if (!options.force && nowMs - lastCloseStaleAt < CLOSE_STALE_THROTTLE_MS) return;
  lastCloseStaleAt = nowMs;

  try {
    const openTenants = await db
      .collection(TENANT_PRESENCE_COLLECTION)
      .where("hasOpenSession", "==", true)
      .limit(300)
      .get();

    for (const tenantDoc of openTenants.docs) {
      const tenantId = tenantDoc.id;
      const openPeople = await tenantDoc.ref
        .collection(PRESENCE_PEOPLE_SUBCOLLECTION)
        .where("open", "==", true)
        .limit(200)
        .get();

      let stillOpen = 0;
      for (const personDoc of openPeople.docs) {
        const data = personDoc.data() as Partial<SessionState> & { role?: string };
        if (presenceStatus(data, nowMs) !== "offline") {
          stillOpen += 1;
          continue;
        }
        const endedAt = String(data.lastHeartbeatAt || "");
        // Só encerra se ninguém avisou no meio do caminho.
        const closed = await db.runTransaction(async (tx) => {
          const fresh = await tx.get(personDoc.ref);
          const current = fresh.data() as Partial<SessionState> | undefined;
          if (!current?.open || current.lastHeartbeatAt !== data.lastHeartbeatAt) return false;
          tx.update(personDoc.ref, { open: false, endedAt });
          return true;
        });
        if (closed && data.sessionStartedAt) {
          await recordSessionEnded({
            tenantId,
            uid: personDoc.id,
            role: data.role,
            startedAt: String(data.sessionStartedAt),
            endedAt,
          });
        }
      }

      if (stillOpen === 0 && presenceStatus(tenantDoc.data(), nowMs) === "offline") {
        await db.runTransaction(async (tx) => {
          const fresh = await tx.get(tenantDoc.ref);
          if (fresh.get("lastHeartbeatAt") !== tenantDoc.get("lastHeartbeatAt")) return;
          tx.update(tenantDoc.ref, { hasOpenSession: false });
        });
      }
    }
  } catch (err) {
    logger.warn("presence_close_stale_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export interface PresencePerson {
  uid: string;
  name: string;
  email: string;
  role: string;
  status: PresenceStatus;
  sessionStartedAt: string | null;
  lastHeartbeatAt: string | null;
  lastActiveAt: string | null;
}

export interface TenantPresenceSummary {
  status: PresenceStatus;
  sessionStartedAt: string | null;
  lastHeartbeatAt: string | null;
}

/** O que o card e a tabela mostram, a partir do doc da empresa. */
export function summarizeTenantPresence(
  data: Record<string, unknown> | undefined,
  nowMs: number,
): TenantPresenceSummary | undefined {
  if (!data?.lastHeartbeatAt) return undefined;
  return {
    status: presenceStatus(data as PresenceTimes, nowMs),
    sessionStartedAt: (data.sessionStartedAt as string) ?? null,
    lastHeartbeatAt: (data.lastHeartbeatAt as string) ?? null,
  };
}

export interface TenantPresenceEntry extends TenantPresenceSummary {
  tenantId: string;
  people: PresencePerson[];
}

const STATUS_ORDER: Record<PresenceStatus, number> = { online: 0, away: 1, offline: 2 };

/**
 * Empresas que usaram o ERP desde `sinceIso`, com cada pessoa: quem está online
 * ou ausente agora e quem já saiu, com a última sessão.
 */
export async function listTenantPresence(sinceIso: string, nowMs: number = Date.now()): Promise<TenantPresenceEntry[]> {
  await closeStaleSessions({ nowMs });
  const tenants = await db
    .collection(TENANT_PRESENCE_COLLECTION)
    .where("lastHeartbeatAt", ">=", sinceIso)
    .orderBy("lastHeartbeatAt", "desc")
    .limit(200)
    .get();

  const entries = await Promise.all(
    tenants.docs.map(async (tenantDoc) => {
      const people = await tenantDoc.ref
        .collection(PRESENCE_PEOPLE_SUBCOLLECTION)
        .where("lastHeartbeatAt", ">=", sinceIso)
        .limit(200)
        .get();
      const list: PresencePerson[] = people.docs.map((doc) => {
        const data = doc.data();
        return {
          uid: doc.id,
          name: String(data.name || ""),
          email: String(data.email || ""),
          role: String(data.role || ""),
          status: presenceStatus(data, nowMs),
          sessionStartedAt: data.sessionStartedAt ?? null,
          lastHeartbeatAt: data.lastHeartbeatAt ?? null,
          lastActiveAt: data.lastActiveAt ?? null,
        };
      });
      list.sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          String(b.lastHeartbeatAt).localeCompare(String(a.lastHeartbeatAt)),
      );
      const summary = summarizeTenantPresence(tenantDoc.data(), nowMs)!;
      return { tenantId: tenantDoc.id, ...summary, people: list };
    }),
  );

  return entries.sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      String(b.lastHeartbeatAt).localeCompare(String(a.lastHeartbeatAt)),
  );
}
