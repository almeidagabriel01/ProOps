"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
  editingTenant: Tenant | null;
  filteredTenants: TenantBillingInfo[];
  openCreate: () => void;
  openEdit: (tenant: Tenant) => void;
  handleSave: (data: TenantFormData) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  handleLoginAs: (tenant: Tenant) => void;
  isLoading: boolean;
}

export function useTenantManagement(): UseTenantManagementReturn {
  const [tenantsData, setTenantsData] = React.useState<TenantBillingInfo[]>([]);
  const [search, setSearch] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingTenant, setEditingTenant] = React.useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const { setViewingTenant } = useTenant();
  const router = useRouter();

  const loadTenants = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await AdminService.getAllTenantsBilling();
      setTenantsData(data);
    } catch (error) {
      console.error("Failed to load tenants", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const handleSave = async (data: TenantFormData) => {
    try {
      if (editingTenant) {
        await TenantService.updateTenant(editingTenant.id, {
          name: data.name,
          primaryColor: data.color,
          logoUrl: data.logoUrl,
          niche: data.niche,
        });
        alert("Empresa atualizada com sucesso!");
      } else {
        if (data.password && data.password.length < 6) {
          alert("A senha deve ter pelo menos 6 caracteres.");
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
              name: `Admin ${data.name}`,
              email: data.email,
              role: "admin",
              tenantId: newTenant.id,
              createdAt: new Date().toISOString(),
            });
            await signOut(secondaryAuth);
            if (!getApps().every((app) => app.name !== secondaryAppName))
              await deleteApp(secondaryApp);
            alert(`Empresa ${data.name} e usuário admin criada!`);
          } catch (e: unknown) {
            const error = e as Error;
            console.error(error);
            alert("Erro ao criar usuário (email em uso?): " + error.message);
            try {
              await signOut(secondaryAuth);
              if (!getApps().every((app) => app.name !== secondaryAppName))
                await deleteApp(secondaryApp);
            } catch {}
          }
        } else {
          alert(`Empresa ${data.name} criada!`);
        }
      }
      setIsDialogOpen(false);
      loadTenants();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar empresa");
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Tem certeza? Esta ação removerá a empresa e todos os seus dados."
      )
    )
      return;
    try {
      await TenantService.deleteTenant(id);
      loadTenants();
    } catch (error) {
      console.error(error);
      alert("Erro ao remover empresa");
    }
  };

  const openCreate = () => {
    setEditingTenant(null);
    setIsDialogOpen(true);
  };

  const openEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setIsDialogOpen(true);
  };

  const handleLoginAs = (tenant: Tenant) => {
    setViewingTenant(tenant);
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
    editingTenant,
    filteredTenants,
    openCreate,
    openEdit,
    handleSave,
    handleDelete,
    handleLoginAs,
    isLoading,
  };
}
