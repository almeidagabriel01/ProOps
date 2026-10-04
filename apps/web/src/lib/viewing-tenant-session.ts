"use client";

const VIEWING_TENANT_KEY = "viewingAsTenant";
const LEGACY_VIEWING_TENANT_DATA_KEY = "viewingAsTenantData";

function canUseSessionStorage() {
  return typeof window !== "undefined";
}

function cleanupLegacyViewingTenantStorage() {
  if (!canUseSessionStorage()) {
    return;
  }

  sessionStorage.removeItem(LEGACY_VIEWING_TENANT_DATA_KEY);
  localStorage.removeItem(VIEWING_TENANT_KEY);
  localStorage.removeItem(LEGACY_VIEWING_TENANT_DATA_KEY);
}

export function readViewingTenantId(): string | null {
  if (!canUseSessionStorage()) {
    return null;
  }

  cleanupLegacyViewingTenantStorage();
  return sessionStorage.getItem(VIEWING_TENANT_KEY);
}

export function writeViewingTenantId(tenantId: string) {
  if (!canUseSessionStorage()) {
    return;
  }

  cleanupLegacyViewingTenantStorage();
  sessionStorage.setItem(VIEWING_TENANT_KEY, tenantId);
}

export function clearViewingTenantId() {
  if (!canUseSessionStorage()) {
    return;
  }

  cleanupLegacyViewingTenantStorage();
  sessionStorage.removeItem(VIEWING_TENANT_KEY);
  sessionStorage.removeItem("viewingAsTenantWrite");
  sessionStorage.removeItem("viewingAsMember");
}

// Edicao habilitada no "Acessar Painel". Guarda o tenant junto para nunca
// vazar de uma empresa para a proxima: trocar de empresa volta a somente leitura.
const IMPERSONATION_WRITE_KEY = "viewingAsTenantWrite";

export function readImpersonationWriteEnabled(): boolean {
  if (!canUseSessionStorage()) return false;
  const tenantId = sessionStorage.getItem(VIEWING_TENANT_KEY);
  return Boolean(tenantId) && sessionStorage.getItem(IMPERSONATION_WRITE_KEY) === tenantId;
}

export function writeImpersonationWriteEnabled(enabled: boolean) {
  if (!canUseSessionStorage()) return;
  const tenantId = sessionStorage.getItem(VIEWING_TENANT_KEY);
  if (enabled && tenantId) {
    sessionStorage.setItem(IMPERSONATION_WRITE_KEY, tenantId);
  } else {
    sessionStorage.removeItem(IMPERSONATION_WRITE_KEY);
  }
}

// "Ver como membro". Guardado como `tenantId:uid`, pelo mesmo motivo da chave
// de escrita: trocar de empresa nunca leva o membro da anterior junto.
const VIEWING_MEMBER_KEY = "viewingAsMember";

export function readViewingMemberId(): string | null {
  if (!canUseSessionStorage()) return null;
  const tenantId = sessionStorage.getItem(VIEWING_TENANT_KEY);
  const stored = sessionStorage.getItem(VIEWING_MEMBER_KEY);
  if (!tenantId || !stored) return null;
  const prefix = `${tenantId}:`;
  if (!stored.startsWith(prefix)) return null;
  return stored.slice(prefix.length) || null;
}

export function writeViewingMemberId(memberId: string | null) {
  if (!canUseSessionStorage()) return;
  const tenantId = sessionStorage.getItem(VIEWING_TENANT_KEY);
  if (memberId && tenantId) {
    sessionStorage.setItem(VIEWING_MEMBER_KEY, `${tenantId}:${memberId}`);
    // A visao de membro e sempre somente leitura.
    sessionStorage.removeItem(IMPERSONATION_WRITE_KEY);
  } else {
    sessionStorage.removeItem(VIEWING_MEMBER_KEY);
  }
}

/**
 * Cabecalhos que dizem ao backend qual empresa o superadmin esta vendo, se a
 * edicao esta habilitada e, no "Ver como membro", qual membro
 * (`api/middleware/impersonation.ts`). Vazio fora do "Acessar Painel". Unico
 * lugar que monta esses cabecalhos.
 */
export function buildImpersonationHeaders(): Record<string, string> {
  const tenantId = readViewingTenantId();
  if (!tenantId) return {};
  const headers: Record<string, string> = { "x-tenant-id": tenantId };
  const memberId = readViewingMemberId();
  if (memberId) {
    headers["x-view-as-member"] = memberId;
    return headers;
  }
  if (readImpersonationWriteEnabled()) headers["x-impersonation-write"] = "1";
  return headers;
}
