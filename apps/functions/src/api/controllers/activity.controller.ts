import { Request, Response } from "express";
import { IngestRateGuard } from "../../lib/observability/ingest-rate-guard";
import { resolveActivityIdentity } from "../../lib/tenant-activity-identity";
import {
  buildActivityDoc,
  recordTenantActivityBatch,
  type TenantActivityDoc,
} from "../../lib/tenant-activity";
import { getActivityDefinition, isTenantActivityType } from "../../shared/tenant-activity-catalog";
import { logger } from "../../lib/logger";

export const MAX_ACTIVITY_BATCH = 25;
/** O horário do navegador vale dentro desta janela; fora dela, vale o do servidor. */
const CLIENT_CLOCK_PAST_MS = 10 * 60 * 1000;
const CLIENT_CLOCK_FUTURE_MS = 60 * 1000;

// Por instância, como o guard de erros: o navegador manda no máximo um lote a
// cada 5s, então isto só segura tela em laço ou cliente adulterado.
const batchGuard = new IngestRateGuard(90, 5 * 60 * 1000);
const eventGuard = new IngestRateGuard(1000, 60 * 60 * 1000);

/**
 * Resposta do limitador por IP da ingestão. Diferente do padrão, não grava
 * evento de auditoria: a fonte é barulhenta por natureza e encheria a
 * auditoria com o que não é incidente de segurança.
 */
export function activityLimitResponse(
  _req: Request,
  res: Response,
  decision: { retryAfterSeconds: number },
): void {
  res.set("Retry-After", String(Math.max(decision.retryAfterSeconds, 1)));
  res.status(429).json({ message: "Too many requests" });
}

export function resolveClientEventTime(at: unknown, nowMs: number): number {
  if (typeof at !== "number" || !Number.isFinite(at)) return nowMs;
  if (at < nowMs - CLIENT_CLOCK_PAST_MS || at > nowMs + CLIENT_CLOCK_FUTURE_MS) return nowMs;
  return at;
}

/**
 * POST /v1/activity/events
 * Body: { idToken, sessionId?, events: [{ type, route?, meta?, at? }] }
 *
 * Montado ANTES da barreira de autenticação e do gate de assinatura: chega por
 * `sendBeacon` (sem cabeçalho) e precisa registrar a conta free e a bloqueada.
 * A identidade vem só do token do corpo; `tenantId`, `uid` e `role` do corpo
 * são ignorados.
 */
export async function ingestActivityEvents(req: Request, res: Response): Promise<Response> {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const identity = await resolveActivityIdentity(body.idToken);
    if (!identity) return res.status(401).json({ message: "Token inválido" });
    if (identity.isSuperAdmin || !identity.tenantId) {
      return res.status(202).json({ accepted: 0 });
    }

    const nowMs = Date.now();
    if (!batchGuard.allow(identity.uid, nowMs)) {
      return res.status(429).json({ message: "Too many requests" });
    }

    const rawEvents = Array.isArray(body.events) ? body.events.slice(0, MAX_ACTIVITY_BATCH) : [];
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
    const docs: TenantActivityDoc[] = [];
    for (const raw of rawEvents) {
      if (!raw || typeof raw !== "object") continue;
      const event = raw as Record<string, unknown>;
      if (!isTenantActivityType(event.type)) continue;
      if (!getActivityDefinition(event.type).client) continue;
      if (!eventGuard.allow(identity.uid, nowMs)) break;
      const doc = buildActivityDoc(
        {
          tenantId: identity.tenantId,
          uid: identity.uid,
          role: identity.role,
          type: event.type,
          route: typeof event.route === "string" ? event.route : null,
          meta: (event.meta as Record<string, unknown> | undefined) ?? null,
          source: "client",
          sessionId,
          atMs: resolveClientEventTime(event.at, nowMs),
        },
        nowMs,
      );
      if (doc) docs.push(doc);
    }

    const accepted = await recordTenantActivityBatch(docs);
    return res.status(202).json({ accepted });
  } catch (error) {
    logger.warn("tenant_activity_ingest_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Internal server error" });
  }
}
