import { Timestamp } from "firebase-admin/firestore";
import { db } from "../init";
import { logger } from "./logger";
import { countsAsTenantAccess } from "./tenant-last-seen";
import {
  getActivityDefinition,
  isTenantActivityType,
  type ActivityCategory,
  type ActivityMetaField,
  type TenantActivityType,
} from "../shared/tenant-activity-catalog";
import { normalizeActivityRoute } from "../shared/activity-route";

/**
 * Atividade das empresas: um documento por evento em `tenant_activity`, lido
 * pelo painel do super admin (linha do tempo da empresa e tela Atividade).
 *
 * Responde "o que esta empresa tentou fazer": telas abertas, ações que
 * importam (clicou em Assinar, tentou criar algo na demonstração), a jornada
 * do cadastro à assinatura e os erros que a pessoa viu. A auditoria
 * (`security_audit_events`) continua sendo do super admin e das recusas do
 * backend; as duas não se misturam.
 *
 * O que entra é fechado pelo catálogo (`shared/tenant-activity-catalog.ts`):
 * tipo fora dele não grava, e `meta` só leva as chaves declaradas para o tipo.
 *
 * **Super admin não conta**, pelo mesmo motivo de `tenant-last-seen.ts`: o
 * "Acessar Painel" gravaria como da empresa o que foi seu.
 *
 * **Toda escrita é aguardada** (ver "Trabalho assíncrono depois da resposta"
 * em `apps/functions/CLAUDE.md`): disparada sem `await`, ela se perde quando a
 * instância congela.
 *
 * Retenção: `expiresAt` é Timestamp para a TTL nativa (90 dias). Habilitar por
 * ambiente com:
 *   gcloud firestore fields ttls update expiresAt \
 *     --collection-group=tenant_activity --enable-ttl --async --project=<projeto>
 */

export const TENANT_ACTIVITY_COLLECTION = "tenant_activity";
export const TENANT_ACTIVITY_RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const ALREADY_EXISTS = 6;

export type ActivityMeta = Record<string, string | number | boolean>;

export interface TenantActivityInput {
  tenantId?: string | null;
  uid?: string | null;
  role?: string | null;
  type: TenantActivityType;
  route?: string | null;
  meta?: Record<string, unknown> | null;
  source: "client" | "server";
  sessionId?: string | null;
  /** Momento do evento; padrão é agora. */
  atMs?: number;
}

export interface TenantActivityDoc {
  tenantId: string;
  uid: string | null;
  role: string | null;
  isDemo: boolean;
  category: ActivityCategory;
  type: TenantActivityType;
  route: string | null;
  meta: ActivityMeta;
  source: "client" | "server";
  sessionId: string | null;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

function sanitizeField(spec: ActivityMetaField, value: unknown): string | number | boolean | undefined {
  switch (spec.kind) {
    case "enum":
      return typeof value === "string" && spec.values.includes(value) ? value : undefined;
    case "bool":
      return typeof value === "boolean" ? value : undefined;
    case "int": {
      if (typeof value !== "number" || !Number.isInteger(value)) return undefined;
      return value >= spec.min && value <= spec.max ? value : undefined;
    }
    case "string": {
      if (typeof value !== "string") return undefined;
      const trimmed = value.trim();
      if (!trimmed || trimmed.length > spec.max) return undefined;
      return spec.pattern.test(trimmed) ? trimmed : undefined;
    }
  }
}

/** Mantém só as chaves que o tipo declara, com valor no formato declarado. */
export function sanitizeActivityMeta(type: TenantActivityType, raw: unknown): ActivityMeta {
  const out: ActivityMeta = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const spec = getActivityDefinition(type).meta;
  for (const [key, fieldSpec] of Object.entries(spec)) {
    let value = (raw as Record<string, unknown>)[key];
    // Caminho de API e alvo de rota passam pela mesma normalização da rota:
    // um id ou token cru no caminho não chega ao documento.
    if ((key === "path" || key === "target") && typeof value === "string") {
      value = normalizeActivityRoute(value) ?? undefined;
    }
    const clean = sanitizeField(fieldSpec, value);
    if (clean !== undefined) out[key] = clean;
  }
  return out;
}

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * Monta o documento, ou devolve null quando ele não deve existir: sem
 * empresa, super admin ou tipo fora do catálogo.
 */
export function buildActivityDoc(input: TenantActivityInput, nowMs: number = Date.now()): TenantActivityDoc | null {
  if (!isTenantActivityType(input.type)) return null;
  if (!countsAsTenantAccess({ tenantId: input.tenantId, role: input.role })) return null;
  const role = str(input.role, 32)?.toLowerCase() ?? null;
  const atMs = typeof input.atMs === "number" && Number.isFinite(input.atMs) ? input.atMs : nowMs;
  return {
    tenantId: String(input.tenantId).trim(),
    uid: str(input.uid, 128),
    role,
    isDemo: role === "free",
    category: getActivityDefinition(input.type).category,
    type: input.type,
    route: normalizeActivityRoute(input.route),
    meta: sanitizeActivityMeta(input.type, input.meta),
    source: input.source,
    sessionId: str(input.sessionId, 64),
    createdAt: Timestamp.fromMillis(atMs),
    expiresAt: Timestamp.fromMillis(atMs + TENANT_ACTIVITY_RETENTION_DAYS * DAY_MS),
  };
}

/**
 * Grava um evento. Nunca lança. Com `docId`, grava com `create`: o evento que
 * pode chegar repetido (gatilho do Firestore, webhook do Stripe) fica um só.
 */
export async function recordTenantActivity(input: TenantActivityInput & { docId?: string }): Promise<void> {
  const doc = buildActivityDoc(input);
  if (!doc) return;
  try {
    const collection = db.collection(TENANT_ACTIVITY_COLLECTION);
    if (input.docId) {
      await collection.doc(input.docId).create(doc);
    } else {
      await collection.add(doc);
    }
  } catch (err) {
    if ((err as { code?: unknown })?.code === ALREADY_EXISTS) return;
    logger.warn("tenant_activity_write_failed", {
      tenantId: doc.tenantId,
      type: doc.type,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Grava um lote vindo do navegador numa escrita só. Nunca lança. */
export async function recordTenantActivityBatch(docs: TenantActivityDoc[]): Promise<number> {
  if (docs.length === 0) return 0;
  try {
    const collection = db.collection(TENANT_ACTIVITY_COLLECTION);
    const batch = db.batch();
    for (const doc of docs) batch.set(collection.doc(), doc);
    await batch.commit();
    return docs.length;
  } catch (err) {
    logger.warn("tenant_activity_batch_failed", {
      tenantId: docs[0]?.tenantId,
      count: docs.length,
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}
