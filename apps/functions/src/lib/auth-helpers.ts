import { db } from "../init";
import { isTenantAdminRole } from "./auth-context";
import {
  getPermissionPageDef,
  normalizePermissionDoc,
  resolvePermissionKey,
  resolvePermissionScope,
} from "../shared/permission-catalog";

export interface UserDoc {
  role: string;
  name?: string;
  masterId?: string | null;
  masterID?: string | null;
  ownerId?: string | null;
  tenantId?: string;
  companyId?: string;
  planId?: string;
  companyName?: string;
  subscription?: {
    limits: {
      maxProducts: number;
      maxClients?: number;
      maxUsers?: number;
      maxProposals?: number;
    };
    status: string;
  };
  usage?: {
    products: number;
    clients?: number;
    users?: number;
    proposals?: number;
  };
}

function normalizeRole(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeTenantId(value: unknown): string {
  return String(value || "").trim();
}

export interface PermissionCheckResult {
  userRef: FirebaseFirestore.DocumentReference;
  userData: UserDoc;
  masterRef: FirebaseFirestore.DocumentReference;
  masterData: UserDoc;
  tenantId: string;
  isMaster: boolean;
  isSuperAdmin: boolean;
}

export const resolveUserAndTenant = async (
  userId: string,
  claims?: {
    uid?: string;
    role?: string;
    tenantId?: string;
    masterId?: string;
    userDoc?: Record<string, unknown> | null;
    [key: string]: unknown;
  },
): Promise<PermissionCheckResult> => {
  if (!claims?.uid || claims.uid !== userId) {
    throw new Error("UNAUTHENTICATED");
  }

  const claimRole = normalizeRole(claims.role);
  if (!claimRole) {
    throw new Error("AUTH_CLAIMS_MISSING_ROLE");
  }

  const isSuperAdmin = claimRole === "SUPERADMIN";
  const isMaster =
    claimRole === "MASTER" || claimRole === "ADMIN" || claimRole === "WK";

  const claimTenantId = normalizeTenantId(claims.tenantId);
  if (!isSuperAdmin && !claimTenantId) {
    throw new Error("AUTH_CLAIMS_MISSING_TENANT");
  }

  const userRef = db.collection("users").doc(userId);
  let userData: UserDoc;
  if (claims.userDoc !== undefined) {
    // Snapshot preloaded pelo middleware de auth nesta mesma request — evita
    // a segunda leitura de users/{uid} no hot path. null = doc não existe.
    if (claims.userDoc === null) throw new Error("User not found");
    userData = claims.userDoc as unknown as UserDoc;
  } else {
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new Error("User not found");
    userData = userSnap.data() as UserDoc;
  }

  // Superadmin vendo outra empresa: o middleware de impersonacao ja trocou o
  // tenant das claims pelo alvo, entao ele nao casa com o doc do superadmin por
  // construcao. O "dono" passa a ser o dono da empresa alvo, que e onde os
  // controllers legados leem limites e gravam contadores.
  const impersonation = isSuperAdmin
    ? (claims.impersonation as { targetTenantId?: string; ownerUid?: string | null } | undefined)
    : undefined;
  if (impersonation?.targetTenantId) {
    const targetTenantId = normalizeTenantId(impersonation.targetTenantId);
    const ownerUid = String(impersonation.ownerUid || "").trim();
    if (ownerUid) {
      const ownerRef = db.collection("users").doc(ownerUid);
      const ownerSnap = await ownerRef.get();
      if (ownerSnap.exists) {
        return {
          userRef,
          userData,
          masterRef: ownerRef,
          masterData: ownerSnap.data() as UserDoc,
          tenantId: targetTenantId,
          isMaster,
          isSuperAdmin,
        };
      }
    }
    return {
      userRef,
      userData,
      masterRef: userRef,
      masterData: userData,
      tenantId: targetTenantId,
      isMaster,
      isSuperAdmin,
    };
  }

  const docTenantId = normalizeTenantId(userData.tenantId || userData.companyId);
  if (claimTenantId && docTenantId && claimTenantId !== docTenantId) {
    throw new Error("FORBIDDEN_TENANT_MISMATCH");
  }

  const tenantId = claimTenantId || docTenantId;
  if (!tenantId && !isSuperAdmin) {
    throw new Error("AUTH_CLAIMS_MISSING_TENANT");
  }

  let masterRef: FirebaseFirestore.DocumentReference;
  let masterData: UserDoc;

  if (isMaster || isSuperAdmin) {
    masterRef = userRef;
    masterData = userData;
  } else {
    const masterId =
      String(claims.masterId || "").trim() ||
      userData.masterId ||
      userData.masterID ||
      userData.ownerId;

    if (!masterId) {
      throw new Error("Member has no masterId");
    }

    masterRef = db.collection("users").doc(masterId);
    const masterSnap = await masterRef.get();
    if (!masterSnap.exists) throw new Error("Master account not found");
    masterData = masterSnap.data() as UserDoc;

    const masterTenantId = normalizeTenantId(
      masterData.tenantId || masterData.companyId,
    );
    if (tenantId && masterTenantId && tenantId !== masterTenantId) {
      throw new Error("FORBIDDEN_TENANT_MISMATCH");
    }
  }

  return {
    userRef,
    userData,
    masterRef,
    masterData,
    tenantId: tenantId || "",
    isMaster,
    isSuperAdmin,
  };
};

/**
 * Lê uma chave de permissão do membro. Para as páginas do catálogo
 * (`shared/permission-catalog.ts`) a leitura passa por `resolvePermissionKey`:
 * ações finas e dados sensíveis sem valor gravado valem o fallback do
 * catálogo, e sem "Ver" nenhuma ação vale. Página fora do catálogo (o doc
 * antigo `customers`) é lida crua, como sempre foi.
 */
export const checkPermission = async (
  userId: string,
  permissionDoc: string, // e.g., 'products'
  requiredField: string, // e.g., 'canCreate' ou uma chave fina, 'approve'
): Promise<boolean> => {
  const permRef = db
    .collection("users")
    .doc(userId)
    .collection("permissions")
    .doc(permissionDoc);
  const permSnap = await permRef.get();
  const data = permSnap.exists ? (permSnap.data() as Record<string, unknown>) : null;

  if (getPermissionPageDef(permissionDoc)) {
    return resolvePermissionKey(permissionDoc, data, requiredField);
  }
  return data?.[requiredField] === true;
};

export type PermissionAction =
  | "canView"
  | "canCreate"
  | "canEdit"
  | "canDelete";

/** Uma ação básica ou uma chave fina do catálogo (`approve`, `viewCost`...). */
export type PermissionKey = PermissionAction | (string & {});

/**
 * Gate de permissão por página, com o bypass de master já aplicado.
 *
 * Os controllers antigos (products, services, clients, proposals) repetem
 * `if (!isMaster && !isSuperAdmin) { checkPermission(...) }` porque já têm o
 * contexto resolvido em mãos. Os módulos que estão sendo padronizados agora
 * (kanban, planilhas, auxiliares) não precisam do doc do usuário para nada
 * além disto, então resolvem o role pelas claims e evitam a leitura extra de
 * `users/{uid}`.
 *
 * `pageId` é o mesmo id que a tela de Equipe grava em
 * `users/{uid}/permissions/{pageId}` — nunca inventar uma chave nova aqui: foi
 * assim que o módulo financeiro ficou negando tudo para todo membro.
 */
export const hasPagePermission = async (
  claims: { uid?: string; role?: string } | undefined,
  pageId: string,
  action: PermissionKey,
): Promise<boolean> => {
  const uid = claims?.uid;
  if (!uid) return false;
  if (isTenantAdminRole(normalizeRole(claims?.role))) return true;
  return checkPermission(uid, pageId, action);
};

/**
 * O escopo do membro numa página com "só os meus" (`scope` no catálogo). Dono
 * e administradores veem tudo: devolve o valor mais amplo, `"all"`.
 */
export const getPageScope = async (
  claims: { uid?: string; role?: string } | undefined,
  pageId: string,
): Promise<string> => {
  const uid = claims?.uid;
  if (!uid) return getPermissionPageDef(pageId)?.scope?.narrowest ?? "all";
  if (isTenantAdminRole(normalizeRole(claims?.role))) return "all";
  const snap = await db.collection("users").doc(uid).collection("permissions").doc(pageId).get();
  const data = snap.exists ? (snap.data() as Record<string, unknown>) : null;
  return resolvePermissionScope(pageId, data) ?? "all";
};

export type PagePermissionMap = Record<string, Record<string, unknown>>;

/**
 * Le a subcolecao de permissoes inteira de uma vez.
 *
 * `checkPermission` custa uma leitura por par pagina/acao, o que e certo para
 * um controller que checa uma coisa. Quem precisa avaliar VARIAS paginas na
 * mesma request — a Lia, que monta a lista de ferramentas disponiveis — faria
 * uma dezena de leituras; aqui e uma consulta.
 *
 * Devolve mapa vazio para administradores do tenant: eles nao tem docs de
 * permissao e o bypass e resolvido por `resolvePagePermission`.
 */
export const loadPagePermissions = async (
  claims: { uid?: string; role?: string } | undefined,
): Promise<PagePermissionMap> => {
  const uid = claims?.uid;
  if (!uid || isTenantAdminRole(normalizeRole(claims?.role))) return {};

  const snap = await db
    .collection("users")
    .doc(uid)
    .collection("permissions")
    .get();

  const map: PagePermissionMap = {};
  snap.forEach((doc) => {
    map[doc.id] = doc.data() as Record<string, unknown>;
  });
  return map;
};

/** Avalia o mapa de `loadPagePermissions`, aplicando o bypass de administrador. */
export const resolvePagePermission = (
  claims: { role?: string } | undefined,
  permissions: PagePermissionMap | undefined,
  pageId: string,
  action: PermissionKey,
): boolean => {
  if (isTenantAdminRole(normalizeRole(claims?.role))) return true;
  const doc = permissions?.[pageId];
  if (getPermissionPageDef(pageId)) return resolvePermissionKey(pageId, doc ?? null, action);
  return doc?.[action] === true;
};

/**
 * Sem "Ver", as outras tres acoes nao significam nada — e a tela de Equipe
 * desliga as tres ao desligar o "Ver". A cascata existia SO no cliente
 * (team-management.tsx): a API aceitava `canCreate: true` com
 * `canView: false`, gravando um estado que nenhuma tela consegue produzir e
 * que a UI nao sabe representar.
 */
export function normalizePagePermission(pageId: string, perms: Record<string, unknown>) {
  return normalizePermissionDoc(pageId, perms);
}
