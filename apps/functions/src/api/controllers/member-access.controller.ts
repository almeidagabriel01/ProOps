import { Request, Response } from "express";
import { z } from "zod";
import { db, auth } from "../../init";
import { invalidateRevocationState } from "../../lib/token-revocation";
import { isSuperAdminClaim, isTenantAdminClaim } from "../../lib/request-auth";
import { MEMBER_AUDIT_COLLECTION, recordMemberAudit } from "../../lib/member-audit";
import {
  CLIENT_REPORTED_AUDIT_ACTIONS,
  MEMBER_AUDIT_TARGET_TYPES,
  isMemberAuditAction,
} from "../../shared/member-audit-catalog";
import { logger } from "../../lib/logger";

/**
 * Gestão do acesso da equipe, pelo dono e pelos administradores:
 * - suspender (a conta do Firebase fica desativada, as sessões caem e a vaga
 *   continua ocupada; o histórico fica) e reativar;
 * - encerrar as sessões em todos os aparelhos, sem suspender;
 * - o histórico de ações (`member_audit`), lido só pela API.
 *
 * O tenant vem de `req.user.tenantId` (no "Acessar Painel", o da empresa vista).
 * A revogação leva até 60s para derrubar uma sessão em outra instância
 * (`lib/token-revocation.ts`); na instância que atendeu, vale na hora.
 */

const AUDIT_PAGE_MAX = 200;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function fail(res: Response, error: unknown, fallback: string, event: string) {
  if (error instanceof HttpError) return res.status(error.status).json({ message: error.message });
  logger.error(event, { error: error instanceof Error ? error.message : String(error) });
  return res.status(500).json({ message: fallback });
}

/** O membro da mesma empresa que o dono ou um administrador pode gerir. */
async function loadManagedMember(req: Request): Promise<{ tenantId: string; uid: string; name: string }> {
  const tenantId = String(req.user?.tenantId || "").trim();
  const actorUid = req.user?.uid;
  if (!actorUid || !tenantId) throw new HttpError(403, "Tenant não identificado.");
  if (!isSuperAdminClaim(req) && !isTenantAdminClaim(req)) throw new HttpError(403, "Permissão negada.");
  const memberId = String(req.params.id || "").trim();
  if (!memberId) throw new HttpError(400, "ID obrigatório.");
  if (memberId === actorUid) throw new HttpError(400, "Você não pode fazer isso com a própria conta.");
  const snap = await db.collection("users").doc(memberId).get();
  const data = snap.data();
  if (!snap.exists || String(data?.tenantId || data?.companyId || "") !== tenantId) {
    throw new HttpError(404, "Membro não encontrado.");
  }
  if (String(data?.role || "").toUpperCase() !== "MEMBER") {
    throw new HttpError(400, "Só membros da equipe podem ser suspensos ou ter as sessões encerradas por aqui.");
  }
  return { tenantId, uid: memberId, name: String(data?.name || "") };
}

/** POST /v1/admin/members/:id/suspend */
export async function suspendMember(req: Request, res: Response) {
  try {
    const member = await loadManagedMember(req);
    await auth.updateUser(member.uid, { disabled: true });
    await auth.revokeRefreshTokens(member.uid);
    invalidateRevocationState(member.uid);
    await db.collection("users").doc(member.uid).update({
      status: "suspended",
      suspendedAt: new Date().toISOString(),
      suspendedBy: req.user!.uid,
    });
    await recordMemberAudit({
      tenantId: member.tenantId,
      actorUid: req.user!.uid,
      action: "member_suspended",
      target: { type: "member", id: member.uid, label: member.name },
    });
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao suspender o membro.", "member_suspend_failed");
  }
}

/** POST /v1/admin/members/:id/reactivate */
export async function reactivateMember(req: Request, res: Response) {
  try {
    const member = await loadManagedMember(req);
    await auth.updateUser(member.uid, { disabled: false });
    invalidateRevocationState(member.uid);
    await db.collection("users").doc(member.uid).update({
      status: "active",
      suspendedAt: null,
      suspendedBy: null,
    });
    await recordMemberAudit({
      tenantId: member.tenantId,
      actorUid: req.user!.uid,
      action: "member_reactivated",
      target: { type: "member", id: member.uid, label: member.name },
    });
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao reativar o membro.", "member_reactivate_failed");
  }
}

