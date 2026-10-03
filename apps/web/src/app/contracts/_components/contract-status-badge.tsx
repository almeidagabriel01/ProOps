import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_STYLES } from "@/lib/field-service/contracts";
import type { ContractStatus } from "@/types/field-service";

export function ContractStatusBadge({ status, className }: { status: ContractStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("h-auto px-2 py-0.5 text-xs", CONTRACT_STATUS_STYLES[status], className)}>
      {CONTRACT_STATUS_LABELS[status]}
    </Badge>
  );
}
