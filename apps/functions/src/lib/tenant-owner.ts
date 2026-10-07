/**
 * Quem é o dono de uma empresa, numa regra só.
 *
 * O dono é o usuário mais antigo do tenant sem `masterId`, ou com o `masterId`
 * apontando para si mesmo (como os seeds e contas antigas gravam), e que não é
 * superadmin. É a regra de `resolveTenantOwnerUid` (Acessar Painel, "Dono" na
 * lista de membros) e da aba Acesso do painel do super admin. Quando as duas
 * divergiam, a aba Acesso podia mostrar um membro com papel de administrador
 * como se fosse o dono, e o Perfil do Acessar Painel mostrava outra pessoa.
 */

interface UserDocLike {
  id: string;
  get(field: string): unknown;
}

export function isTenantOwnerCandidate(doc: UserDocLike): boolean {
  const masterId = String(doc.get("masterId") || "").trim();
  if (masterId && masterId !== doc.id) return false;
  return String(doc.get("role") || "").toUpperCase() !== "SUPERADMIN";
}

function createdAtKey(doc: UserDocLike): string {
  const value = doc.get("createdAt");
  if (value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return String(value || "");
}

export function compareByCreatedAt(a: UserDocLike, b: UserDocLike): number {
  return createdAtKey(a).localeCompare(createdAtKey(b));
}

/**
 * Um doc de dono por empresa, na ordem em que cada empresa apareceu em `docs`.
 * Entre dois candidatos da mesma empresa fica o mais antigo. Doc sem tenant
 * (conta free antiga) passa como está.
 */
export function selectTenantOwnerDocs<T extends UserDocLike>(docs: T[]): T[] {
  const ownerByTenant = new Map<string, T>();
  const order: Array<string | T> = [];
  for (const doc of docs) {
    if (!isTenantOwnerCandidate(doc)) continue;
    const tenantId = String(doc.get("tenantId") || doc.get("companyId") || "").trim();
    if (!tenantId) {
      order.push(doc);
      continue;
    }
    const current = ownerByTenant.get(tenantId);
    if (!current) {
      ownerByTenant.set(tenantId, doc);
      order.push(tenantId);
    } else if (compareByCreatedAt(doc, current) < 0) {
      ownerByTenant.set(tenantId, doc);
    }
  }
  return order.map((entry) => (typeof entry === "string" ? ownerByTenant.get(entry)! : entry));
}
