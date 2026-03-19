"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useAuth } from "@/providers/auth-provider";
import { ProposalKanbanTab } from "@/components/features/kanban/proposal-kanban-tab";
import { TransactionKanbanTab } from "@/components/features/kanban/transaction-kanban-tab";
import { SelectTenantState } from "@/components/shared/select-tenant-state";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { LayoutDashboard, ReceiptText } from "lucide-react";
import KanbanSkeleton from "@/app/crm/loading";

type KanbanTab = "proposals" | "transactions";

export default function KanbanPage() {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasKanban, isLoading: isPlanLoading } = usePlanLimits();

  const tabParam = searchParams.get("tab");
  const tabFromUrl: KanbanTab =
    tabParam === "transactions" ? "transactions" : "proposals";
  const [activeTab, setActiveTab] = React.useState<KanbanTab>(tabFromUrl);

  React.useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  const handleTabChange = React.useCallback(
    (tab: string) => {
      const nextTab = tab as KanbanTab;
      setActiveTab(nextTab);

      const params = new URLSearchParams(searchParams.toString());
      if (nextTab === "proposals") {
        params.delete("tab");
      } else {
        params.set("tab", "transactions");
      }

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

  if (isPlanLoading) {
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

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-180px)]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          CRM
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visualize suas propostas e lanÃ§amentos em um quadro visual
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
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
            LanÃ§amentos
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

