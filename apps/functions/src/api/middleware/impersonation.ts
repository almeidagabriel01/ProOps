import type { NextFunction, Request, Response } from "express";
import { db } from "../../init";
import { assertTenantExists } from "../../lib/tenant-resolution";
import { writeSecurityAuditEvent } from "../../lib/security-observability";
import { logger } from "../../lib/logger";
import { compareByCreatedAt, isTenantOwnerCandidate } from "../../lib/tenant-owner";
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
 * "Ver como membro": com `x-view-as-member` junto, a request passa a valer como
 * aquele membro da empresa vista (uid, papel, master e doc dele). E assim que
 * permissao por pagina, tarefas, OS, metas e "Minhas comissoes" respondem o que
 * o membro ve, sem nenhum controller saber disso. Nesse modo nada grava: o que
 * fosse gravado ficaria em nome do membro.
 *
 * Para qualquer outro usuario os cabecalhos sao descartados.
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

/**
 * Caminhos que continuam agindo como o PROPRIO superadmin na visao de membro:
 * o painel (encerrar, trocar de membro) e a conta dele. Nos demais a identidade
 * vira a do membro, e toda escrita e recusada.
 */
const MEMBER_VIEW_ACTOR_PREFIXES = ["/v1/admin", "/v1/auth", "/v1/profile"];

const OWNER_CACHE_TTL_MS = 60_000;
const MEMBER_CACHE_TTL_MS = 60_000;
const ownerCache = new Map<string, { ownerUid: string | null; expiresAt: number }>();

function normalize(value: unknown): string {
  return String(Array.isArray(value) ? value[0] : value ?? "").trim();
}

function requestPath(req: Request): string {
  return String(req.originalUrl || req.url || req.path || "").split("?")[0];
}

function matchesPrefix(path: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function isReadOnlyExemptPath(path: string): boolean {
  return matchesPrefix(path, READ_ONLY_EXEMPT_PREFIXES);
}

export function isMemberViewActorPath(path: string): boolean {
  return matchesPrefix(path, MEMBER_VIEW_ACTOR_PREFIXES);
}

const memberCache = new Map<
  string,
  { doc: Record<string, unknown> | null; expiresAt: number }
>();

async function loadMemberDoc(uid: string): Promise<Record<string, unknown> | null> {
  const cached = memberCache.get(uid);
  if (cached && cached.expiresAt > Date.now()) return cached.doc;
  const snap = await db.collection("users").doc(uid).get();
  const doc = snap.exists ? ((snap.data() ?? {}) as Record<string, unknown>) : null;
  memberCache.set(uid, { doc, expiresAt: Date.now() + MEMBER_CACHE_TTL_MS });
  return doc;
}

/**
 * O membro so vale se for da empresa vista e nao for superadmin: o cabecalho
 * vem do navegador, e sem isso o superadmin "veria como" alguem de outra
 * empresa com o tenant de uma terceira.
 */
export function isViewableMember(
  doc: Record<string, unknown> | null,
  targetTenantId: string,
): doc is Record<string, unknown> {
  if (!doc) return false;
  const tenantId = String(doc.tenantId || doc.companyId || "").trim();
  if (tenantId !== targetTenantId) return false;
  return String(doc.role || "").trim().toUpperCase() !== "SUPERADMIN";
}

/**
 * Dono da empresa: o usuario mais antigo do tenant sem `masterId` (ou com o
 * `masterId` apontando para si mesmo, como os seeds e contas antigas gravam).
 * E o doc que os controllers legados usam como `masterData` (limites e
 * contadores).
 */
export async function resolveTenantOwnerUid(tenantId: string): Promise<string | null> {
  const cached = ownerCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached.ownerUid;

  const snap = await db
    .collection("users")
    .where("tenantId", "==", tenantId)
    // O filtro do dono e em memoria: com um teto baixo, uma empresa com mais
    // pessoas que ele podia deixar o dono de fora, e o superadmin passava a
    // agir com o proprio doc como `masterData`. 200 e o mesmo teto da lista
    // de membros do painel; o resultado fica 60s em cache.
    .limit(200)
    .get();
  const owners = snap.docs.filter(isTenantOwnerCandidate).sort(compareByCreatedAt);
  const ownerUid = owners[0]?.id ?? null;

  ownerCache.set(tenantId, { ownerUid, expiresAt: Date.now() + OWNER_CACHE_TTL_MS });
  return ownerUid;
}

export function clearImpersonationOwnerCacheForTest(): void {
  ownerCache.clear();
  memberCache.clear();
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
    delete req.headers["x-view-as-member"];
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

  const method = String(req.method || "").toUpperCase();
  const path = requestPath(req);
  const memberUid = normalize(req.headers["x-view-as-member"]);

  if (memberUid) {
    let memberDoc: Record<string, unknown> | null = null;
    try {
      memberDoc = await loadMemberDoc(memberUid);
    } catch (err) {
      logger.warn("impersonation: member lookup failed", {
        tenantId: targetTenantId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    if (!isViewableMember(memberDoc, targetTenantId)) {
      res.status(400).json({
        code: "MEMBER_VIEW_NOT_FOUND",
        message: "O membro que você está visualizando não faz mais parte desta empresa.",
      });
      return;
    }

    const actorPath = isMemberViewActorPath(path);
    if (MUTATING_METHODS.has(method) && !actorPath) {
      res.status(403).json({
        code: "MEMBER_VIEW_READ_ONLY",
        message:
          "Você está vendo o painel de um membro em modo somente leitura. Volte para a visão da empresa para alterar dados.",
      });
      return;
    }

    user.impersonation = {
      originalTenantId,
      targetTenantId,
      ownerUid,
      writeEnabled: false,
      memberUid,
      actorUid: user.uid,
    };
    user.tenantId = targetTenantId;

    if (actorPath) {
      user.masterId = ownerUid ?? undefined;
      next();
      return;
    }

    const memberMasterId = String(
      memberDoc.masterId || memberDoc.masterID || memberDoc.ownerId || "",
    ).trim();
    user.uid = memberUid;
    user.role = String(memberDoc.role || "MEMBER").trim().toUpperCase();
    user.isSuperAdmin = false;
    user.masterId = memberMasterId || undefined;
    user.userDoc = memberDoc;
    user.userDocTenantId = targetTenantId;
    next();
    return;
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
