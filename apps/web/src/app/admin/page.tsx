"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Search, Building2 } from "lucide-react";
import { TenantDialog } from "@/components/admin/tenant-dialog";
import { TenantModulesDialog } from "@/components/admin/tenant-modules-dialog";
import { useTenantManagement } from "./_hooks/useTenantManagement";
import { TenantCard, CopyDataDialog } from "./_components";
import { AdminSkeleton } from "./_components/admin-skeleton";
import { TenantBillingInfo, AdminService } from "@/services/admin-service";
import * as React from "react";
import { toast } from "@/lib/toast";
import { Loader } from "@/components/ui/loader";

export default function AdminPage() {
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
    handleDeactivate,
    handleReactivate,
    handlePurge,
    handleLoginAs,
    handleRecompute,
    isLoading,
    isSaving,
    isRecomputing,
    tenantIndex,
    isSearching,
    hasMore,
    cursorStack,
    goNext,
    goPrev,
  } = useTenantManagement();

  const [isCopyDialogOpen, setIsCopyDialogOpen] = React.useState(false);
  const [copySourceTenant, setCopySourceTenant] = React.useState<TenantBillingInfo | null>(null);
  const [isCopying, setIsCopying] = React.useState(false);
  const [modulesTarget, setModulesTarget] = React.useState<TenantBillingInfo | null>(null);

  const handleOpenCopyModal = (tenant: TenantBillingInfo) => {
    setCopySourceTenant(tenant);
    setIsCopyDialogOpen(true);
  };

  const handleConfirmCopy = async (sourceId: string, targetId: string, replace: boolean) => {
    if (!sourceId || !targetId) return;
    setIsCopying(true);
    try {
      const response = await AdminService.copyTenantData(sourceId, targetId, replace);
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="w-8 h-8 text-primary" />
            Painel Super Admin
          </h1>
          <p className="text-muted-foreground mt-1">
            Empresas cadastradas, planos, acesso e ciclo de vida.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
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
        {isSearching && (
          <Loader size="sm" className="absolute right-3 top-3" />
        )}
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredTenants.map((item) => (
          <TenantCard
            key={item.tenant.id}
            item={item}
            onEdit={openEdit}
            onDeactivate={handleDeactivate}
            onReactivate={handleReactivate}
            onPurge={handlePurge}
            onLoginAs={handleLoginAs}
            onCopy={handleOpenCopyModal}
            onManageModules={setModulesTarget}
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

      {/* Pagination */}
      {!search && (cursorStack.length > 0 || hasMore) && (
        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={goPrev}
            disabled={cursorStack.length === 0 || isLoading}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goNext}
            disabled={!hasMore || isLoading}
          >
            Próxima
          </Button>
        </div>
      )}

      <TenantDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        initialData={editingData}
        onSave={handleSave}
        onRecompute={editingData ? () => handleRecompute(editingData.tenant.id) : undefined}
        isSaving={isSaving}
        isRecomputing={isRecomputing}
      />

      <TenantModulesDialog
        tenantId={modulesTarget?.tenant.id ?? null}
        tenantName={modulesTarget?.tenant.name ?? ""}
        onClose={() => setModulesTarget(null)}
      />

      <CopyDataDialog
        isOpen={isCopyDialogOpen}
        onClose={() => setIsCopyDialogOpen(false)}
        sourceTenant={copySourceTenant}
        targets={tenantIndex
          .filter((t) => t.accountStatus === "active")
          .map((t) => ({ id: t.id, name: t.name }))}
        onConfirm={handleConfirmCopy}
        isCopying={isCopying}
      />
    </div>
  );
}
