"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Download, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditLimitsDialog } from "@/components/admin/edit-limits-dialog";
import { useTenantsData } from "./_hooks/useTenantsData";
import { TenantsMetricsCards, TenantsTable, AdminOverviewSkeleton } from "./_components";
import { motion } from "motion/react";

export default function AdminOverviewPage() {
  const router = useRouter();
  const {
    isLoading,
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
  } = useTenantsData();

  if (isLoading) {
    return <AdminOverviewSkeleton />;
  }

  return (
    <div className="space-y-8 p-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin")}
            className="rounded-xl hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <LayoutDashboard className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Visão Geral
              </h1>
              <p className="text-sm text-muted-foreground">
                Monitoramento de empresas e recursos
              </p>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          className="shadow-sm hover:shadow transition-all"
        >
          <Download className="w-4 h-4 mr-2" />
          Exportar Relatório
        </Button>
      </motion.div>

      {/* Metrics Cards */}
      <TenantsMetricsCards metrics={metrics} />

      {/* Tenants Table */}
      <TenantsTable
        filteredData={filteredData}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
        onEditLimits={handleEditLimits}
      />

      <EditLimitsDialog
        open={editDialog.open}
        onClose={() => setEditDialog((prev) => ({ ...prev, open: false }))}
        tenantId={editDialog.tenantId}
        tenantName={editDialog.tenantName}
        currentFeatures={editDialog.features}
        onSaved={loadData}
      />
    </div >
  );
}
