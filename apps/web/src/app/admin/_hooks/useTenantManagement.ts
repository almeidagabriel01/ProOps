"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from '@/lib/toast';
import { TenantService } from "@/services/tenant-service";
import { AdminService, TenantBillingInfo } from "@/services/admin-service";
import { deriveSubscriptionDisplayStatus } from "@/lib/subscription-status";
import { Tenant } from "@/types";
import { useTenant } from "@/providers/tenant-provider";
import { TenantFormData } from "@/components/admin/tenant-dialog";

const PAGE_SIZE = 25;

interface UseTenantManagementReturn {
  tenantsData: TenantBillingInfo[];
  search: string;
  setSearch: (value: string) => void;
  isDialogOpen: boolean;
  setIsDialogOpen: (value: boolean) => void;
  editingData: TenantBillingInfo | null;
  filteredTenants: TenantBillingInfo[];
  openCreate: () => void;
  openEdit: (data: TenantBillingInfo) => void;
  handleSave: (data: TenantFormData) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  handleLoginAs: (tenant: Tenant) => void;
  handleRecompute: (tenantId: string) => Promise<void>;
  isLoading: boolean;
  isSaving: boolean;
  isRecomputing: boolean;
  // Pagination
  hasMore: boolean;
  cursorStack: string[];
  goNext: () => void;
  goPrev: () => void;
}

