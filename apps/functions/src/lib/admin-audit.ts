import type { Request } from "express";
import { writeSecurityAuditEvent } from "./security-observability";

/**
 * Registra uma acao do superadmin em `security_audit_events`.
 *
 * Sempre aguardado: no Cloud Run a CPU congela quando a resposta sai, entao um
 * write disparado sem `await` se perde em silencio (ver apps/functions/CLAUDE.md,
 * "Trabalho assincrono depois da resposta"). `writeSecurityAuditEvent` ja engole
 * a propria falha, entao aguardar nunca derruba a request.
 */
export async function auditAdminAction(
  req: Request,
  eventType: string,
  params: { tenantId?: string; targetId?: string; reason?: string } = {},
): Promise<void> {
  await writeSecurityAuditEvent({
    eventType,
    uid: req.user?.uid,
    tenantId: params.tenantId,
    eventId: params.targetId,
    route: req.originalUrl || req.path,
    requestId: req.requestId,
    reason: params.reason,
    source: "admin_controller",
  });
}
