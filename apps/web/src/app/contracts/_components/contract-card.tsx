import Link from "next/link";
import { CalendarClock, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/utils/format";
import { CONTRACT_TYPE_LABELS, formatDay } from "@/lib/field-service/contracts";
import type { ServiceContract } from "@/types/field-service";
import { ContractStatusBadge } from "./contract-status-badge";

interface ContractCardProps {
  contract: ServiceContract;
  /** "Ver valores" de Contratos: sem ela, a mensalidade não aparece. */
  showValue?: boolean;
}

/** Um contrato na lista: de quem, quanto por mês e quando vence a próxima. */
export function ContractCard({ contract, showValue = true }: ContractCardProps) {
  return (
    <Link
      href={`/contracts/${contract.id}`}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                {contract.code} · {CONTRACT_TYPE_LABELS[contract.type]}
              </p>
              <h3 className="mt-0.5 truncate font-semibold text-foreground">{contract.title}</h3>
            </div>
            <ContractStatusBadge status={contract.status} className="shrink-0" />
          </div>
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <p className="flex items-center gap-2 truncate">
              <User className="h-4 w-4 shrink-0" />
              <span className="truncate">{contract.clientName}</span>
            </p>
            <p className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 shrink-0" />
              {contract.status === "active" && contract.nextBillingDate
                ? `Próximo vencimento ${formatDay(contract.nextBillingDate)}`
                : `Vence todo dia ${contract.billingDay}`}
            </p>
          </div>
          <div className="flex items-center justify-between gap-2 border-t pt-3 text-xs">
            <span className="text-muted-foreground">
              {contract.visitPlan.enabled ? "Com visitas preventivas" : "Sem visitas preventivas"}
            </span>
            {showValue && (
              <span className="text-sm font-semibold text-foreground">
                {formatCurrency(contract.monthlyAmount)}
                <span className="text-xs font-normal text-muted-foreground">/mês</span>
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
