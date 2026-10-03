import { cn } from "@/lib/utils";
import type { ServiceOrderStatus } from "@/types/field-service";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/field-service/service-orders";

export function ServiceOrderStatusBadge({ status, className }: { status: ServiceOrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_TONES[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
