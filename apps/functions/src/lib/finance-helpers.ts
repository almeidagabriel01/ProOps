import { db } from "../init";
import { UserDoc } from "./auth-helpers";
import { resolvePermissionKey, resolvePermissionScope } from "../shared/permission-catalog";

function normalizeRole(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeTenantId(value: unknown): string {
  return String(value || "").trim();
}

export interface WalletDoc {
  name: string;
  balance: number;
  tenantId: string;
}

/**
 * Add months to a date string (YYYY-MM-DD format).
 * Handles timezone-safe parsing by manually extracting year/month/day.
 */
export function addMonths(dateStr: string, months: number): string {
  // Parse the date manually to avoid timezone issues
  // Format expected: YYYY-MM-DD
  const parts = dateStr.split("-");
  if (parts.length !== 3) {
    // Fallback: try ISO format
    if (dateStr.includes("T")) {
      return addMonths(dateStr.split("T")[0], months);
    }
    console.error("Invalid date format for addMonths:", dateStr);
    return dateStr;
  }

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
  const day = parseInt(parts[2], 10);

  // Calculate new month and year
  const totalMonths = year * 12 + month + months;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = totalMonths % 12;

  // Handle edge case: if original day is 31 but new month has less days
  const daysInNewMonth = new Date(newYear, newMonth + 1, 0).getDate();
  const newDay = Math.min(day, daysInNewMonth);

  // Format back to YYYY-MM-DD
  const yearStr = newYear.toString().padStart(4, "0");
  const monthStr = (newMonth + 1).toString().padStart(2, "0");
  const dayStr = newDay.toString().padStart(2, "0");

  return `${yearStr}-${monthStr}-${dayStr}`;
}

export async function resolveWalletRef(
  transaction: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  tenantId: string,
  identifier: string,
): Promise<{
  ref: FirebaseFirestore.DocumentReference;
  data: WalletDoc;
} | null> {
  if (!identifier) return null;

  // 1. Try as ID
  const directRef = db.collection("wallets").doc(identifier);
  const directSnap = await transaction.get(directRef);

  if (directSnap.exists) {
    const data = directSnap.data() as WalletDoc;
    if (data.tenantId === tenantId) {
      return { ref: directRef, data };
    }
  }

  // 2. Try as Name
  const nameQuery = db
    .collection("wallets")
    .where("tenantId", "==", tenantId)
    .where("name", "==", identifier)
    .limit(1);

  const querySnap = await transaction.get(nameQuery);

  if (!querySnap.empty) {
    const doc = querySnap.docs[0];
    return { ref: doc.ref, data: doc.data() as WalletDoc };
  }

  return null;
}

/**
 * Páginas de permissão do módulo financeiro. São os ids que a tela de Equipe
 * grava em `users/{uid}/permissions/{id}` — os MESMOS lidos pelo page-config
 * e pelo `usePagePermission` no frontend.
 *
 * Até aqui esta função lia um doc `financial` cravado no código, que NENHUM
 * caminho de escrita jamais criou: a tela sempre gravou `transactions` e
 * `wallet`. O efeito era todo membro receber "Sem permissão financeira." em
 * qualquer criação, edição ou exclusão, independentemente do que o master
 * tivesse marcado.
 */
export type FinancialPageId = "transactions" | "wallet";

export async function checkFinancialPermission(
  userId: string,
  pageId: FinancialPageId,
  permission: string,
  claims?: { uid?: string; role?: string; tenantId?: string; [key: string]: unknown },
): Promise<{
  userDoc?: UserDoc;
  tenantId: string;
  isMaster: boolean;
  isSuperAdmin: boolean;
}> {
  if (!claims?.uid || claims.uid !== userId) {
    throw new Error("UNAUTHENTICATED");
  }

  const role = normalizeRole(claims.role);
  if (!role) throw new Error("AUTH_CLAIMS_MISSING_ROLE");

  const isSuperAdmin = role === "SUPERADMIN";
  const tenantId = normalizeTenantId(claims.tenantId);

  if (!isSuperAdmin && !tenantId) {
    throw new Error("AUTH_CLAIMS_MISSING_TENANT");
  }

  const userRef = db.collection("users").doc(userId);
  // O middleware de auth já leu users/{uid} nesta request e publicou o
  // snapshot em `claims.userDoc` (null = doc não existe). Reler aqui custava
  // uma leitura extra em todo endpoint financeiro. `undefined` (chamador sem o
  // contexto do middleware) mantém a leitura.
  let userDoc: UserDoc;
  if (claims.userDoc !== undefined) {
    if (claims.userDoc === null) throw new Error("Usuário não encontrado.");
    userDoc = claims.userDoc as UserDoc;
  } else {
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new Error("Usuário não encontrado.");
    userDoc = userSnap.data() as UserDoc;
  }

  const docTenantId = normalizeTenantId(userDoc.tenantId || userDoc.companyId);
  // Superadmin no "Acessar Painel": o middleware de impersonacao trocou o
  // tenant das claims pelo da empresa vista, que nao casa com o doc dele por
  // construcao (a mesma excecao de `resolveUserAndTenant`). Sem ela, todo
  // endpoint financeiro respondia 403 ao suporte.
  const impersonating = isSuperAdmin && Boolean(claims.impersonation);
  if (tenantId && docTenantId && tenantId !== docTenantId && !impersonating) {
    throw new Error("FORBIDDEN_TENANT_MISMATCH");
  }

  const effectiveTenantId = tenantId || docTenantId;
  if (!isSuperAdmin && !effectiveTenantId) {
    throw new Error("AUTH_CLAIMS_MISSING_TENANT");
  }

  // Check master logic using role claims only.
  const isMaster = role === "MASTER" || role === "ADMIN" || role === "WK";

  if (isSuperAdmin)
    return {
      userDoc,
      tenantId: effectiveTenantId,
      isMaster: true,
      isSuperAdmin: true,
    };
  if (isMaster)
    return {
      userDoc,
      tenantId: effectiveTenantId,
      isMaster: true,
      isSuperAdmin: false,
    };

  // Member check - Needs Permissions Doc
  const permRef = userRef.collection("permissions").doc(pageId);
  const permSnap = await permRef.get();

  // Pelo catálogo: as quatro ações leem o valor gravado, como sempre; a ação
  // fina (`settle`, `transfer`...) ausente vale a básica equivalente.
  if (!permSnap.exists || !resolvePermissionKey(pageId, permSnap.data() ?? null, permission)) {
    throw new Error("Sem permissão financeira.");
  }

  return {
    userDoc,
    tenantId: effectiveTenantId,
    isMaster: false,
    isSuperAdmin: false,
  };
}

/**
 * As chaves finas de uma página do financeiro para quem está agindo, com UMA
 * leitura: dar baixa, estornar e custos extras são conferidos por lançamento
 * dentro de lotes. Dono, administradores e superadmin podem tudo.
 */
export async function loadFinancialKeys(
  userId: string,
  pageId: FinancialPageId,
  isPrivileged: boolean,
): Promise<(key: string) => boolean> {
  if (isPrivileged) return () => true;
  const snap = await db.collection("users").doc(userId).collection("permissions").doc(pageId).get();
  const data = snap.exists ? (snap.data() ?? null) : null;
  return (key: string) => resolvePermissionKey(pageId, data, key);
}

/**
 * O que uma mudança de status de lançamento pede: ir para pago é dar baixa,
 * sair de pago é estornar. Pendente e atrasado entre si não pedem nada além
 * do Editar.
 */
export function statusChangeKey(
  current: unknown,
  next: unknown,
): "settle" | "revert" | null {
  if (!next || next === current) return null;
  if (next === "paid") return "settle";
  if (current === "paid") return "revert";
  return null;
}

export const FINANCIAL_KEY_MESSAGES: Record<"settle" | "revert" | "extraCosts", string> = {
  settle: "Sem permissão para dar baixa em lançamentos.",
  revert: "Sem permissão para estornar lançamentos pagos.",
  extraCosts: "Sem permissão para mexer nos custos extras.",
};

/**
 * Se os custos extras mudaram de verdade: o formulário reenvia a lista
 * inteira. Compara o que importa (descrição, valor, carteira, status), na
 * ordem de id, para reenvio igual não contar como mudança.
 */
export function extraCostsChanged(current: unknown, next: unknown): boolean {
  const key = (value: unknown) =>
    JSON.stringify(
      (Array.isArray(value) ? value : [])
        .map((raw) => {
          const ec = (raw ?? {}) as Record<string, unknown>;
          return [
            String(ec.id ?? ""),
            String(ec.description ?? "").trim(),
            Math.round(Number(ec.amount ?? 0) * 100),
            String(ec.wallet ?? ""),
            String(ec.status ?? "pending"),
          ];
        })
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    );
  return key(current) !== key(next);
}

/**
 * O alcance de Lançamentos de quem age, numa leitura: tudo, só receitas ou só
 * os das vendas dele (`sellerId`). É a regra das rules, para a API não mexer
 * pelo id no que o SDK recusa. Dono, administradores e superadmin alcançam tudo.
 */
export async function loadTransactionScope(
  userId: string,
  isPrivileged: boolean,
): Promise<(data: Record<string, unknown> | undefined) => boolean> {
  if (isPrivileged) return () => true;
  const snap = await db.collection("users").doc(userId).collection("permissions").doc("transactions").get();
  const scope = resolvePermissionScope("transactions", snap.exists ? (snap.data() ?? null) : null) ?? "all";
  if (scope === "all") return () => true;
  if (scope === "income") return (data) => data?.type === "income";
  return (data) => data?.sellerId === userId;
}

export const OUT_OF_SCOPE_MESSAGE = "Transação não encontrada.";
