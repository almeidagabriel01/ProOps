"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileSignature, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { EmptyState } from "@/components/shared/empty-state";
import { SelectTenantState } from "@/components/shared/select-tenant-state";
import { PageViewSwitcher } from "@/components/layout/page-view-switcher";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePagePermission } from "@/hooks/usePagePermission";
import { useSensitiveData } from "@/hooks/usePermission";
import { useServiceContracts } from "@/hooks/useServiceContracts";
import { formatCurrency } from "@/utils/format";
import { filterContracts, monthlyRecurringRevenue, type ContractFilter } from "@/lib/field-service/contracts";
import { ServiceOrdersSkeleton } from "../service-orders/_components/service-orders-skeleton";
import { ContractCard } from "./_components/contract-card";

/** Contratos de manutenção: a receita que se repete todo mês. */
export default function ContractsPage() {
  const router = useRouter();
  const { tenant, isReadOnly } = useTenant();
  const { user } = useAuth();
  const { hasFieldService, isLoading: isPlanLoading } = usePlanLimits();
  const { canCreate } = usePagePermission("contracts");
  const { canSeeContractValues } = useSensitiveData();
  const allowed = hasFieldService || user?.role === "superadmin";
  const { contracts, loading, error } = useServiceContracts(tenant?.id, allowed);
  const [filter, setFilter] = React.useState<ContractFilter>("active");

  if (!user) return null;
  if (user.role === "superadmin" && !tenant) {
    return <SelectTenantState title="Selecione uma empresa para ver os contratos" />;
  }
  if (isPlanLoading) return <ServiceOrdersSkeleton />;
  if (!allowed) {
    return (
      <UpgradeRequired
        feature="Contratos"
        description="Cobre a mensalidade de monitoramento, manutenção ou suporte todo mês, sem lançar à mão, e deixe as visitas preventivas abrirem sozinhas. Incluído nos planos Pro e Enterprise, ou como add-on no Starter."
      />
    );
  }
  if (loading) return <ServiceOrdersSkeleton />;

  const visible = filterContracts(contracts, filter);
  const count = (f: ContractFilter) => filterContracts(contracts, f).length;
  const mrr = monthlyRecurringRevenue(contracts);
  // O contrato nasce com a mensalidade: quem não vê os valores não o cria.
  const canOpen = !isReadOnly && canCreate && canSeeContractValues;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Contratos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mrr > 0 && canSeeContractValues
              ? `${formatCurrency(mrr)} por mês em contratos ativos.`
              : "A mensalidade de cada cliente, lançada no financeiro todo mês."}
          </p>
          <PageViewSwitcher className="mt-3" />
        </div>
        {canOpen && (
          <Button onClick={() => router.push("/contracts/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Novo contrato
          </Button>
        )}
      </div>

      <SegmentedControl
        id="contracts-filter"
        value={filter}
        onChange={(v) => setFilter(v as ContractFilter)}
        options={[
          { value: "active", label: "Ativos", count: count("active") },
          { value: "draft", label: "Rascunhos", count: count("draft") },
          { value: "suspended", label: "Parados", count: count("suspended") },
          { value: "all", label: "Todos", count: contracts.length },
        ]}
      />

      {error ? (
        <EmptyState
          icon={FileSignature}
          title="Não foi possível carregar os contratos"
          description="Verifique a conexão e recarregue a página."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title={contracts.length === 0 ? "Nenhum contrato ainda" : "Nada neste filtro"}
          description={
            contracts.length === 0
              ? "Crie um contrato para cada cliente que paga todo mês, ou marque a linha como mensal na proposta: ao aprovar, o contrato nasce sozinho."
              : "Troque o filtro para ver os outros."
          }
          action={
            contracts.length === 0 && canOpen ? (
              <Button onClick={() => router.push("/contracts/new")}>
                <Plus className="mr-2 h-4 w-4" />
                Novo contrato
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((contract) => (
            <ContractCard key={contract.id} contract={contract} showValue={canSeeContractValues} />
          ))}
        </div>
      )}
    </div>
  );
}
