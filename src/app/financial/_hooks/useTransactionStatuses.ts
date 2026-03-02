import * as React from "react";
import { Check, Clock, AlertTriangle } from "lucide-react";
import { TransactionStatus } from "@/services/transaction-service";
import { useTenant } from "@/providers/tenant-provider";
import { TenantService } from "@/services/tenant-service";
import { toast } from "@/lib/toast";

export interface StatusOption {
  value: TransactionStatus;
  id: TransactionStatus;
  label: string;
  icon: typeof Check;
  color: string;
}

const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
  {
    value: "pending",
    id: "pending",
    label: "Pendente",
    icon: Clock,
    color: "#f59e0b",
  },
  {
    value: "overdue",
    id: "overdue",
    label: "Atrasado",
    icon: AlertTriangle,
    color: "#ef4444",
  },
  { value: "paid", id: "paid", label: "Pago", icon: Check, color: "#22c55e" },
];

export function useTransactionStatuses() {
  const { tenant } = useTenant();
  const [statuses, setStatuses] = React.useState<StatusOption[]>(
    DEFAULT_STATUS_OPTIONS,
  );
  const [isLoaded, setIsLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!tenant) {
      setStatuses(DEFAULT_STATUS_OPTIONS);
      setIsLoaded(true);
      return;
    }

    const tenantOrder = tenant.transactionStatusOrder;

    if (
      Array.isArray(tenantOrder) &&
      tenantOrder.length === DEFAULT_STATUS_OPTIONS.length
    ) {
      const reordered = tenantOrder
        .map((id) => DEFAULT_STATUS_OPTIONS.find((opt) => opt.id === id))
        .filter(Boolean) as StatusOption[];

      if (reordered.length === DEFAULT_STATUS_OPTIONS.length) {
        setStatuses(reordered);
        setIsLoaded(true);
        return;
      }
    }

    setStatuses(DEFAULT_STATUS_OPTIONS);
    setIsLoaded(true);
  }, [tenant?.transactionStatusOrder]);

  const reorderStatuses = React.useCallback(
    async (orderedIds: string[]) => {
      if (!tenant?.id) return;

      const reorderedOptions = orderedIds
        .map((id) => statuses.find((s) => s.id === id)!)
        .filter(Boolean);

      // Optimistic update
      setStatuses(reorderedOptions);

      try {
        await TenantService.updateTenant(tenant.id, {
          transactionStatusOrder: orderedIds,
        });
      } catch (e) {
        console.error("Failed to save transaction status order", e);
        toast.error("Erro ao salvar a ordem das colunas no servidor.");

        // Revert to tenant's server-state on error
        const rollbackOrder =
          tenant.transactionStatusOrder ||
          DEFAULT_STATUS_OPTIONS.map((o) => o.id);
        const rollbackOptions = rollbackOrder
          .map((id) => DEFAULT_STATUS_OPTIONS.find((s) => s.id === id)!)
          .filter(Boolean);

        setStatuses(rollbackOptions);
      }
    },
    [statuses, tenant],
  );

  return {
    statuses,
    isLoaded,
    reorderStatuses,
  };
}
