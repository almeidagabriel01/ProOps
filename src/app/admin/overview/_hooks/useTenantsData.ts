"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AdminService, TenantBillingInfo } from "@/services/admin-service";
import { PlanService } from "@/services/plan-service";
import { useAuth } from "@/providers/auth-provider";
import { UserPlan, PlanFeatures } from "@/types";

interface TenantsMetrics {
  totalTenants: number;
  totalUsers: number;
  totalProducts: number;
  totalClients: number;
  totalProposals: number;
  activeTenants: number;
}

interface EditDialogState {
  open: boolean;
  tenantId: string;
  tenantName: string;
  features: PlanFeatures;
}

interface UseTenantsDataReturn {
  isLoading: boolean;
  tenantsData: TenantBillingInfo[];
  plans: UserPlan[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  filteredData: TenantBillingInfo[];
  metrics: TenantsMetrics;
  editDialog: EditDialogState;
  setEditDialog: React.Dispatch<React.SetStateAction<EditDialogState>>;
  handleEditLimits: (item: TenantBillingInfo) => void;
  loadData: () => Promise<void>;
}

export function useTenantsData(): UseTenantsDataReturn {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(true);
  const [tenantsData, setTenantsData] = React.useState<TenantBillingInfo[]>([]);
  const [plans, setPlans] = React.useState<UserPlan[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState<string>("all");

  const [editDialog, setEditDialog] = React.useState<EditDialogState>({
    open: false,
    tenantId: "",
    tenantName: "",
    features: {} as PlanFeatures,
  });

  const loadData = React.useCallback(async () => {
    if (!user) return;
    if (user.role !== "superadmin") {
      router.push("/dashboard");
      return;
    }

    try {
      const [data, plansList] = await Promise.all([
        AdminService.getAllTenantsBilling(),
        PlanService.getPlans(),
      ]);
      setTenantsData(data);
      setPlans(plansList);
    } catch (error) {
      console.error("Failed to load admin data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, router]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const metrics = React.useMemo<TenantsMetrics>(() => {
    const totalTenants = tenantsData.length;
    const totalUsers = tenantsData.reduce((acc, curr) => acc + curr.usage.users, 0);
    const totalProducts = tenantsData.reduce((acc, curr) => acc + curr.usage.products, 0);
    const totalClients = tenantsData.reduce((acc, curr) => acc + curr.usage.clients, 0);
    const totalProposals = tenantsData.reduce((acc, curr) => acc + curr.usage.proposals, 0);
    const activeTenants = tenantsData.filter((t) => t.subscriptionStatus === "active").length;

    return {
      totalTenants,
      totalUsers,
      totalProducts,
      totalClients,
      totalProposals,
      activeTenants,
    };
  }, [tenantsData]);

  const filteredData = React.useMemo(() => {
    return tenantsData.filter((item) => {
      const matchesSearch =
        item.tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.admin.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        filterStatus === "all" || item.subscriptionStatus === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [tenantsData, searchTerm, filterStatus]);

  const handleEditLimits = React.useCallback((item: TenantBillingInfo) => {
    if (!item.planFeatures) return;
    setEditDialog({
      open: true,
      tenantId: item.tenant.id,
      tenantName: item.tenant.name,
      features: item.planFeatures,
    });
  }, []);

  return {
    isLoading,
    tenantsData,
    plans,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    filteredData,
    metrics,
    editDialog,
    setEditDialog,
    handleEditLimits,
    loadData,
  };
}
