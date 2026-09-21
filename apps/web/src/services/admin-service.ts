"use client";

import { callApi } from "@/lib/api-client";
import { PlanFeatures } from "@/types";

interface AdminCredentialsData {
  userId: string;
  tenantId?: string; // Optional if we just want to update a user by ID
  email?: string;
  password?: string;
  phoneNumber?: string;
}

interface CreateTenantInput {
  name: string;
  slug: string;
  primaryColor?: string;
  logoUrl?: string;
  niche?: string;
  whatsappEnabled?: boolean;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  adminPhoneNumber?: string;
  planId?: string;
  subscriptionStatus?: string;
  currentPeriodEnd?: string;
}

export interface TenantIndexItem {
  id: string;
  name: string;
  plan: string;
  accountStatus: string;
}

/** Resposta de GET /v1/admin/tenants/:id/modules (rotulos vem do catalogo do backend). */
export interface TenantModulesInfo {
  tenantId: string;
  tier: string;
  tierLabel: string;
  capabilities: Record<string, boolean>;
  tierCapabilities: Record<string, boolean>;
  capabilityLabels: Record<string, string>;
  limits: Record<string, number>;
  limitLabels: Record<string, string>;
  activeAddons: string[];
  addons: Array<{
    addonId: string;
    status: string;
    source: "stripe" | "courtesy" | "manual" | string;
    currentPeriodEnd: string | null;
  }>;
  availableAddons: Array<{ id: string; availableForTiers: string[] }>;
}

export interface TenantBillingInfo {
  tenant: {
    id: string;
    name: string;
    slug?: string;
    createdAt: string;
    logoUrl?: string;
    primaryColor?: string;
    niche?: string;
    whatsappEnabled?: boolean;
    /** active | deactivated | purging | purged */
    accountStatus?: string;
  };
  admin: {
    id: string;
    name?: string;
    email: string;
    phoneNumber?: string;
    subscriptionStatus?: string;
    currentPeriodEnd?: string;
    subscription?: {
      status: string;
      currentPeriodEnd: string;
      cancelAtPeriodEnd: boolean;
    };
  };
  planName: string; // Usage suggests this is at root
  planId?: string;
  subscriptionStatus?: string; // Usage suggests this might be at root OR on admin
  billingInterval?: string;
  usage: {
    users: number;
    proposals: number;
    clients: number;
    products: number;
    transactions: number;
    wallets: number;
    calendarEvents: number;
  };
  planFeatures?: Partial<PlanFeatures>;
  // Billing snapshot fields (present when API returns billing data)
  isBillingStale?: boolean;
  billingSyncedAt?: string;
  unitAmount?: number | null;
  currency?: string | null;
  stripeSubscriptionId?: string | null;
  /** Quem manda no plano/status: o webhook do Stripe ou o superadmin (contrato manual). */
  billingManagedBy?: "stripe" | "manual";
  priceChangeNotifiedFor?: string | null;
}

