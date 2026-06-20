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

const ID_CAP = 100;

/**
 * POST /v1/admin/observability/resolve-identities
 * Body: { uids: string[]; tenantIds: string[] }
 * Resolves uid -> {name,email} and tenantId -> {name}. Superadmin only.
 */
export async function resolveIdentities(req: Request, res: Response): Promise<Response> {
  try {
    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({ message: "Acesso negado." });
    }
    const body = (req.body || {}) as { uids?: unknown; tenantIds?: unknown };
    if (!Array.isArray(body.uids) || !Array.isArray(body.tenantIds)) {
      return res.status(400).json({ message: "uids e tenantIds inválidos" });
    }
    const uids = [...new Set(body.uids.filter((x): x is string => typeof x === "string"))];
    const tenantIds = [...new Set(body.tenantIds.filter((x): x is string => typeof x === "string"))];
    if (uids.length > ID_CAP || tenantIds.length > ID_CAP) {
      return res.status(400).json({ message: "limite de ids excedido" });
    }

    const users: Record<string, { name: string; email: string }> = {};
    const tenants: Record<string, { name: string }> = {};

    await Promise.all([
      ...uids.map(async (uid) => {
        const snap = await db.collection("users").doc(uid).get();
        if (snap.exists) {
          const d = snap.data() as { name?: string; email?: string };
          users[uid] = { name: d.name || "—", email: d.email || "—" };
        }
      }),
      ...tenantIds.map(async (id) => {
        const snap = await db.collection("tenants").doc(id).get();
        if (snap.exists) {
          const d = snap.data() as { name?: string };
          tenants[id] = { name: d.name || "—" };
        }
      }),
    ]);

    return res.status(200).json({ users, tenants });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected";
    return res.status(mapTriageErrorStatus(message)).json({ message: "Erro ao resolver identidades." });
  }
}

interface SearchFilterCriteria {
  status: string;
  severity: string;
  source: string;
  errorType: string;
  q: string;
  from: string | null;
  to: string | null;
}

interface IssueRecord {
  title?: string;
  route?: string | null;
  status?: string;
  severity?: string;
  source?: string;
  errorType?: string;
  lastSeen?: string;
}

export function matchesFilters(issue: IssueRecord, f: SearchFilterCriteria): boolean {
  if (f.status !== "all" && issue.status !== f.status) return false;
  if (f.severity !== "all" && issue.severity !== f.severity) return false;
  if (f.source !== "all" && issue.source !== f.source) return false;
  if (f.errorType !== "all" && issue.errorType !== f.errorType) return false;
  if (f.from && (issue.lastSeen || "") < f.from) return false;
  if (f.to && (issue.lastSeen || "") > f.to) return false;
  if (f.q) {
    const needle = f.q.toLowerCase();
    const hay = `${issue.title || ""} ${issue.route || ""}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

export function encodeCursor(c: { v: string; id: string }): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64");
}

export function decodeCursor(c: string | null): { v: string; id: string } | null {
  if (!c) return null;
  try {
    const parsed = JSON.parse(Buffer.from(c, "base64").toString("utf8"));
    if (parsed && typeof parsed.v === "string" && typeof parsed.id === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

const SORT_FIELD: Record<string, string> = { recent: "lastSeen", frequent: "count", newest: "firstSeen" };
const SCAN_LIMIT = 300;

/**
 * GET /v1/admin/observability/issues
 * Query: status, severity, source, errorType, q, from, to, sort, limit, cursor
 * Orders by one auto-indexed field, then filters in-memory. Superadmin only.
 */
export async function searchIssues(req: Request, res: Response): Promise<Response> {
  try {
    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({ message: "Acesso negado." });
    }
    const qp = req.query as Record<string, string | undefined>;
    const sort = qp.sort || "recent";
    const orderField = SORT_FIELD[sort];
    if (!orderField) {
      return res.status(400).json({ message: "sort inválido" });
    }
    const limit = Math.min(Math.max(parseInt(qp.limit || "50", 10) || 50, 1), 200);
    const cursor = decodeCursor(qp.cursor || null);

    const criteria: SearchFilterCriteria = {
      status: qp.status || "all",
      severity: qp.severity || "all",
      source: qp.source || "all",
      errorType: qp.errorType || "all",
      q: qp.q || "",
      from: qp.from || null,
      to: qp.to || null,
    };

    let query = db
      .collection(ERROR_ISSUES_COLLECTION)
      .orderBy(orderField, "desc")
      .orderBy("__name__", "desc")
      .limit(SCAN_LIMIT);
    if (cursor) {
      query = query.startAfter(cursor.v, cursor.id);
    }

    const snap = await query.get();
    const matched: Array<Record<string, unknown>> = [];
    let lastScanned: { v: string; id: string } | null = null;

    for (const doc of snap.docs) {
      const data = doc.data() as IssueRecord & Record<string, unknown>;
      lastScanned = { v: String((data as Record<string, unknown>)[orderField] ?? ""), id: doc.id };
      if (matchesFilters(data, criteria)) {
        matched.push({ ...data, fingerprint: doc.id });
        if (matched.length >= limit) break;
      }
    }

    // More pages may exist if we consumed the full scan window.
    const nextCursor = snap.docs.length === SCAN_LIMIT && lastScanned ? encodeCursor(lastScanned) : null;
    return res.status(200).json({ issues: matched, nextCursor });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected";
    return res.status(mapTriageErrorStatus(message)).json({ message: "Erro ao buscar issues." });
  }
}
