import Link from "next/link";
import { CalendarClock, MapPin, User, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";
import type { ServiceOrder } from "@/types/field-service";
import { PRIORITY_LABELS, TYPE_LABELS, formatWhen } from "@/lib/field-service/service-orders";
import { ServiceOrderStatusBadge } from "./status-badge";

/** Um chamado na lista: o que é, de quem, quando e com quem. */
export function ServiceOrderCard({ order }: { order: ServiceOrder }) {
  const when = formatWhen(order.scheduledStart);
  const urgent = order.priority === "urgent" || order.priority === "high";
  return (
    <Link href={`/service-orders/${order.id}`} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                {order.code} · {TYPE_LABELS[order.type]}
              </p>
              <h3 className="mt-0.5 truncate font-semibold text-foreground">{order.title}</h3>
            </div>
            <ServiceOrderStatusBadge status={order.status} className="shrink-0" />
          </div>
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <p className="flex items-center gap-2 truncate">
              <User className="h-4 w-4 shrink-0" />
              <span className="truncate">{order.clientName}</span>
            </p>
            {order.address && (
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{order.address}</span>
              </p>
            )}
            {when && (
              <p className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 shrink-0" />
                {when}
              </p>
            )}
            <p className="flex items-center gap-2 truncate">
              <Wrench className="h-4 w-4 shrink-0" />
              <span className="truncate">{order.technicianName ?? "Sem técnico"}</span>
            </p>
          </div>
          <div className="flex items-center justify-between gap-2 border-t pt-3 text-xs">
            <span className={cn("font-medium", urgent ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>
              Prioridade {PRIORITY_LABELS[order.priority].toLowerCase()}
            </span>
            {order.totals.total > 0 && (
              <span className="font-semibold text-foreground">{formatCurrency(order.totals.total)}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
