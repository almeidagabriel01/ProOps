import type { Request, Response } from "express";
import { recordTenantLastSeen } from "../../lib/tenant-last-seen";
import { logger } from "../../lib/logger";
import { recordTenantActivity } from "../../lib/tenant-activity";
import { recordHeartbeat } from "../../lib/tenant-presence";

/** "Entrou no ERP" conta uma vez a cada meia hora por pessoa, por instancia. */
export const SESSION_ACTIVITY_DEDUPE_MS = 30 * 60 * 1000;
const MAX_TRACKED_SESSIONS = 5000;
const lastSessionActivityAt = new Map<string, number>();

export function clearSessionActivityCacheForTest(): void {
  lastSessionActivityAt.clear();
}

async function recordSessionStarted(req: Request, nowMs: number): Promise<void> {
  const uid = req.user?.uid;
  if (!uid || req.user?.isSuperAdmin || req.user?.impersonation) return;
  const last = lastSessionActivityAt.get(uid);
  if (last !== undefined && nowMs - last < SESSION_ACTIVITY_DEDUPE_MS) return;
  lastSessionActivityAt.set(uid, nowMs);
  if (lastSessionActivityAt.size > MAX_TRACKED_SESSIONS) {
    const oldest = lastSessionActivityAt.keys().next().value;
    if (oldest) lastSessionActivityAt.delete(oldest);
  }
  await recordTenantActivity({
    tenantId: req.user?.tenantId,
    uid,
    role: req.user?.role,
    type: "session_started",
    source: "server",
  });
}

/**
 * `POST /v1/session/ping` — a plataforma abriu autenticada.
 *
 * O frontend chama isto uma vez por sessao do navegador (login novo ou sessao
 * que ja existia) e de novo no primeiro acesso de cada dia. E o que alimenta o
 * "Ultima vez online" do painel do super admin.
 *
 * Precisa estar liberado para conta GRATUITA: a pergunta que originou isto e
 * justamente "a empresa que criou a conta e nao assinou voltou a entrar?".
 */
export const pingSession = async (req: Request, res: Response) => {
  try {
    await recordTenantLastSeen({
      tenantId: req.user?.tenantId,
      role: req.user?.role,
    });
    await recordSessionStarted(req, Date.now());
    return res.status(204).send();
  } catch (error: unknown) {
    // Registrar presenca nunca derruba a tela de quem entrou.
    logger.warn("session_ping_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(204).send();
  }
};

/**
 * `POST /v1/session/heartbeat` — a aba segue aberta (a cada minuto).
 *
 * `{ active: true }` quando a pessoa está em uso (aba à vista e mexeu nos
 * últimos 5 minutos). Alimenta o "Online agora" do painel do super admin
 * (`lib/tenant-presence.ts`). Super admin, inclusive no "Ver como membro" (em
 * que a request já vale como o membro), não conta.
 */
export const heartbeatSession = async (req: Request, res: Response) => {
  try {
    if (req.user && !req.user.isSuperAdmin && !req.user.impersonation) {
      const userDoc = (req.user.userDoc ?? {}) as Record<string, unknown>;
      await recordHeartbeat({
        tenantId: req.user.tenantId,
        uid: req.user.uid,
        role: req.user.role,
        name: typeof userDoc.name === "string" ? userDoc.name : null,
        email: typeof userDoc.email === "string" ? userDoc.email : (req.user.email ?? null),
        active: req.body?.active === true,
      });
    }
  } catch (error: unknown) {
    logger.warn("session_heartbeat_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return res.status(204).send();
};