/** POST /v1/admin/members/:id/revoke-sessions: "Sair de todos os aparelhos". */
export async function revokeMemberSessions(req: Request, res: Response) {
  try {
    const member = await loadManagedMember(req);
    await auth.revokeRefreshTokens(member.uid);
    invalidateRevocationState(member.uid);
    await recordMemberAudit({
      tenantId: member.tenantId,
      actorUid: req.user!.uid,
      action: "member_sessions_revoked",
      target: { type: "member", id: member.uid, label: member.name },
    });
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Erro ao encerrar as sessões.", "member_revoke_sessions_failed");
  }
}

const AuditQuerySchema = z.object({
  memberUid: z.string().trim().min(1).max(128).optional(),
  action: z.string().trim().max(60).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(AUDIT_PAGE_MAX).optional(),
});

/**
 * GET /v1/admin/members/audit: o histórico da empresa, do mais novo para o
 * mais antigo, com filtro por pessoa, ação e período (dias em UTC-3). Só dono
 * e administradores.
 */
export async function listMemberAudit(req: Request, res: Response) {
  const parsed = AuditQuerySchema.safeParse(req.query ?? {});
  if (!parsed.success) return res.status(400).json({ message: "Filtro inválido." });
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    if (!tenantId) throw new HttpError(403, "Tenant não identificado.");
    if (!isSuperAdminClaim(req) && !isTenantAdminClaim(req)) throw new HttpError(403, "Permissão negada.");
    const { memberUid, action, from, to, limit } = parsed.data;
    if (action && !isMemberAuditAction(action)) return res.status(400).json({ message: "Ação desconhecida." });

    let query: FirebaseFirestore.Query = db.collection(MEMBER_AUDIT_COLLECTION).where("tenantId", "==", tenantId);
    if (memberUid) query = query.where("actorUid", "==", memberUid);
    if (action) query = query.where("action", "==", action);
    // O dia começa e termina no horário de Brasília (UTC-3).
    if (from) query = query.where("createdAt", ">=", new Date(`${from}T03:00:00.000Z`).toISOString());
    if (to) {
      const end = new Date(`${to}T03:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      query = query.where("createdAt", "<", end.toISOString());
    }
    const snap = await query.orderBy("createdAt", "desc").limit(limit ?? 100).get();
    const entries = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        actorUid: data.actorUid ?? null,
        actorName: data.actorName ?? null,
        action: data.action,
        targetType: data.targetType ?? null,
        targetId: data.targetId ?? null,
        targetLabel: data.targetLabel ?? null,
        details: data.details ?? null,
        createdAt: data.createdAt ?? null,
      };
    });
    return res.json({ entries });
  } catch (error) {
    return fail(res, error, "Erro ao carregar o histórico.", "member_audit_list_failed");
  }
}

const ClientEventSchema = z
  .object({
    action: z.string().trim().max(60),
    target: z
      .object({
        type: z.enum(MEMBER_AUDIT_TARGET_TYPES),
        label: z.string().trim().max(120).optional(),
      })
      .strict(),
  })
  .strict();

/**
 * POST /v1/audit/events: o que acontece só no navegador e entra no histórico.
 * Hoje é só a exportação de planilha (`CLIENT_REPORTED_AUDIT_ACTIONS`); a
 * identidade e a empresa vêm do token, nunca do corpo.
 */
export async function reportAuditEvent(req: Request, res: Response) {
  const parsed = ClientEventSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ message: "Evento inválido." });
  const { action, target } = parsed.data;
  if (!isMemberAuditAction(action) || !CLIENT_REPORTED_AUDIT_ACTIONS.includes(action)) {
    return res.status(400).json({ message: "Evento não aceito." });
  }
  const tenantId = String(req.user?.tenantId || "").trim();
  const uid = req.user?.uid;
  if (!tenantId || !uid) return res.status(403).json({ message: "Tenant não identificado." });
  await recordMemberAudit({ tenantId, actorUid: uid, action, target: { type: target.type, label: target.label } });
  return res.status(204).send();
}