export function useTenantManagement(): UseTenantManagementReturn {
  const [tenantsData, setTenantsData] = React.useState<TenantBillingInfo[]>([]);
  const [search, setSearch] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingData, setEditingData] =
    React.useState<TenantBillingInfo | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isRecomputing, setIsRecomputing] = React.useState(false);

  // Pagination state
  const [currentCursor, setCurrentCursor] = React.useState<string | null>(null);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState(false);
  const [cursorStack, setCursorStack] = React.useState<string[]>([]);

  const { setViewingTenant } = useTenant();
  const router = useRouter();

  const loadTenants = React.useCallback(async (cursor: string | null) => {
    try {
      setIsLoading(true);
      // Try paginated endpoint first; fall back to flat list if backend doesn't
      // support pagination yet (returns an array instead of {items, nextCursor}).
      const result = await AdminService.getTenantsBillingPage({
        cursor: cursor ?? undefined,
        pageSize: PAGE_SIZE,
      });

      if (Array.isArray(result)) {
        // Backend returned a flat array (no pagination support yet)
        setTenantsData(result as TenantBillingInfo[]);
        setNextCursor(null);
        setHasMore(false);
      } else {
        setTenantsData(result.items ?? []);
        setNextCursor(result.nextCursor ?? null);
        setHasMore(result.hasMore ?? false);
      }
    } catch (error) {
      console.error("Failed to load tenants", error);
      toast.error("Erro ao carregar empresas");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadTenants(currentCursor);
  }, [loadTenants, currentCursor]);

  // Firestore onSnapshot listeners for tenants with stale billing data.
  //
  // When the list endpoint flags a tenant as billing-stale it also enqueues a
  // background Stripe sync. We listen on the tenant doc and apply the fresh
  // billing ONLY once that sync has actually landed (its `billingSyncedAt`
  // advanced past the value we had on attach). This prevents the historical bug
  // where the FIRST snapshot — firing with the still-stale doc — overwrote the
  // correct initial status with a raw, un-normalized value (e.g. a lapsed
  // cancel-at-period-end leaking as "active"). The display status is always run
  // through the shared deriveSubscriptionDisplayStatus, never taken raw.
  React.useEffect(() => {
    const stale = tenantsData.filter((t) => t.isBillingStale);
    if (stale.length === 0) return;

    const unsubs: Array<() => void> = [];
    const timeouts: Array<ReturnType<typeof setTimeout>> = [];
    // Safety net: if no advancing snapshot arrives (sync no-op/failure, or a
    // non-MFA superadmin hitting permission-denied on the listener), stop
    // showing the stale skeleton after a bounded wait and keep the last value.
    const SYNC_WAIT_MS = 15000;

    const clearStaleFlag = (tenantId: string) => {
      setTenantsData((prev) =>
        prev.map((t) =>
          t.tenant.id === tenantId && t.isBillingStale
            ? { ...t, isBillingStale: false }
            : t,
        ),
      );
    };

    for (const tenant of stale) {
      const tenantId = tenant.tenant.id;
      if (!tenantId) continue;

      // Baseline: the sync timestamp we already have, as epoch ms. A later
      // snapshot whose billingSyncedAt parses to a strictly greater instant means
      // the triggering sync completed. Comparing parsed instants (not raw ISO
      // strings) is robust to mixed precision/timezone offsets across writers.
      const baselineSyncedMs = Date.parse(tenant.billingSyncedAt ?? "");

      const timer = setTimeout(() => clearStaleFlag(tenantId), SYNC_WAIT_MS);
      timeouts.push(timer);

      const unsub = onSnapshot(
        doc(db, "tenants", tenantId),
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();

          const syncedAt =
            typeof data["billingSyncedAt"] === "string"
              ? (data["billingSyncedAt"] as string)
              : undefined;
          const plan =
            typeof data["plan"] === "string" ? (data["plan"] as string) : undefined;

          // Gate: only apply once the sync that we are waiting for has landed.
          // `free` resolves immediately (no Stripe round-trip needed).
          const syncedMs = syncedAt ? Date.parse(syncedAt) : NaN;
          const synced =
            Number.isFinite(syncedMs) &&
            (!Number.isFinite(baselineSyncedMs) || syncedMs > baselineSyncedMs);
          if (!synced && plan !== "free") return;

          const rawStatus =
            typeof data["subscriptionStatus"] === "string"
              ? (data["subscriptionStatus"] as string)
              : undefined;
          const currentPeriodEnd =
            typeof data["currentPeriodEnd"] === "string"
              ? (data["currentPeriodEnd"] as string)
              : undefined;
          const cancelAtPeriodEnd = Boolean(data["cancelAtPeriodEnd"]);

          const displayStatus = deriveSubscriptionDisplayStatus({
            planId: plan,
            storedStatus: rawStatus,
            cancelAtPeriodEnd,
            currentPeriodEnd: currentPeriodEnd ?? null,
          });

          setTenantsData((prev) =>
            prev.map((t) => {
              if (t.tenant.id !== tenantId) return t;
              return {
                ...t,
                isBillingStale: false,
                billingSyncedAt: syncedAt ?? t.billingSyncedAt,
                subscriptionStatus: displayStatus,
                admin: {
                  ...t.admin,
                  currentPeriodEnd: currentPeriodEnd ?? t.admin.currentPeriodEnd,
                  subscription: {
                    status: rawStatus ?? t.admin.subscription?.status ?? "",
                    currentPeriodEnd:
                      currentPeriodEnd ?? t.admin.subscription?.currentPeriodEnd ?? "",
                    cancelAtPeriodEnd,
                  },
                },
              };
            }),
          );
        },
        () => {
          // Listener error (e.g. permission-denied for a non-MFA superadmin):
          // drop the skeleton and keep the initial server-derived value.
          clearStaleFlag(tenantId);
        },
      );

      unsubs.push(unsub);
    }

    return () => {
      unsubs.forEach((u) => u());
      timeouts.forEach((t) => clearTimeout(t));
    };
    // Recompute only when the set of tenant IDs with stale billing changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantsData.filter((t) => t.isBillingStale).map((t) => t.tenant.id).join(",")]);

  const goNext = React.useCallback(() => {
    if (!nextCursor) return;
    setCursorStack((s) => [...s, currentCursor ?? ""]);
    setCurrentCursor(nextCursor);
  }, [nextCursor, currentCursor]);

  const goPrev = React.useCallback(() => {
    setCursorStack((s) => {
      const newStack = [...s];
      const prev = newStack.pop() ?? null;
      setCurrentCursor(prev);
      return newStack;
    });
  }, []);

  const handleSave = async (data: TenantFormData) => {
    setIsSaving(true);
    try {
      if (editingData) {
        // Update tenant
        await TenantService.updateTenant(editingData.tenant.id, {
          name: data.name,
          primaryColor: data.color,
          logoUrl: data.logoUrl,
          niche: data.niche,
          whatsappEnabled: data.whatsappEnabled,
        });

        // Update admin user plan if changed, then recompute plan-gated features.
        if (data.planId && data.planId !== editingData.planId) {
          await AdminService.updateUserPlan(editingData.admin.id, data.planId);
          // Recompute ensures the plan-computed whatsappEnabled value wins over
          // whatever the toggle wrote — important for enterprise → WhatsApp grant.
          try {
            await AdminService.recomputeFeatures(editingData.tenant.id);
          } catch {
            // Non-fatal — the plan was still updated, recompute can be done manually
          }
        }

        // Update admin credentials if provided
        if (data.email || data.password || data.phoneNumber !== undefined) {
          await AdminService.updateAdminCredentials({
            userId: editingData.admin.id,
            tenantId: editingData.tenant.id,
            email: data.email || undefined,
            password: data.password || undefined,
            phoneNumber: data.phoneNumber || undefined,
          });
        }

        if (data.planId !== "free") {
          await AdminService.updateUserSubscription(editingData.admin.id, {
            subscriptionStatus: data.subscriptionStatus,
            currentPeriodEnd: data.currentPeriodEnd,
            isManualSubscription: true,
          });
        } else {
          // If switching to free, clear subscription? user might want to keep history.
          // But usually free = no sub.
          await AdminService.updateUserSubscription(editingData.admin.id, {
            subscriptionStatus: "active", // Free is always active
            // currentPeriodEnd: null, // Firestore update doesn't support null directly often without FieldValue.delete()
            isManualSubscription: false,
          });
        }

        toast.success("Empresa atualizada com sucesso!");
      } else {
        if (data.password && data.password.length < 6) {
          toast.error("A senha deve ter pelo menos 6 caracteres.");
          setIsSaving(false);
          return;
        }

        await AdminService.createTenant({
          name: data.name,
          slug: data.name
            .toLowerCase()
            .replace(/ /g, "-")
            .replace(/[^\w-]+/g, ""),
          primaryColor: data.color,
          logoUrl: data.logoUrl,
          niche: data.niche,
          whatsappEnabled: data.whatsappEnabled,
          adminName: data.userName,
          adminEmail: data.email!,
          adminPassword: data.password!,
          adminPhoneNumber: data.phoneNumber,
          planId: data.planId || "free",
          subscriptionStatus: data.subscriptionStatus,
          currentPeriodEnd: data.currentPeriodEnd,
        });

        toast.success(`Empresa "${data.name}" e usuário admin criados!`);
      }

      setIsDialogOpen(false);
      loadTenants(currentCursor);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar empresa");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await AdminService.deleteTenant(id);
      toast.success("Empresa removida com sucesso!");
      loadTenants(currentCursor);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao remover empresa");
      throw error; // Re-throw para o componente saber que falhou
    }
  };

  const openCreate = () => {
    setEditingData(null);
    setIsDialogOpen(true);
  };

  const openEdit = (data: TenantBillingInfo) => {
    setEditingData(data);
    setIsDialogOpen(true);
  };

  const handleRecompute = async (tenantId: string) => {
    setIsRecomputing(true);
    try {
      await AdminService.recomputeFeatures(tenantId);
      toast.success("Features recomputadas com sucesso!");
      loadTenants(currentCursor);
    } catch {
      toast.error("Erro ao recomputar features");
    } finally {
      setIsRecomputing(false);
    }
  };

  const handleLoginAs = (tenant: Tenant) => {
    setViewingTenant(tenant);
    toast.info(`Acessando painel de "${tenant.name}"...`);
    React.startTransition(() => {
      router.push("/dashboard");
    });
  };

  const filteredTenants = tenantsData.filter((item) =>
    item.tenant.name.toLowerCase().includes(search.toLowerCase()),
  );

  return {
    tenantsData,
    search,
    setSearch,
    isDialogOpen,
    setIsDialogOpen,
    editingData,
    filteredTenants,
    openCreate,
    openEdit,
    handleSave,
    handleDelete,
    handleLoginAs,
    handleRecompute,
    isLoading,
    isSaving,
    isRecomputing,
    hasMore,
    cursorStack,
    goNext,
    goPrev,
  };
}
