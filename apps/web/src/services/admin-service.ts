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

  forceTenantBillingSync: async (tenantId: string): Promise<void> => {
    await callApi(`/v1/admin/tenants/${tenantId}/sync-billing`, "POST");
  },

  // Records a super admin "view as tenant" session start for the audit trail.
  startImpersonation: async (tenantId: string): Promise<void> => {
    await callApi("/v1/admin/impersonation/start", "POST", { tenantId });
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

  updateTenantLimits: async (
    tenantId: string,
    limits: Record<string, unknown>,
  ): Promise<void> => {
    await callApi(`/v1/admin/tenants/${tenantId}/limits`, "PUT", limits);
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

  deleteTenant: async (tenantId: string): Promise<void> => {
    await callApi(`/v1/admin/tenants/${tenantId}`, "DELETE");
  },

  copyTenantData: async (sourceTenantId: string, targetTenantId: string): Promise<{ totalCopied: number, message?: string }> => {
    return await callApi<{ totalCopied: number, message?: string }>(
      "/v1/admin/tenants/copy-data",
      "POST",
      { sourceTenantId, targetTenantId }
    );
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
