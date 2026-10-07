"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart2, Download, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenantsData } from "./_hooks/useTenantsData";
import { TenantModulesDialog } from "@/components/admin/tenant-modules-dialog";
import {
  TenantActivityDrawer,
  type ActivityTenantTarget,
} from "@/components/admin/activity/tenant-activity-drawer";
import type { TenantBillingInfo } from "@/services/admin-service";
import * as React from "react";
import {
  TenantsMetricsCards,
  TenantsTable,
  AdminOverviewSkeleton,
  SubscriptionSyncCard,
} from "./_components";
import { m as motion } from "motion/react";
import { PresenceRefresh } from "@/components/admin/presence/presence-refresh";
import { useOnlinePresence } from "@/hooks/use-online-presence";
import { withLivePresence } from "@/lib/presence-live";

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
  } = useTenantsData();
  const [modulesTarget, setModulesTarget] = React.useState<TenantBillingInfo | null>(null);
  const [activityTarget, setActivityTarget] = React.useState<ActivityTenantTarget | null>(null);
  const presence = useOnlinePresence();
  const tenants = React.useMemo(
    () => withLivePresence(filteredData, presence.data),
    [filteredData, presence.data],
  );

  if (isLoading) {
    return <AdminOverviewSkeleton />;
  }

  return (
    <div className="space-y-8 p-6 max-md:p-0">
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
              <h1 className="text-2xl font-bold tracking-tight">Visão Geral</h1>
              <p className="text-sm text-muted-foreground">
                Monitoramento de empresas e recursos
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PresenceRefresh
            updatedAt={presence.data?.now}
            isLoading={presence.isLoading}
            onRefresh={presence.reload}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/admin/analytics")}
            className="shadow-sm hover:shadow transition-all"
          >
            <BarChart2 className="w-4 h-4 mr-2" />
            Analytics
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="shadow-sm hover:shadow transition-all"
          >
            <Download className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </motion.div>

      {/* Metrics Cards */}
      <TenantsMetricsCards metrics={metrics} />

      {/* Stripe Subscription Sync */}
      <SubscriptionSyncCard />

      {/* Tenants Table */}
      <TenantsTable
        filteredData={tenants}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
        onManageModules={setModulesTarget}
        onViewActivity={(item) => setActivityTarget({ id: item.tenant.id, name: item.tenant.name })}
      />

      <TenantActivityDrawer tenant={activityTarget} onClose={() => setActivityTarget(null)} />

      <TenantModulesDialog
        tenantId={modulesTarget?.tenant.id ?? null}
        tenantName={modulesTarget?.tenant.name ?? ""}
        onClose={() => setModulesTarget(null)}
      />

    </div>
  );
}
