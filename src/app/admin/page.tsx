"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Search, Building2, CreditCard } from "lucide-react";
import { TenantDialog } from "@/components/admin/tenant-dialog";
import { useTenantManagement } from "./_hooks/useTenantManagement";
import { TenantCard } from "./_components";
import { AdminSkeleton } from "./_components/admin-skeleton";

export default function AdminPage() {
  const router = useRouter();
  const {
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
  } = useTenantManagement();

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
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push("/admin/billing")}
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
        initialData={editingTenant}
        onSave={handleSave}
      />
    </div>
  );
}
