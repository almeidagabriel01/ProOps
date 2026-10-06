"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useAuth } from "@/providers/auth-provider";
import { ProposalKanbanTab } from "@/components/features/kanban/proposal-kanban-tab";
import { TransactionKanbanTab } from "@/components/features/kanban/transaction-kanban-tab";
import { SelectTenantState } from "@/components/shared/select-tenant-state";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { LayoutDashboard, Plus, ReceiptText, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePagePermission } from "@/hooks/usePagePermission";
import { LeadsTab } from "./_components/leads-tab";
import KanbanSkeleton from "@/app/crm/loading";
import {
  canShowCrmTransactionsTab,
  resolveCrmTab,
  type CrmTab as KanbanTab,
} from "@/lib/crm/crm-tabs";

export default function KanbanPage() {
  const { tenant, isReadOnly } = useTenant();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasKanban, hasFinancial, isLoading: isPlanLoading } = usePlanLimits();
  const { canCreate: canCreateLead } = usePagePermission("kanban");
  const transactionsPermission = usePagePermission("transactions");
  const showTransactionsTab = canShowCrmTransactionsTab({
    canViewTransactions: transactionsPermission.canView,
    hasFinancial,
  });
  const [newLeadSignal, setNewLeadSignal] = React.useState(0);

  const scopeParam = searchParams.get("scope");
  const lockedTab: KanbanTab | null =
    scopeParam === "transactions"
      ? "transactions"
      : scopeParam === "proposals"
        ? "proposals"
        : null;
  const tabParam = searchParams.get("tab");
  const tabFromUrl: KanbanTab =
    tabParam === "transactions"
      ? "transactions"
      : tabParam === "leads"
        ? "leads"
        : "proposals";
  const [activeTab, setActiveTab] = React.useState<KanbanTab>(
    lockedTab ?? tabFromUrl,
  );

  React.useEffect(() => {
    setActiveTab(lockedTab ?? tabFromUrl);
  }, [lockedTab, tabFromUrl]);

  const handleTabChange = React.useCallback(
    (tab: string) => {
      const nextTab = tab as KanbanTab;
      setActiveTab(nextTab);

      const params = new URLSearchParams(searchParams.toString());
      params.delete("scope");

      if (nextTab === "proposals") {
        params.delete("tab");
      } else {
        params.set("tab", nextTab);
      }
      if (nextTab !== "leads") params.delete("lead");

      const query = params.toString();
      router.replace(query ? `/crm?${query}` : "/crm", {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  if (!user) return null;

  if (user.role === "superadmin" && !tenant) {
    return <SelectTenantState title="Selecione uma empresa para ver o CRM" />;
  }

  if (isPlanLoading || transactionsPermission.isLoading) {
    return <KanbanSkeleton />;
  }

  if (!hasKanban && user.role !== "superadmin") {
    return (
      <UpgradeRequired
        feature="CRM"
        description="O módulo CRM pode ser contratado como add-on ou vem incluído no plano Enterprise."
      />
    );
  }

  const isScopedView = lockedTab !== null;
  const currentTab = resolveCrmTab(lockedTab ?? activeTab, showTransactionsTab);
  const visibleTab = resolveCrmTab(activeTab, showTransactionsTab);
  const description =
    currentTab === "transactions"
      ? "Visualize seus lançamentos em um quadro visual"
      : currentTab === "leads"
        ? "Acompanhe quem pediu contato até virar proposta"
        : "Visualize suas propostas em um quadro visual";

  return (
    <div className="space-y-6 flex flex-col md:h-[calc(100vh-180px)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            CRM
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        {!isScopedView && currentTab === "leads" && !isReadOnly && canCreateLead && (
          <Button onClick={() => setNewLeadSignal((n) => n + 1)} className="self-start md:self-auto">
            <Plus className="mr-2 h-4 w-4" />
            Novo lead
          </Button>
        )}
      </div>

      {isScopedView ? (
        <div className="flex-1">
          {currentTab === "transactions" ? (
            <TransactionKanbanTab />
          ) : (
            <ProposalKanbanTab />
          )}
        </div>
      ) : (
        <Tabs
          value={visibleTab}
          onValueChange={handleTabChange}
          className="w-full space-y-6 flex-1 flex flex-col"
        >
          {/* Na ordem da jornada: o lead vem antes da proposta. */}
          <TabsList className="w-fit bg-muted/50 p-1 rounded-xl h-auto">
            <TabsTrigger
              value="leads"
              className="gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Target className="w-4 h-4" />
              Leads
            </TabsTrigger>
            <TabsTrigger
              value="proposals"
              className="gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <LayoutDashboard className="w-4 h-4" />
              Propostas
            </TabsTrigger>
            {showTransactionsTab && (
              <TabsTrigger
                value="transactions"
                className="gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <ReceiptText className="w-4 h-4" />
                Lançamentos
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="proposals" className="m-0 flex-1">
            <ProposalKanbanTab />
          </TabsContent>

          <TabsContent value="leads" className="m-0 flex-1">
            <LeadsTab createSignal={newLeadSignal} />
          </TabsContent>

          {showTransactionsTab && (
            <TabsContent value="transactions" className="m-0 flex-1">
              <TransactionKanbanTab />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
