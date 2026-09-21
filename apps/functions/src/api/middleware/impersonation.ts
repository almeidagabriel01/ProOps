import type { NextFunction, Request, Response } from "express";
import { db } from "../../init";
import { assertTenantExists } from "../../lib/tenant-resolution";
import { writeSecurityAuditEvent } from "../../lib/security-observability";
import { logger } from "../../lib/logger";
import type { ImpersonationContext } from "../../lib/auth-context";

/**
 * "Acessar Painel" do superadmin: faz a request valer para a empresa que ele
 * esta vendo.
 *
 * O front manda `x-tenant-id` com a empresa aberta. Ate aqui nenhum lugar
 * central lia esse cabecalho: cada controller decidia sozinho (calendario e
 * Drive so quando o superadmin nao tinha tenant, criacao por
 * `targetTenantId` no body, o resto nada). Resultado: aux, planilhas, status
 * do CRM, numeracao, fiscal, Asaas e a Lia agiam no tenant DO SUPERADMIN.
 *
 * Aqui, para superadmin com empresa alvo diferente da propria:
 * - `req.user.tenantId` passa a ser o alvo e `req.user.masterId` o dono dele;
 * - `req.user.impersonation` registra de onde veio, para quem precisar saber;
 * - escrita so passa com `x-impersonation-write: 1` (o botao "Habilitar
 *   edicao" do front). Sem ele: 403 `IMPERSONATION_READ_ONLY`. O modo leitura
 *   protege contra engano, nao contra o proprio superadmin; por isso basta um
 *   cabecalho, sem estado no servidor.
 * - toda escrita liberada e auditada aqui, num ponto so.
 *
 * Para qualquer outro usuario o cabecalho e descartado.
 */

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Rotas que continuam gravando mesmo em modo leitura, porque escrevem no
 * PROPRIO superadmin ou tem guarda propria:
 * - `/v1/admin`: o painel em si (inclusive encerrar a impersonacao);
 * - `/v1/auth`, `/v1/profile`: conta do superadmin;
 * - `/v1/notifications`: marcar como lida, claim do toast diario;
 * - `/v1/ai`: a conversa e um POST, mas as ferramentas que escrevem sao
 *   barradas no executor da Lia pelo mesmo modo leitura.
 */
const READ_ONLY_EXEMPT_PREFIXES = [
  "/v1/admin",
  "/v1/auth",
  "/v1/profile",
  "/v1/notifications",
  "/v1/ai",
];

const OWNER_CACHE_TTL_MS = 60_000;
const ownerCache = new Map<string, { ownerUid: string | null; expiresAt: number }>();

function normalize(value: unknown): string {
  return String(Array.isArray(value) ? value[0] : value ?? "").trim();
}

function requestPath(req: Request): string {
  return String(req.originalUrl || req.url || req.path || "").split("?")[0];
}

export function isReadOnlyExemptPath(path: string): boolean {
  return READ_ONLY_EXEMPT_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/**
 * Dono da empresa: o usuario mais antigo do tenant sem `masterId`. E o doc que
 * os controllers legados usam como `masterData` (limites e contadores).
 */
export async function resolveTenantOwnerUid(tenantId: string): Promise<string | null> {
  const cached = ownerCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached.ownerUid;

  const snap = await db
    .collection("users")
    .where("tenantId", "==", tenantId)
    .limit(20)
    .get();
  const owners = snap.docs
    .filter((doc) => !String(doc.get("masterId") || "").trim())
    .filter((doc) => String(doc.get("role") || "").toUpperCase() !== "SUPERADMIN")
    .sort((a, b) =>
      String(a.get("createdAt") || "").localeCompare(String(b.get("createdAt") || "")),
    );
  const ownerUid = owners[0]?.id ?? null;

  ownerCache.set(tenantId, { ownerUid, expiresAt: Date.now() + OWNER_CACHE_TTL_MS });
  return ownerUid;
}

export function clearImpersonationOwnerCacheForTest(): void {
  ownerCache.clear();
}

export async function resolveImpersonation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  const targetTenantId = normalize(req.headers["x-tenant-id"]);

  if (!user || !targetTenantId) {
    next();
    return;
  }

  if (!user.isSuperAdmin) {
    delete req.headers["x-tenant-id"];
    delete req.headers["x-impersonation-write"];
    next();
    return;
  }

  const originalTenantId = normalize(user.tenantId);
  if (targetTenantId === originalTenantId) {
    next();
    return;
  }

  try {
    await assertTenantExists(targetTenantId);
  } catch {
    res.status(400).json({
      code: "IMPERSONATION_TENANT_NOT_FOUND",
      message: "A empresa que você está visualizando não existe mais.",
    });
    return;
  }

  let ownerUid: string | null = null;
  try {
    ownerUid = await resolveTenantOwnerUid(targetTenantId);
  } catch (err) {
    logger.warn("impersonation: owner lookup failed", {
      tenantId: targetTenantId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const writeEnabled = normalize(req.headers["x-impersonation-write"]) === "1";
  const impersonation: ImpersonationContext = {
    originalTenantId,
    targetTenantId,
    ownerUid,
    writeEnabled,
  };
  user.impersonation = impersonation;
  user.tenantId = targetTenantId;
  user.masterId = ownerUid ?? undefined;

  const method = String(req.method || "").toUpperCase();
  const path = requestPath(req);
  if (MUTATING_METHODS.has(method) && !isReadOnlyExemptPath(path)) {
    if (!writeEnabled) {
      res.status(403).json({
        code: "IMPERSONATION_READ_ONLY",
        message:
          "Você está vendo esta empresa em modo somente leitura. Habilite a edição na faixa do topo para alterar dados.",
      });
      return;
    }
    await writeSecurityAuditEvent({
      eventType: "super_admin_tenant_write",
      uid: user.uid,
      tenantId: targetTenantId,
      route: path,
      requestId: req.requestId,
      reason: method,
      source: "super_admin_impersonation",
    });
  }

  next();
}
