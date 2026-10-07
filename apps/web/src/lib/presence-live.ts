/**
 * A presença que veio junto com a lista de empresas (`tenant.presence`) é uma
 * foto do momento em que a lista carregou. O painel consulta a presença de
 * novo a cada 30 segundos (`GET /v1/admin/presence`) e aplica a resposta por
 * cima, sem recarregar a lista inteira.
 *
 * A resposta traz toda empresa que usou o ERP desde a meia-noite (Brasília),
 * então quem está online ou ausente sempre está nela. Empresa fora dela:
 * - se a foto dizia online ou ausente, a foto ficou velha (a sessão parou antes
 *   da meia-noite) e ela passa a offline;
 * - senão, a foto continua valendo (é a última sessão, de outro dia).
 */

import type { PresenceInfo } from "@/lib/presence-format";

interface LivePresenceSnapshot {
  tenants: Array<PresenceInfo & { tenantId: string }>;
}

interface WithTenantPresence {
  tenant: { id: string; presence?: PresenceInfo };
}

export function withLivePresence<T extends WithTenantPresence>(
  items: T[],
  snapshot: LivePresenceSnapshot | null | undefined,
): T[] {
  if (!snapshot) return items;
  const live = new Map(snapshot.tenants.map((entry) => [entry.tenantId, entry]));
  return items.map((item) => {
    const entry = live.get(item.tenant.id);
    const current = item.tenant.presence;
    let next: PresenceInfo | undefined;
    if (entry) {
      next = {
        status: entry.status,
        sessionStartedAt: entry.sessionStartedAt,
        lastHeartbeatAt: entry.lastHeartbeatAt,
      };
    } else if (current && current.status !== "offline") {
      next = { ...current, status: "offline" };
    } else {
      return item;
    }
    if (
      current &&
      current.status === next.status &&
      current.sessionStartedAt === next.sessionStartedAt &&
      current.lastHeartbeatAt === next.lastHeartbeatAt
    ) {
      return item;
    }
    return { ...item, tenant: { ...item.tenant, presence: next } };
  });
}
