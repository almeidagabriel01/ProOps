import { db } from "../../init";
import { isTenantAdminRole } from "../../lib/auth-context";
import type { PagePermissionMap } from "../../lib/auth-helpers";
import {
  NOTIFICATION_CATALOG,
  resolveChannelPreference,
  type NotificationPreferences,
  type NotificationType,
} from "../../shared/notification-catalog";

/**
 * Quem recebe cada notificação.
 *
 * Até a central de notificações, toda notificação valia para a empresa
 * inteira: um membro sem acesso ao financeiro via "pagamento recebido", e a
 * leitura de um marcava para todos. Agora cada documento carrega
 * `recipientUids`, resolvido na criação a partir do catálogo, das permissões
 * de cada pessoa e das preferências dela. As rules leem esse campo, então a
 * filtragem não depende da tela.
 */

export interface AudienceMember {
  uid: string;
  email: string | null;
  isAdmin: boolean;
  permissions: PagePermissionMap;
  preferences: NotificationPreferences | undefined;
}

export interface NotificationRecipients {
  recipientUids: string[];
  emailRecipients: Array<{ uid: string; email: string }>;
}

const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 500;
const MEMBERS_LIMIT = 200;
const cache = new Map<string, { expiresAt: number; members: AudienceMember[] }>();

function normalizeRole(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

/** Pura: decide os destinatários de um tipo entre as pessoas da empresa. */
export function resolveRecipients(
  members: AudienceMember[],
  type: NotificationType,
): NotificationRecipients {
  const { audience } = NOTIFICATION_CATALOG[type];
  const recipientUids: string[] = [];
  const emailRecipients: Array<{ uid: string; email: string }> = [];

  for (const member of members) {
    const canSee =
      member.isAdmin ||
      (audience !== "admins" && member.permissions[audience]?.canView === true);
    if (!canSee) continue;

    const channel = resolveChannelPreference(member.preferences, type);
    if (channel.inApp) recipientUids.push(member.uid);
    if (channel.email && member.email) {
      emailRecipients.push({ uid: member.uid, email: member.email });
    }
  }

  return { recipientUids, emailRecipients };
}

async function fetchTenantMembers(tenantId: string): Promise<AudienceMember[]> {
  const snap = await db
    .collection("users")
    .where("tenantId", "==", tenantId)
    .limit(MEMBERS_LIMIT)
    .get();

  const members = await Promise.all(
    snap.docs.map(async (doc): Promise<AudienceMember | null> => {
      const data = doc.data();
      const role = normalizeRole(data.role);
      // O superadmin tem o próprio escopo ("system") e não é pessoa da empresa.
      if (role === "SUPERADMIN") return null;
      // A conta free é a dona do próprio tenant.
      const isAdmin = role === "FREE" || isTenantAdminRole(role);

      const permissions: PagePermissionMap = {};
      if (!isAdmin) {
        const permsSnap = await doc.ref.collection("permissions").get();
        permsSnap.forEach((perm) => {
          permissions[perm.id] = perm.data() as Record<string, boolean>;
        });
      }

      const preferences = (data.preferences as { notifications?: NotificationPreferences } | undefined)
        ?.notifications;
      const email = typeof data.email === "string" && data.email.includes("@") ? data.email : null;

      return { uid: doc.id, email, isAdmin, permissions, preferences };
    }),
  );

  return members.filter((m): m is AudienceMember => m !== null);
}

/**
 * Pessoas da empresa com permissões e preferências. Guardado por 60s por
 * instância: um cron cria dezenas de notificações do mesmo tenant seguidas, e
 * reler usuários e permissões a cada uma multiplicaria as leituras.
 */
export async function loadTenantAudience(tenantId: string): Promise<AudienceMember[]> {
  const now = Date.now();
  const cached = cache.get(tenantId);
  if (cached && cached.expiresAt > now) return cached.members;

  const members = await fetchTenantMembers(tenantId);
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(tenantId, { expiresAt: now + CACHE_TTL_MS, members });
  return members;
}

/** Mudou preferência ou permissão: a próxima notificação relê. */
export function invalidateTenantAudience(tenantId: string): void {
  cache.delete(tenantId);
}

export async function resolveTenantRecipients(
  tenantId: string,
  type: NotificationType,
): Promise<NotificationRecipients> {
  return resolveRecipients(await loadTenantAudience(tenantId), type);
}

/** Só para teste. */
export function clearAudienceCacheForTest(): void {
  cache.clear();
}
