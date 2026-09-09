"use client";

import { PageViewSwitcher } from "@/components/layout/page-view-switcher";
import * as React from "react";
import { ChevronLeft, ChevronRight, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { SelectTenantState } from "@/components/shared/select-tenant-state";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePagePermission } from "@/hooks/usePagePermission";
import { TransactionService } from "@/services/transaction-service";
import { toast } from "@/lib/toast";
import { formatCurrency } from "@/utils/format";
import {
  useCommissionsReport,
  currentMonthKey,
  formatMonthLabel,
} from "./_hooks/use-commissions-report";
import { CommissionsPartnerCard } from "./_components/commissions-partner-card";

/**
 * Relatório mensal de comissões: quanto a empresa deve a cada vendedor e a cada
 * arquiteto no mês.
 *
 * As comissões nascem da aprovação da proposta e espelham o cronograma de
 * pagamento do cliente, então esta tela não cria nada: ela lê o agregado e
 * deixa marcar cada parcela como paga, pelo mesmo endpoint de status que o
 * módulo de Lançamentos usa.
 */
export default function CommissionsPage() {
  const { tenant, isLoading: isTenantLoading } = useTenant();
  const { user } = useAuth();
  const { hasFinancial } = usePlanLimits();
  const { canEdit } = usePagePermission("transactions");
  const {
    month,
    report,
    isLoading,
    error,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    reload,
  } = useCommissionsReport();

  const [payingId, setPayingId] = React.useState<string | null>(null);

  const handleTogglePaid = async (transactionId: string, paid: boolean) => {
    setPayingId(transactionId);
    try {
      await TransactionService.updateTransaction(transactionId, {
        status: paid ? "paid" : "pending",
      });
      reload();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Não foi possível atualizar a comissão.",
      );
    } finally {
      setPayingId(null);
    }
  };

  if (!isTenantLoading && !tenant && user?.role === "superadmin") {
    return <SelectTenantState />;
  }

  if (!isTenantLoading && !hasFinancial) {
    return (
      <UpgradeRequired
        feature="Comissões"
        description="O relatório de comissões acompanha quanto você deve a cada vendedor e arquiteto, no mesmo cronograma em que o cliente paga. Faça upgrade para o plano Profissional ou adquira o módulo Financeiro para acessar."
      />
    );
  }

  const isCurrentMonth = month === currentMonthKey();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Comissões
          </h1>
          <p className="mt-1 text-muted-foreground">
            Quanto pagar a cada vendedor e arquiteto no mês
          </p>
          <PageViewSwitcher className="mt-3" />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={goToPreviousMonth}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-40 text-center font-medium">
            {formatMonthLabel(month)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={goToNextMonth}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrentMonth && (
            <Button type="button" variant="ghost" onClick={goToCurrentMonth}>
              Mês atual
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryTile
          label="A pagar"
          value={report?.aPagar ?? 0}
          isLoading={isLoading}
          emphasis
        />
        <SummaryTile
          label="Já pago"
          value={report?.pago ?? 0}
          isLoading={isLoading}
        />
        <SummaryTile
          label="Total do mês"
          value={report?.total ?? 0}
          isLoading={isLoading}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      )}

      {!isLoading && !error && report && report.partners.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <Handshake className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium">Nenhuma comissão neste mês</p>
          <p className="max-w-md text-sm text-muted-foreground">
            As comissões aparecem aqui quando uma proposta com vendedor ou
            arquiteto é aprovada. Elas seguem o mesmo cronograma de pagamento do
            cliente.
          </p>
        </div>
      )}

      {!isLoading && !error && report && report.partners.length > 0 && (
        <div className="space-y-3">
          {report.partners.map((partner) => (
            <CommissionsPartnerCard
              key={`${partner.contactId}-${partner.role ?? ""}`}
              partner={partner}
              canEdit={canEdit}
              payingId={payingId}
              onTogglePaid={handleTogglePaid}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  isLoading,
  emphasis = false,
}: {
  label: string;
  value: number;
  isLoading: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      {isLoading ? (
        <Skeleton className="mt-2 h-7 w-32" />
      ) : (
        <p
          className={`mt-1 font-mono text-2xl font-semibold ${
            emphasis ? "text-primary" : ""
          }`}
        >
          {formatCurrency(value)}
        </p>
      )}
    </div>
  );
}