export interface TenantBillingPage {
  items: TenantBillingInfo[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const AdminService = {
  updateCredentials: async (data: AdminCredentialsData): Promise<void> => {
    await callApi("/v1/admin/credentials", "POST", data);
  },

  // Removes a user's enrolled MFA factors (recovery when the authenticator is
  // lost). Authorized server-side for super admins or the user's tenant admin.
  resetMemberMfa: async (uid: string): Promise<void> => {
    await callApi(`/v1/admin/members/${uid}/reset-mfa`, "POST");
  },

  updateAdminCredentials: async (data: AdminCredentialsData): Promise<void> => {
    await callApi("/v1/admin/credentials", "POST", data);
  },

  // Returns EVERY tenant by walking the paginated billing endpoint. The backend
  // responds with { items, nextCursor, hasMore }; callers that need the full set
  // (e.g. aggregate metrics) must accumulate all pages rather than read one page.
  getAllTenantsBilling: async (): Promise<TenantBillingInfo[]> => {
    const all: TenantBillingInfo[] = [];
    let cursor: string | undefined = undefined;
    // Bounded loop (20k tenants) as a safety net against a misbehaving backend.
    for (let page = 0; page < 200; page++) {
      const result = await AdminService.getTenantsBillingPage({
        cursor,
        pageSize: 100,
      });

      // Tolerate a legacy backend that returns a flat array (no pagination).
      if (Array.isArray(result)) {
        all.push(...result);
        break;
      }

      all.push(...(result.items ?? []));
      if (!result.hasMore || !result.nextCursor) break;
      cursor = result.nextCursor;
    }
    return all;
  },

  getTenantsBillingPage: async (params?: {
    cursor?: string;
    pageSize?: number;
  }): Promise<TenantBillingPage> => {
    const searchParams = new URLSearchParams();
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    if (params?.pageSize) searchParams.set("pageSize", String(params.pageSize));
    const query = searchParams.toString() ? `?${searchParams}` : "";
    return await callApi<TenantBillingPage>(
      `/v1/admin/tenants/billing${query}`,
      "GET",
    );
  },

  /** Linhas de billing de empresas especificas (ate 30 por chamada). */
  getTenantsBillingByIds: async (tenantIds: string[]): Promise<TenantBillingInfo[]> => {
    if (tenantIds.length === 0) return [];
    const params = new URLSearchParams({ tenantIds: tenantIds.slice(0, 30).join(",") });
    const result = await callApi<TenantBillingPage>(`/v1/admin/tenants/billing?${params}`, "GET");
    return Array.isArray(result) ? result : result.items ?? [];
  },

  /** Indice leve de todas as empresas (id, nome, plano, situacao). */
  getTenantsIndex: async (): Promise<TenantIndexItem[]> => {
    const result = await callApi<{ items: TenantIndexItem[] }>("/v1/admin/tenants/index", "GET");
    return result.items ?? [];
  },

  forceTenantBillingSync: async (tenantId: string): Promise<void> => {
    await callApi(`/v1/admin/tenants/${tenantId}/sync-billing`, "POST");
  },

  // Records a super admin "view as tenant" session start for the audit trail.
  startImpersonation: async (tenantId: string): Promise<void> => {
    await callApi("/v1/admin/impersonation/start", "POST", { tenantId });
  },

  stopImpersonation: async (
    tenantId: string,
    reason: "exit_button" | "admin_route" | "logout",
  ): Promise<void> => {
    await callApi("/v1/admin/impersonation/stop", "POST", { tenantId, reason });
  },

  updateUserPlan: async (userId: string, planId: string): Promise<void> => {
    await callApi(`/v1/admin/users/${userId}/plan`, "PUT", { planId });
  },

  updateUserSubscription: async (
    userId: string,
    data: Record<string, unknown>,
  ): Promise<void> => {
    await callApi(`/v1/admin/users/${userId}/subscription`, "PUT", data);
  },


  createTenant: async (
    data: CreateTenantInput,
  ): Promise<{ tenantId: string; adminUserId: string }> => {
    return await callApi<{ tenantId: string; adminUserId: string }>(
      "/v1/admin/tenants",
      "POST",
      data,
    );
  },

  deactivateTenant: async (tenantId: string): Promise<{ message?: string }> => {
    return await callApi(`/v1/admin/tenants/${tenantId}/deactivate`, "POST", {});
  },

  reactivateTenant: async (tenantId: string): Promise<{ message?: string }> => {
    return await callApi(`/v1/admin/tenants/${tenantId}/reactivate`, "POST", {});
  },

  purgeTenant: async (
    tenantId: string,
    confirmName: string,
  ): Promise<{ message?: string }> => {
    return await callApi(`/v1/admin/tenants/${tenantId}/purge`, "POST", { confirmName });
  },

  copyTenantData: async (
    sourceTenantId: string,
    targetTenantId: string,
    replace = false,
  ): Promise<{ totalCopied: number; removed?: number; message?: string }> => {
    return await callApi<{ totalCopied: number; removed?: number; message?: string }>(
      "/v1/admin/tenants/copy-data",
      "POST",
      { sourceTenantId, targetTenantId, replace },
    );
  },

  getTenantModules: async (tenantId: string): Promise<TenantModulesInfo> => {
    return await callApi<TenantModulesInfo>(`/v1/admin/tenants/${tenantId}/modules`);
  },

  grantCourtesyAddon: async (tenantId: string, addonId: string): Promise<void> => {
    await callApi(`/v1/admin/tenants/${tenantId}/addons/${addonId}`, "POST", {});
  },

  revokeCourtesyAddon: async (tenantId: string, addonId: string): Promise<void> => {
    await callApi(`/v1/admin/tenants/${tenantId}/addons/${addonId}`, "DELETE");
  },

  recomputeFeatures: async (tenantId: string): Promise<{ whatsappEnabled: boolean }> => {
    return await callApi<{ whatsappEnabled: boolean }>(
      `/v1/admin/tenants/${tenantId}/recompute-features`,
      "POST",
    );
  },

  migrateTenantPrices: async (
    tenantIds: string[],
    prorationBehavior: "none" | "create_prorations" = "none",
  ): Promise<{
    migrated: number;
    skipped: number;
    failed: number;
    results: {
      tenantId: string;
      status: "migrated" | "skipped" | "failed";
      reason?: string;
      fromPriceId?: string;
      toPriceId?: string;
    }[];
  }> => {
    return await callApi("/v1/admin/tenants/migrate-prices", "POST", {
      tenantIds,
      prorationBehavior,
    });
  },
};
