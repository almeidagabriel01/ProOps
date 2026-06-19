import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../../init";
import type { IngestErrorInput, ErrorIssue } from "../../shared/error-observability.types";
import { normalizeErrorMessage, firstStackFrame, computeFingerprint } from "./fingerprint";
import { mapSeverity } from "./severity";
import { IngestRateGuard } from "./ingest-rate-guard";

export const ERROR_ISSUES_COLLECTION = "error_issues";
export const ERROR_METRICS_COLLECTION = "error_metrics";
export const OCCURRENCE_SAMPLE_CAP = 50;
export const AFFECTED_CAP = 1000;
const TENANT_DISPLAY_CAP = 20;
const STACK_MAX = 8000;
const OCCURRENCE_RETENTION_DAYS = 30;

const guard = new IngestRateGuard(
  Number(process.env.ERROR_INGEST_MAX_PER_WINDOW || 30),
  Number(process.env.ERROR_INGEST_WINDOW_MS || 10_000),
);

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function hashId(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 16);
}

function windowId(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}${p(now.getUTCHours())}`
  );
}

/**
 * Idempotent, atomic error ingestion. Never throws — failures degrade to a
 * console.warn so logging an error can never break the path that produced it.
 */
export async function ingestError(
  input: IngestErrorInput,
  opts: { handled?: boolean } = {},
): Promise<{ fingerprint: string; persisted: boolean }> {
  const handled = opts.handled !== false;
  const normalizedMessage = normalizeErrorMessage(input.message);
  const errorType = (input.errorType || "Error").slice(0, 200);
  const stackTopFrame = firstStackFrame(input.stack);
  const fingerprint = computeFingerprint({
    errorType,
    normalizedMessage,
    route: input.route,
    stackTopFrame,
  });

  if (!guard.allow(fingerprint)) {
    return { fingerprint, persisted: false };
  }

  const severity = mapSeverity({ status: input.status, source: input.source, handled });
  const nowIso = new Date().toISOString();
  const issueRef = db.collection(ERROR_ISSUES_COLLECTION).doc(fingerprint);

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(issueRef);
      if (!snap.exists) {
        const issue: ErrorIssue = {
          fingerprint,
          errorType,
          title: truncate(normalizedMessage || errorType, 300),
          normalizedMessage,
          source: input.source,
          route: input.route,
          method: input.method,
          severity,
          status: "unresolved",
          count: 1,
          firstSeen: nowIso,
          lastSeen: nowIso,
          resolvedAt: null,
          affectedUsers: input.uid ? 1 : 0,
          affectedTenants: input.tenantId ? 1 : 0,
          tenantIds: input.tenantId ? [input.tenantId] : [],
          sampleStack: truncate(input.stack || "", STACK_MAX),
          why: input.why,
          fix: input.fix,
          link: input.link,
        };
        tx.set(issueRef, issue);
        return;
      }
      const data = snap.data() as ErrorIssue;
      const update: Record<string, unknown> = {
        count: FieldValue.increment(1),
        lastSeen: nowIso,
        severity, // keep latest severity classification
      };
      if (data.status === "resolved") {
        update.status = "unresolved";
        update.resolvedAt = null;
      }
      if (input.tenantId && !(data.tenantIds || []).includes(input.tenantId)) {
        if ((data.tenantIds || []).length < TENANT_DISPLAY_CAP) {
          update.tenantIds = FieldValue.arrayUnion(input.tenantId);
        }
      }
      tx.update(issueRef, update);
    });
  } catch (error) {
    console.warn("[OBSERVABILITY] issue upsert failed", {
      fingerprint,
      error: error instanceof Error ? error.message : String(error),
    });
    return { fingerprint, persisted: false };
  }

  // Best-effort side writes — each isolated, never throws into the caller.
  await writeOccurrence(fingerprint, input, nowIso).catch(() => undefined);
  await updateAffectedAgg(fingerprint, input).catch(() => undefined);
  await incrementMetric(severity, input.source).catch(() => undefined);

  return { fingerprint, persisted: true };
}

async function writeOccurrence(
  fingerprint: string,
  input: IngestErrorInput,
  nowIso: string,
): Promise<void> {
  const col = db.collection(ERROR_ISSUES_COLLECTION).doc(fingerprint).collection("occurrences");
  const expiresAt = new Date(
    Date.now() + OCCURRENCE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  await col.add({
    uid: input.uid,
    tenantId: input.tenantId,
    route: input.route,
    method: input.method,
    status: input.status,
    stack: truncate(input.stack || "", STACK_MAX),
    userAgent: input.userAgent,
    createdAt: nowIso,
    expiresAt,
  });

  // Trim the sample to the cap: delete oldest beyond OCCURRENCE_SAMPLE_CAP.
  const overflow = await col.orderBy("createdAt", "desc").offset(OCCURRENCE_SAMPLE_CAP).limit(20).get();
  if (!overflow.empty) {
    const batch = db.batch();
    overflow.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

async function updateAffectedAgg(fingerprint: string, input: IngestErrorInput): Promise<void> {
  if (!input.uid && !input.tenantId) return;
  const aggRef = db.collection(ERROR_ISSUES_COLLECTION).doc(fingerprint).collection("_agg").doc("affected");
  const issueRef = db.collection(ERROR_ISSUES_COLLECTION).doc(fingerprint);

  await db.runTransaction(async (tx) => {
    const aggSnap = await tx.get(aggRef);
    const agg = (aggSnap.data() as { users?: string[]; tenants?: string[] } | undefined) || {};
    const users = new Set(agg.users || []);
    const tenants = new Set(agg.tenants || []);
    let changed = false;
    if (input.uid && users.size < AFFECTED_CAP && !users.has(hashId(input.uid))) {
      users.add(hashId(input.uid));
      changed = true;
    }
    if (input.tenantId && tenants.size < AFFECTED_CAP && !tenants.has(hashId(input.tenantId))) {
      tenants.add(hashId(input.tenantId));
      changed = true;
    }
    if (!changed) return;
    tx.set(aggRef, { users: Array.from(users), tenants: Array.from(tenants) }, { merge: true });
    tx.update(issueRef, { affectedUsers: users.size, affectedTenants: tenants.size });
  });
}

async function incrementMetric(severity: string, source: string): Promise<void> {
  const now = new Date();
  const id = windowId(now);
  await db.collection(ERROR_METRICS_COLLECTION).doc(id).set(
    {
      windowId: id,
      windowStart: new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(),
      )).toISOString(),
      updatedAt: now.toISOString(),
      counters: { [`${severity}_${source}`]: FieldValue.increment(1) },
    },
    { merge: true },
  );
}
