"use client";

import { callApi } from "@/lib/api-client";
import { PlanFeatures } from "@/types";

interface AdminCredentialsData {
  userId: string;
  tenantId?: string; // Optional if we just want to update a user by ID
  email?: string;
  password?: string;
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
  };
  admin: {
    id: string;
    email: string;
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
  };
  planFeatures?: Partial<PlanFeatures>;
}

export const AdminService = {
  updateCredentials: async (data: AdminCredentialsData): Promise<void> => {
    await callApi("/v1/admin/credentials", "POST", data);
  },

  updateAdminCredentials: async (data: AdminCredentialsData): Promise<void> => {
    await callApi("/v1/admin/credentials", "POST", data);
  },

  getAllTenantsBilling: async (): Promise<TenantBillingInfo[]> => {
    return await callApi<TenantBillingInfo[]>(
      "/v1/admin/tenants/billing",
      "GET"
    );
  },

  updateUserPlan: async (_userId: string, _planId: string): Promise<void> => {
    // Placeholder for plan update logic if implemented in API
    console.warn(
      "updateUserPlan usage detected but not fully implemented in frontend service"
    );
  },

  updateUserSubscription: async (
    _userId: string,
    _data: Record<string, unknown>
  ): Promise<void> => {
    // Placeholder
    console.warn("updateUserSubscription usage detected");
  },

  updateTenantLimits: async (
    tenantId: string,
    limits: Record<string, unknown>
  ): Promise<void> => {
    await callApi(`/v1/admin/tenants/${tenantId}/limits`, "PUT", limits);
  },
};
