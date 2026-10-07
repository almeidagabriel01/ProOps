"use client";

import { callApi } from "@/lib/api-client";
import { PlanFeatures } from "@/types";
import type { ActivityCategory, TenantActivityType } from "@/lib/activity/catalog";
import type { PresenceInfo, PresenceStatus } from "@/lib/presence-format";

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

export interface TenantMemberInfo {
  id: string;
  name: string;
  email: string;
  /** Papel como gravado no backend, em maiúsculas (MEMBER, ADMIN, MASTER...). */
  role: string;
  masterId: string | null;
  isOwner: boolean;
  createdAt: string | null;
  /** Doc de cada página: as quatro ações, as chaves finas e o escopo do catálogo. */
  permissions: Record<
    string,
    { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean } & Record<
      string,
      boolean | string | undefined
    >
  >;
}

/** Uma pessoa na tela "Online" (GET /v1/admin/presence). */
export interface PresencePerson {
  uid: string;
  name: string;
  email: string;
  role: string;
  status: PresenceStatus;
  sessionStartedAt: string | null;
  lastHeartbeatAt: string | null;
  lastActiveAt: string | null;
}

/** Uma empresa que passou pelo ERP hoje, com cada pessoa. */
export interface TenantPresenceEntry extends PresenceInfo {
  tenantId: string;
  tenantName: string;
  people: PresencePerson[];
}

export interface PresenceSnapshot {
  now: string;
  since: string;
  tenants: TenantPresenceEntry[];
}

export interface AdminAuditActor {
  uid: string;
  name: string;
  email: string;
  role: string;
  isSuperAdmin: boolean;
}

export interface AdminAuditEvent {
  id: string;
  eventType: string;
  uid?: string | null;
  /** Quem agiu, resolvido pelo backend a partir do uid. */
  actor?: AdminAuditActor;
  tenantId?: string | null;
  route?: string | null;
  reason?: string | null;
  eventId?: string | null;
  source?: string | null;
  createdAt: string;
}

/** Um evento da atividade das empresas (GET /v1/admin/activity). */
export interface TenantActivityEvent {
  id: string;
  tenantId: string | null;
  uid: string | null;
  role: string | null;
  isDemo: boolean;
  category: ActivityCategory;
  type: TenantActivityType;
  route: string | null;
  meta: Record<string, string | number | boolean>;
  source: "client" | "server" | null;
  sessionId: string | null;
  createdAt: string | null;
  /** Quem agiu, resolvido pelo backend a partir do uid. */
  actor?: AdminAuditActor;
}

export interface TenantActivityPage {
  events: TenantActivityEvent[];
  nextCursor: string | null;
}

export interface TenantActivityQuery {
  tenantId?: string;
  category?: ActivityCategory;
  type?: TenantActivityType;
  uid?: string;
  cursor?: string | null;
  limit?: number;
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
    /** Última vez que alguém da empresa abriu o ERP. */
    lastSeenAt?: string;
    /** Online, ausente ou a última sessão da empresa. Ausente se ninguém nunca avisou presença. */
    presence?: PresenceInfo;
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
  getAuditEvents: async (params: {
    tenantId?: string;
    eventType?: string;
    limit?: number;
  }): Promise<AdminAuditEvent[]> => {
    const search = new URLSearchParams();
    if (params.tenantId) search.set("tenantId", params.tenantId);
    if (params.eventType) search.set("eventType", params.eventType);
    search.set("limit", String(params.limit ?? 50));
    const result = await callApi<{ events: AdminAuditEvent[] }>(
      `/v1/admin/audit-events?${search}`,
      "GET",
    );
    return result.events ?? [];
  },

  /** Atividade das empresas: telas, ações, jornada e erros, mais recente primeiro. */
  getTenantActivity: async (params: TenantActivityQuery): Promise<TenantActivityPage> => {
    const search = new URLSearchParams();
    if (params.tenantId) search.set("tenantId", params.tenantId);
    if (params.category) search.set("category", params.category);
    if (params.type) search.set("type", params.type);
    if (params.uid) search.set("uid", params.uid);
    if (params.cursor) search.set("cursor", params.cursor);
    search.set("limit", String(params.limit ?? 50));
    const result = await callApi<TenantActivityPage>(`/v1/admin/activity?${search}`, "GET");
    return { events: result.events ?? [], nextCursor: result.nextCursor ?? null };
  },

  /** Quem está online agora e quem passou pelo ERP hoje. */
  getPresence: async (): Promise<PresenceSnapshot> => {
    const result = await callApi<PresenceSnapshot>("/v1/admin/presence", "GET");
    return { now: result.now, since: result.since, tenants: result.tenants ?? [] };
  },

  startImpersonation: async (tenantId: string, memberUid?: string): Promise<void> => {
    await callApi("/v1/admin/impersonation/start", "POST", {
      tenantId,
      ...(memberUid ? { memberUid } : {}),
    });
  },

  stopImpersonation: async (
    tenantId: string,
    reason: "exit_button" | "admin_route" | "logout" | "switch",
    memberUid?: string,
  ): Promise<void> => {
    await callApi("/v1/admin/impersonation/stop", "POST", {
      tenantId,
      reason,
      ...(memberUid ? { memberUid } : {}),
    });
  },

  /** Pessoas da empresa para o "Ver como membro" (dono marcado, sem superadmin). */
  getTenantMembers: async (tenantId: string): Promise<TenantMemberInfo[]> => {
    const data = await callApi<{ members: TenantMemberInfo[] }>(
      `/v1/admin/tenants/${tenantId}/members`,
    );
    return data.members ?? [];
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

  /** Corta o contrato manual agora: canceled + free, sem esperar a data. */
  endManualAccess: async (tenantId: string): Promise<{ message?: string }> => {
    return await callApi(`/v1/admin/tenants/${tenantId}/end-manual-access`, "POST", {});
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
