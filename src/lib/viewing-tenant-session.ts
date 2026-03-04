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
}
