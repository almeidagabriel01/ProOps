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
      "GET",
    );
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
};
