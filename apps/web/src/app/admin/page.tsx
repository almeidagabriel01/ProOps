"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Search, Building2, CreditCard } from "lucide-react";
import { TenantDialog } from "@/components/admin/tenant-dialog";
import { useTenantManagement } from "./_hooks/useTenantManagement";
import { TenantCard, CopyDataDialog } from "./_components";
import { AdminSkeleton } from "./_components/admin-skeleton";
import { TenantBillingInfo, AdminService } from "@/services/admin-service";
import * as React from "react";
import { toast } from "@/lib/toast";

export default function AdminPage() {
  const router = useRouter();
  const {
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
    tenantsData,
  } = useTenantManagement();

  const [isCopyDialogOpen, setIsCopyDialogOpen] = React.useState(false);
  const [copySourceTenant, setCopySourceTenant] = React.useState<TenantBillingInfo | null>(null);
  const [isCopying, setIsCopying] = React.useState(false);

  const handleOpenCopyModal = (tenant: TenantBillingInfo) => {
    setCopySourceTenant(tenant);
    setIsCopyDialogOpen(true);
  };

  const handleConfirmCopy = async (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId) return;
    setIsCopying(true);
    try {
      const response = await AdminService.copyTenantData(sourceId, targetId);
      toast.success(response.message || `Cópia concluída com sucesso!`);
      setIsCopyDialogOpen(false);
    } catch (error: unknown) {
      console.error("Copy data failed:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao copiar dados");
    } finally {
      setIsCopying(false);
    }
  };

  if (isLoading) {
    return <AdminSkeleton />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="w-8 h-8 text-primary" />
            Painel Super Admin
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie múltiplos inquilinos (Tenants) em um só lugar.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push("/admin/overview")}
            className="shadow-sm hover:shadow transition-all"
          >
            <CreditCard className="w-5 h-5 mr-2" /> Visão Geral
          </Button>
          <Button
            onClick={openCreate}
            size="lg"
            className="shadow-lg hover:shadow-xl transition-all"
          >
            <Plus className="w-5 h-5 mr-2" /> Nova Empresa
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar empresas..."
          className="pl-10 h-10 bg-muted/50"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredTenants.map((item) => (
          <TenantCard
            key={item.tenant.id}
            item={item}
            onEdit={openEdit}
            onDelete={handleDelete}
            onLoginAs={handleLoginAs}
            onCopy={handleOpenCopyModal}
          />
        ))}

        {filteredTenants.length === 0 && (
          <div className="col-span-full py-20 text-center flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/20">
            <Building2 className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg font-medium">Nenhuma empresa encontrada.</p>
            <p className="text-sm">
              Tente ajustar o filtro ou crie uma nova empresa.
            </p>
          </div>
        )}
      </div>

      <TenantDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        initialData={editingData}
        onSave={handleSave}
        isSaving={isSaving}
      />

      <CopyDataDialog
        isOpen={isCopyDialogOpen}
        onClose={() => setIsCopyDialogOpen(false)}
        sourceTenant={copySourceTenant}
        allTenants={tenantsData}
        onConfirm={handleConfirmCopy}
        isCopying={isCopying}
      />
    </div>
  );
}
