import { Timestamp } from "firebase-admin/firestore";
import { db } from "../init";
import { logger } from "./logger";
import {
  MEMBER_AUDIT_RETENTION_DAYS,
  isMemberAuditAction,
  type MemberAuditAction,
  type MemberAuditTargetType,
} from "../shared/member-audit-catalog";

export const MEMBER_AUDIT_COLLECTION = "member_audit";

const LABEL_MAX = 120;
const DETAIL_KEYS_MAX = 12;

export interface MemberAuditEntry {
  tenantId: string;
  actorUid: string;
  action: MemberAuditAction;
  target: { type: MemberAuditTargetType; id?: string | null; label?: string | null };
  /** Pequeno, sem dado pessoal: antes e depois de uma permissão, valor de um ajuste. */
  details?: Record<string, string | number | boolean | null>;
}

function shortLabel(value: string | null | undefined): string | null {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, LABEL_MAX) : null;
}

function cleanDetails(details: MemberAuditEntry["details"]): MemberAuditEntry["details"] | null {
  if (!details) return null;
  const entries = Object.entries(details)
    .filter(([, v]) => v === null || ["string", "number", "boolean"].includes(typeof v))
    .slice(0, DETAIL_KEYS_MAX)
    .map(([k, v]) => [k.slice(0, 60), typeof v === "string" ? v.slice(0, LABEL_MAX) : v]);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

/**
 * Grava uma ação no histórico da equipe. Nunca derruba a ação que a gerou:
 * falha vira log. Quem chama AGUARDA (`await`): no Cloud Run, promessa
 * pendente ao fim da request é escrita perdida sem rastro.
 *
 * O nome de quem agiu é lido aqui (uma leitura) para o histórico continuar
 * legível depois que o membro sair da empresa.
 */
export async function recordMemberAudit(entry: MemberAuditEntry): Promise<void> {
  try {
    if (!entry.tenantId || !entry.actorUid || !isMemberAuditAction(entry.action)) return;
    const actor = await db.collection("users").doc(entry.actorUid).get();
    const actorName = shortLabel((actor.data()?.name as string | undefined) ?? null);
    const now = Date.now();
    await db.collection(MEMBER_AUDIT_COLLECTION).add({
      tenantId: entry.tenantId,
      actorUid: entry.actorUid,
      actorName,
      action: entry.action,
      targetType: entry.target.type,
      targetId: entry.target.id ? String(entry.target.id).slice(0, 128) : null,
      targetLabel: shortLabel(entry.target.label),
      details: cleanDetails(entry.details),
      createdAt: new Date(now).toISOString(),
      expiresAt: Timestamp.fromMillis(now + MEMBER_AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000),
    });
  } catch (error) {
    logger.warn("member_audit_write_failed", {
      tenantId: entry.tenantId,
      action: entry.action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
