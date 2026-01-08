"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
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

  const { setViewingTenant } = useTenant();
  const router = useRouter();

  const loadTenants = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await AdminService.getAllTenantsBilling();
      setTenantsData(data);
    } catch (error) {
      console.error("Failed to load tenants", error);
      toast.error("Erro ao carregar empresas");
    } finally {
      setIsLoading(false);
    }
  }, []);

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
        });

        // Update admin user plan if changed
        if (data.planId && data.planId !== editingData.planId) {
          await AdminService.updateUserPlan(editingData.admin.id, data.planId);
        }

        // Update admin credentials if provided
        if (data.email || data.password) {
          await AdminService.updateAdminCredentials({
            userId: editingData.admin.id,
            tenantId: editingData.tenant.id,
            email: data.email || undefined,
            password: data.password || undefined,
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

        const newTenant = await TenantService.createTenant({
          name: data.name,
          primaryColor: data.color,
          logoUrl: data.logoUrl,
          niche: data.niche,
          slug: data.name
            .toLowerCase()
            .replace(/ /g, "-")
            .replace(/[^\w-]+/g, ""),
          createdAt: new Date().toISOString(),
        });

        if (data.email && data.password) {
          const { initializeApp, getApp, getApps, deleteApp } =
            await import("firebase/app");
          const { getAuth, createUserWithEmailAndPassword, signOut } =
            await import("firebase/auth");
          const { getFirestore, doc, setDoc } =
            await import("firebase/firestore");

          const config = {
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            messagingSenderId:
              process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
          };

          const secondaryAppName = "secondaryAppForUserCreation";
          let secondaryApp;
          if (getApps().some((app) => app.name === secondaryAppName)) {
            secondaryApp = getApp(secondaryAppName);
          } else {
            secondaryApp = initializeApp(config, secondaryAppName);
          }
          const secondaryAuth = getAuth(secondaryApp);
          const secondaryDb = getFirestore(secondaryApp);

          try {
            const userCredential = await createUserWithEmailAndPassword(
              secondaryAuth,
              data.email,
              data.password
            );
            const user = userCredential.user;
            await setDoc(doc(secondaryDb, "users", user.uid), {
              name: data.userName,
              email: data.email,
              role: "admin",
              tenantId: newTenant.id,
              planId: data.planId || "free",
              subscriptionStatus: data.subscriptionStatus,
              currentPeriodEnd: data.currentPeriodEnd,
              isManualSubscription: data.planId !== "free",
              createdAt: new Date().toISOString(),
            });
            await signOut(secondaryAuth);
            if (!getApps().every((app) => app.name !== secondaryAppName))
              await deleteApp(secondaryApp);
            toast.success(`Empresa "${data.name}" e usuário admin criados!`);
          } catch (e: unknown) {
            const error = e as Error;
            console.error(error);
            const errorMessage = error.message.includes("email-already-in-use")
              ? "Este email já está em uso."
              : error.message;
            toast.error(`Erro ao criar usuário: ${errorMessage}`);
            try {
              await signOut(secondaryAuth);
              if (!getApps().every((app) => app.name !== secondaryAppName))
                await deleteApp(secondaryApp);
            } catch {}
            setIsSaving(false);
            return;
          }
        } else {
          toast.success(`Empresa "${data.name}" criada!`);
        }
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
      await TenantService.deleteTenant(id);
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
    item.tenant.name.toLowerCase().includes(search.toLowerCase())
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
