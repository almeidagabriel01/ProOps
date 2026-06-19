import { Request, Response } from "express";
import { db } from "../../init";
import { isSuperAdminClaim } from "../../lib/request-auth";
import { writeSecurityAuditEvent } from "../../lib/security-observability";
import { ERROR_ISSUES_COLLECTION } from "../../lib/observability/error-ingest.service";

const VALID_STATUSES = new Set(["unresolved", "resolved", "ignored"]);
const FINGERPRINT_RE = /^[a-f0-9]{40}$/;

export function mapTriageErrorStatus(message: string): number {
  if (/FORBIDDEN_/.test(message)) return 403;
  if (/não encontrada|not found/i.test(message)) return 404;
  if (/inválid|invalid/i.test(message)) return 400;
  return 500;
}

/**
 * PUT /v1/admin/observability/issues/:fingerprint/status
 * Body: { status: "unresolved" | "resolved" | "ignored" }
 */
export async function triageIssue(req: Request, res: Response): Promise<Response> {
  try {
    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({ message: "Acesso negado." });
    }
    const fingerprint = String(req.params.fingerprint || "");
    if (!FINGERPRINT_RE.test(fingerprint)) {
      return res.status(400).json({ message: "fingerprint inválido" });
    }
    const status = String((req.body || {}).status || "");
    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({ message: "status inválido" });
    }

    const ref = db.collection(ERROR_ISSUES_COLLECTION).doc(fingerprint);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ message: "Issue não encontrada" });
    }

    await ref.update({
      status,
      resolvedAt: status === "resolved" ? new Date().toISOString() : null,
    });

    const uid = (req.user as { uid?: string })?.uid || null;
    void writeSecurityAuditEvent({
      eventType: "observability_issue_triaged",
      uid: uid || undefined,
      reason: status,
      source: "observability_admin",
      route: req.path,
      eventId: fingerprint,
    });

    return res.status(200).json({ success: true, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected";
    return res.status(mapTriageErrorStatus(message)).json({ message: "Erro ao atualizar issue." });
  }
}
