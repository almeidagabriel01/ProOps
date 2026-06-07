import { logger } from "./logger";

/**
 * Reads security audit events for the super-admin panel, filtering by tenant at
 * the DATABASE level when a tenantId is provided (instead of loading a global
 * window and filtering in memory). uid/eventType remain in-memory filters since
 * the result is already tenant-scoped.
 *
 * Requires a composite index (tenantId ASC, createdAt DESC). That index builds
 * asynchronously after a deploy, so the tenant query falls back to the global
 * read + in-memory filter while it is still building — no downtime, and this is
 * a super-admin-only endpoint.
 */

const WINDOW_LIMIT = 500;

interface AuditSnap {
  docs: Array<{ id: string; data(): Record<string, unknown> }>;
}

// Minimal Firestore query surface we depend on (CollectionReference/Query
// satisfy this structurally; tests pass a lightweight mock).
export interface AuditQuerySource {
  where(field: string, op: "==", value: string): AuditQuerySource;
  orderBy(field: "createdAt", direction: "desc"): AuditQuerySource;
  limit(n: number): AuditQuerySource;
  get(): Promise<AuditSnap>;
}

export interface AuditEventsQueryInput {
  tenantId?: string;
  uid?: string;
  eventType?: string;
  limit: number;
}

export async function fetchAuditEvents(
  source: AuditQuerySource,
  input: AuditEventsQueryInput,
): Promise<Array<Record<string, unknown>>> {
  const { tenantId, uid, eventType, limit } = input;

  const globalWindow = (): Promise<AuditSnap> =>
    source.orderBy("createdAt", "desc").limit(WINDOW_LIMIT).get();

  let snap: AuditSnap;
  if (tenantId) {
    try {
      snap = await source
        .where("tenantId", "==", tenantId)
        .orderBy("createdAt", "desc")
        .limit(WINDOW_LIMIT)
        .get();
    } catch (error) {
      // Composite index likely still building right after a deploy — fall back
      // to the global window + in-memory filter transitionally.
      logger.warn(
        "audit-events: indexed tenant query failed, falling back to in-memory filter",
        { error: error instanceof Error ? error.message : String(error) },
      );
      snap = await globalWindow();
    }
  } else {
    snap = await globalWindow();
  }

  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Record<string, unknown>)
    .filter((e) => !tenantId || e.tenantId === tenantId)
    .filter((e) => !uid || e.uid === uid)
    .filter((e) => !eventType || e.eventType === eventType)
    .slice(0, limit);
}
