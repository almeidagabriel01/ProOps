"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useAuth } from "@/providers/auth-provider";
import { ProposalKanbanTab } from "@/components/features/kanban/proposal-kanban-tab";
import { TransactionKanbanTab } from "@/components/features/kanban/transaction-kanban-tab";
import { SelectTenantState } from "@/components/shared/select-tenant-state";
import { LayoutDashboard, ReceiptText } from "lucide-react";
import KanbanSkeleton from "@/app/kanban/loading";

export default function KanbanPage() {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const { hasKanban, isLoading: isPlanLoading } = usePlanLimits();
  const [activeTab, setActiveTab] = React.useState("proposals");

  if (!user) return null;

  // Super admin tenant selector
  if (user.role === "superadmin" && !tenant) {
    return (
      <SelectTenantState title="Selecione uma empresa para ver o Kanban" />
    );
  }

  if (isPlanLoading) {
    return <KanbanSkeleton />;
  }

  if (!hasKanban && user.role !== "superadmin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <p className="text-lg font-medium text-foreground">Módulo Kanban</p>
          <p className="text-sm text-muted-foreground">
            Este módulo está disponível apenas no plano Enterprise.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-180px)]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Kanban
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visualize suas propostas e lançamentos em um quadro visual
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full space-y-6 flex-1 flex flex-col"
      >
        <TabsList className="w-fit bg-muted/50 p-1 rounded-xl h-auto">
          <TabsTrigger
            value="proposals"
            className="gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <LayoutDashboard className="w-4 h-4" />
            Propostas
          </TabsTrigger>
          <TabsTrigger
            value="transactions"
            className="gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <ReceiptText className="w-4 h-4" />
            Lançamentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="proposals" className="m-0 flex-1">
          <ProposalKanbanTab />
        </TabsContent>

        <TabsContent value="transactions" className="m-0 flex-1">
          <TransactionKanbanTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
