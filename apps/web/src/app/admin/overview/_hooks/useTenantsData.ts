"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AdminService, TenantBillingInfo } from "@/services/admin-service";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "@/lib/toast";

interface TenantsMetrics {
  totalTenants: number;
  totalUsers: number;
  totalProducts: number;
  totalClients: number;
  totalProposals: number;
  activeTenants: number;
}

interface UseTenantsDataReturn {
  isLoading: boolean;
  tenantsData: TenantBillingInfo[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  filteredData: TenantBillingInfo[];
  metrics: TenantsMetrics;
  loadData: () => Promise<void>;
}

export function useTenantsData(): UseTenantsDataReturn {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(true);
  const [tenantsData, setTenantsData] = React.useState<TenantBillingInfo[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState<string>("all");

  const loadData = React.useCallback(async () => {
    if (!user) return;
    if (user.role !== "superadmin") {
      router.push("/dashboard");
      return;
    }

    try {
      const data = await AdminService.getAllTenantsBilling();
      setTenantsData(data);
    } catch (error) {
      console.error("Failed to load admin data:", error);
      // Sem aviso, a tela seguia com zeros e parecia uma base vazia.
      toast.error("Erro ao carregar as empresas. Recarregue a página.");
    } finally {
      setIsLoading(false);
    }
  }, [user, router]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const metrics = React.useMemo<TenantsMetrics>(() => {
    const totalTenants = tenantsData.length;
    const totalUsers = tenantsData.reduce(
      (acc, curr) => acc + curr.usage.users,
      0
    );
    const totalProducts = tenantsData.reduce(
      (acc, curr) => acc + curr.usage.products,
      0
    );
    const totalClients = tenantsData.reduce(
      (acc, curr) => acc + curr.usage.clients,
      0
    );
    const totalProposals = tenantsData.reduce(
      (acc, curr) => acc + curr.usage.proposals,
      0
    );
    // "canceling" tenants are still paying through the end of the period, so
    // they count toward the active headline alongside "active".
    const activeTenants = tenantsData.filter(
      (t) =>
        t.subscriptionStatus === "active" ||
        t.subscriptionStatus === "canceling"
    ).length;

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

  return {
    isLoading,
    tenantsData,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    filteredData,
    metrics,
    loadData,
  };
}
