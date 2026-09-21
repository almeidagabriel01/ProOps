import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { auth, db } from "../../init";
import { logger } from "../../lib/logger";
import { normalizeBrazilPhoneNumber } from "../../lib/contact-validation";
import {
  TENANT_PURGE_BY_DOC_ID,
  TENANT_PURGE_BY_FIELD,
  fiscalRetentionUntil,
  isPreservedStoragePath,
} from "../../shared/tenant-collections";

/**
 * Exclusao definitiva de uma empresa, como job resumivel.
 *
 * Uma empresa grande nao cabe nos 70s de uma request, e a exclusao antiga
 * rodava dentro dela: estourava o tempo no meio e deixava metade dos dados. Aqui
 * o painel so cria `tenant_purge_jobs/{tenantId}` e o trigger
 * `onTenantPurgeJob` processa etapa por etapa. Cada etapa apaga ate esvaziar a
 * propria consulta, entao e naturalmente retomavel: se o prazo acabar, o job
 * volta para `pending` com o indice da etapa e o trigger dispara de novo.
 * Mesmo desenho de `wallet_cascade_jobs`.
 */

export const TENANT_PURGE_JOBS_COLLECTION = "tenant_purge_jobs";

export type PurgeStage =
  | { kind: "users" }
  | { kind: "field"; collection: string }
  | { kind: "doc"; collection: string }
  | { kind: "tenantSubcollections" }
  | { kind: "storage" }
  | { kind: "finalize" };

export interface TenantPurgeJob {
  tenantId: string;
  status: "pending" | "running" | "completed" | "failed";
  stageIndex: number;
  requestedBy: string;
  createdAt: string;
  updatedAt?: string;
  finishedAt?: string;
  lastError?: string;
  continuationKick?: number;
}

export function buildPurgeStages(): PurgeStage[] {
  return [
    // Usuarios primeiro: sem login, ninguem grava nada novo enquanto o resto e
    // apagado.
    { kind: "users" },
    ...TENANT_PURGE_BY_FIELD.map((collection) => ({ kind: "field" as const, collection })),
    ...TENANT_PURGE_BY_DOC_ID.map((collection) => ({ kind: "doc" as const, collection })),
    { kind: "tenantSubcollections" },
    { kind: "storage" },
    { kind: "finalize" },
  ];
}

export type StageOutcome = "done" | "partial";

export interface TenantPurgeDeps {
  loadJob(tenantId: string): Promise<TenantPurgeJob | null>;
  saveJob(tenantId: string, patch: Record<string, unknown>): Promise<void>;
  runStage(tenantId: string, stage: PurgeStage, deadline: number): Promise<StageOutcome>;
  now(): number;
}

export function deadlineFromTimeoutSeconds(timeoutSeconds: number, safetyMs = 60_000): number {
  return Date.now() + timeoutSeconds * 1000 - safetyMs;
}

export async function processTenantPurgeJob(
  tenantId: string,
  deadline: number,
  deps: TenantPurgeDeps = defaultDeps,
): Promise<"completed" | "continued" | "skipped"> {
  const job = await deps.loadJob(tenantId);
  if (!job || job.status !== "pending") return "skipped";

  await deps.saveJob(tenantId, { status: "running", updatedAt: new Date(deps.now()).toISOString() });

  const stages = buildPurgeStages();
  let index = Math.max(0, job.stageIndex || 0);
  try {
    while (index < stages.length) {
      if (deps.now() >= deadline) {
        await deps.saveJob(tenantId, continuationPatch(index, deps));
        return "continued";
      }
      const outcome = await deps.runStage(tenantId, stages[index], deadline);
      if (outcome === "partial") {
        await deps.saveJob(tenantId, continuationPatch(index, deps));
        return "continued";
      }
      index += 1;
      await deps.saveJob(tenantId, {
        stageIndex: index,
        updatedAt: new Date(deps.now()).toISOString(),
      });
    }
  } catch (err) {
    await deps.saveJob(tenantId, {
      status: "failed",
      stageIndex: index,
      lastError: err instanceof Error ? err.message : String(err),
      updatedAt: new Date(deps.now()).toISOString(),
    });
    throw err;
  }

  await deps.saveJob(tenantId, {
    status: "completed",
    stageIndex: index,
    finishedAt: new Date(deps.now()).toISOString(),
  });
  return "completed";
}

