"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from '@/lib/toast';
import { TenantService } from "@/services/tenant-service";
import { AdminService, TenantBillingInfo } from "@/services/admin-service";
import { Tenant } from "@/types";
import { useTenant } from "@/providers/tenant-provider";
import { TenantFormData } from "@/components/admin/tenant-dialog";

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
  isLoading: boolean;
  isSaving: boolean;
}

export function useTenantManagement(): UseTenantManagementReturn {
  const [tenantsData, setTenantsData] = React.useState<TenantBillingInfo[]>([]);
  const [search, setSearch] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingData, setEditingData] =
    React.useState<TenantBillingInfo | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  const { setViewingTenant, setGlobalLoading } = useTenant();
  const router = useRouter();

  const loadTenants = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setGlobalLoading(true);
      const data = await AdminService.getAllTenantsBilling();
      setTenantsData(data);
    } catch (error) {
      console.error("Failed to load tenants", error);
      toast.error("Erro ao carregar empresas");
    } finally {
      setIsLoading(false);
      setGlobalLoading(false);
    }
  }, [setGlobalLoading]);

  React.useEffect(() => {
    loadTenants();
  }, [loadTenants]);

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

        // Update admin user plan if changed
        if (data.planId && data.planId !== editingData.planId) {
          await AdminService.updateUserPlan(editingData.admin.id, data.planId);
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
      loadTenants();
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
      loadTenants();
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

  const handleLoginAs = (tenant: Tenant) => {
    setViewingTenant(tenant);
    toast.info(`Acessando painel de "${tenant.name}"...`);
    router.push("/dashboard");
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
    isLoading,
    isSaving,
  };
}

