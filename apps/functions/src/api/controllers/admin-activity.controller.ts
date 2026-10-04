import { Request, Response } from "express";
import { Timestamp, type Query } from "firebase-admin/firestore";
import { db } from "../../init";
import { isSuperAdminClaim } from "../../lib/request-auth";
import { withActors } from "../../lib/admin-actors";
import { logger } from "../../lib/logger";
import { TENANT_ACTIVITY_COLLECTION } from "../../lib/tenant-activity";
import {
  ACTIVITY_CATEGORIES,
  getActivityDefinition,
  isTenantActivityType,
  type ActivityCategory,
  type TenantActivityType,
} from "../../shared/tenant-activity-catalog";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
/** Teto de documentos lidos numa página quando parte do filtro roda em memória. */
export const ACTIVITY_SCAN_LIMIT = 300;

export interface ActivityFilters {
  tenantId?: string;
  category?: ActivityCategory;
  type?: TenantActivityType;
  uid?: string;
}

export interface ActivityQueryPlan {
  /** Igualdades que vão para o Firestore, cada combinação com índice próprio. */
  equals: Array<[field: "tenantId" | "category" | "uid", value: string]>;
  /** O que sobra é filtrado na página lida. */
  memory: { category?: ActivityCategory; type?: TenantActivityType; uid?: string };
  /** Filtro contraditório (tipo de outra categoria): nada a buscar. */
  empty: boolean;
}

/**
 * Escolhe quais filtros vão para o Firestore. Os índices compostos de
 * `tenant_activity` são `(tenantId, createdAt)`, `(tenantId, category,
 * createdAt)`, `(tenantId, uid, createdAt)` e `(category, createdAt)`; o
 * resto é filtrado em memória sobre uma janela de até 300 documentos.
 */
export function planActivityQuery(filters: ActivityFilters): ActivityQueryPlan {
  const typeCategory = filters.type ? getActivityDefinition(filters.type).category : undefined;
  if (filters.category && typeCategory && filters.category !== typeCategory) {
    return { equals: [], memory: {}, empty: true };
  }
  const category = filters.category ?? typeCategory;
  const memory: ActivityQueryPlan["memory"] = {};
  if (filters.type) memory.type = filters.type;
  const equals: ActivityQueryPlan["equals"] = [];

  if (filters.tenantId) {
    equals.push(["tenantId", filters.tenantId]);
    if (filters.uid) {
      equals.push(["uid", filters.uid]);
      if (category) memory.category = category;
    } else if (category) {
      equals.push(["category", category]);
    }
  } else {
    if (category) equals.push(["category", category]);
    if (filters.uid) memory.uid = filters.uid;
  }
  return { equals, memory, empty: false };
}

export function encodeActivityCursor(createdAt: Timestamp, id: string): string {
  return Buffer.from(JSON.stringify({ v: `${createdAt.seconds}.${createdAt.nanoseconds}`, id }), "utf8").toString(
    "base64",
  );
}

export function decodeActivityCursor(cursor: unknown): { createdAt: Timestamp; id: string } | null {
  if (typeof cursor !== "string" || !cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8")) as { v?: unknown; id?: unknown };
    if (typeof parsed.v !== "string" || typeof parsed.id !== "string" || !parsed.id) return null;
    const match = /^(\d+)\.(\d+)$/.exec(parsed.v);
    if (!match) return null;
    const nanos = Number(match[2]);
    if (nanos > 999_999_999) return null;
    return { createdAt: new Timestamp(Number(match[1]), nanos), id: parsed.id };
  } catch {
    return null;
  }
}

function parseFilters(query: Request["query"]): ActivityFilters {
  const text = (value: unknown, max: number): string | undefined => {
    const v = String(value ?? "").trim();
    return v && v.length <= max ? v : undefined;
  };
  const category = text(query.category, 32);
  const type = text(query.type, 64);
  return {
    tenantId: text(query.tenantId, 128),
    uid: text(query.uid, 128),
    category: (ACTIVITY_CATEGORIES as readonly string[]).includes(category ?? "")
      ? (category as ActivityCategory)
      : undefined,
    type: isTenantActivityType(type) ? type : undefined,
  };
}

function matchesMemory(data: Record<string, unknown>, memory: ActivityQueryPlan["memory"]): boolean {
  if (memory.category && data.category !== memory.category) return false;
  if (memory.type && data.type !== memory.type) return false;
  if (memory.uid && data.uid !== memory.uid) return false;
  return true;
}

function toIso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return null;
}

/**
 * GET /v1/admin/activity?tenantId&category&type&uid&cursor&limit
 *
 * Linha do tempo da atividade das empresas, mais recente primeiro, com quem
 * agiu (nome, e-mail, papel). Só super admin.
 */
export const listTenantActivity = async (req: Request, res: Response) => {
  try {
    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({ message: "Permissão negada." });
    }

    const filters = parseFilters(req.query);
    const requested = Number(req.query.limit);
    const limit =
      Number.isFinite(requested) && requested > 0 ? Math.min(Math.floor(requested), MAX_LIMIT) : DEFAULT_LIMIT;
    const plan = planActivityQuery(filters);
    if (plan.empty) return res.json({ events: [], nextCursor: null });

    const usesMemory = Object.keys(plan.memory).length > 0;
    let query: Query = db.collection(TENANT_ACTIVITY_COLLECTION);
    for (const [field, value] of plan.equals) query = query.where(field, "==", value);
    query = query.orderBy("createdAt", "desc").orderBy("__name__", "desc");
    const cursor = decodeActivityCursor(req.query.cursor);
    if (cursor) query = query.startAfter(cursor.createdAt, cursor.id);

    const snap = await query.limit(usesMemory ? ACTIVITY_SCAN_LIMIT : limit + 1).get();
    const matched = usesMemory
      ? snap.docs.filter((doc) => matchesMemory(doc.data(), plan.memory))
      : snap.docs;
    const page = matched.slice(0, limit);

    let nextCursor: string | null = null;
    const positionOf = (doc: (typeof snap.docs)[number]) =>
      encodeActivityCursor(doc.get("createdAt") as Timestamp, doc.id);
    if (matched.length > limit) {
      nextCursor = positionOf(page[page.length - 1]);
    } else if (usesMemory && snap.docs.length === ACTIVITY_SCAN_LIMIT) {
      // A janela lida acabou antes de completar a página: continua dali.
      nextCursor = positionOf(snap.docs[snap.docs.length - 1]);
    }

    const events = page.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        tenantId: data.tenantId ?? null,
        uid: data.uid ?? null,
        role: data.role ?? null,
        isDemo: data.isDemo === true,
        category: data.category,
        type: data.type,
        route: data.route ?? null,
        meta: data.meta ?? {},
        source: data.source ?? null,
        sessionId: data.sessionId ?? null,
        createdAt: toIso(data.createdAt),
      };
    });

    return res.json({ events: await withActors(events), nextCursor });
  } catch (error) {
    logger.warn("admin_activity_list_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Erro ao buscar a atividade." });
  }
};