function continuationPatch(index: number, deps: TenantPurgeDeps): Record<string, unknown> {
  return {
    status: "pending",
    stageIndex: index,
    continuationKick: FieldValue.increment(1),
    updatedAt: new Date(deps.now()).toISOString(),
  };
}

// ─── Implementacao real ─────────────────────────────────────────────────────

const BATCH_SIZE = 400;
const USERS_BATCH = 50;

async function deleteByQuery(
  query: FirebaseFirestore.Query,
  deadline: number,
): Promise<StageOutcome> {
  for (;;) {
    if (Date.now() >= deadline) return "partial";
    const snap = await query.limit(BATCH_SIZE).get();
    if (snap.empty) return "done";
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

async function deleteTenantUsers(tenantId: string, deadline: number): Promise<StageOutcome> {
  for (;;) {
    if (Date.now() >= deadline) return "partial";
    const [byTenant, byCompany] = await Promise.all([
      db.collection("users").where("tenantId", "==", tenantId).limit(USERS_BATCH).get(),
      db.collection("users").where("companyId", "==", tenantId).limit(USERS_BATCH).get(),
    ]);
    const users = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    [...byTenant.docs, ...byCompany.docs].forEach((d) => users.set(d.id, d));
    if (users.size === 0) return "done";

    for (const userSnap of users.values()) {
      const uid = userSnap.id;
      const userRef = db.collection("users").doc(uid);
      await db.recursiveDelete(userRef.collection("permissions"));

      const phone = normalizeBrazilPhoneNumber(userSnap.get("phoneNumber"));
      if (phone) {
        const phoneRef = db.collection("phoneNumberIndex").doc(phone);
        const phoneSnap = await phoneRef.get();
        if (phoneSnap.exists && phoneSnap.get("userId") === uid) await phoneRef.delete();
      }

      try {
        await auth.deleteUser(uid);
      } catch (err) {
        if ((err as { code?: string })?.code !== "auth/user-not-found") throw err;
      }
      await userRef.delete();
    }
  }
}

async function deleteTenantStorage(tenantId: string, deadline: number): Promise<StageOutcome> {
  const bucket = getStorage().bucket();
  let pageToken: string | undefined;
  for (;;) {
    if (Date.now() >= deadline) return "partial";
    const [files, nextQuery] = await bucket.getFiles({
      prefix: `tenants/${tenantId}/`,
      autoPaginate: false,
      maxResults: 500,
      pageToken,
    });
    for (const file of files) {
      if (isPreservedStoragePath(tenantId, file.name)) continue;
      await file.delete({ ignoreNotFound: true });
    }
    pageToken = (nextQuery as { pageToken?: string } | undefined)?.pageToken;
    if (!pageToken) return "done";
  }
}

async function runStage(tenantId: string, stage: PurgeStage, deadline: number): Promise<StageOutcome> {
  switch (stage.kind) {
    case "users":
      return deleteTenantUsers(tenantId, deadline);
    case "field":
      return deleteByQuery(
        db.collection(stage.collection).where("tenantId", "==", tenantId),
        deadline,
      );
    case "doc":
      await db.recursiveDelete(db.collection(stage.collection).doc(tenantId));
      return "done";
    case "tenantSubcollections": {
      const subcollections = await db.collection("tenants").doc(tenantId).listCollections();
      for (const sub of subcollections) await db.recursiveDelete(sub);
      return "done";
    }
    case "storage":
      return deleteTenantStorage(tenantId, deadline);
    case "finalize": {
      const nowIso = new Date().toISOString();
      await db.collection("tenants").doc(tenantId).set(
        {
          accountStatus: "purged",
          purgedAt: nowIso,
          fiscalRetainUntil: fiscalRetentionUntil(new Date()),
          updatedAt: nowIso,
        },
        { merge: true },
      );
      logger.info("tenant_purge_completed", { tenantId });
      return "done";
    }
  }
}

const defaultDeps: TenantPurgeDeps = {
  async loadJob(tenantId) {
    const snap = await db.collection(TENANT_PURGE_JOBS_COLLECTION).doc(tenantId).get();
    return snap.exists ? (snap.data() as TenantPurgeJob) : null;
  },
  async saveJob(tenantId, patch) {
    await db.collection(TENANT_PURGE_JOBS_COLLECTION).doc(tenantId).set(patch, { merge: true });
  },
  runStage,
  now: () => Date.now(),
};
