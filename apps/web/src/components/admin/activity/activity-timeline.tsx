"use client";

import * as React from "react";
import { AlertTriangle, MousePointerClick, Rocket, Zap, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import type { ActivityCategory } from "@/lib/activity/catalog";
import type { TenantActivityEvent } from "@/services/admin-service";
import { activityTime, describeActivity, groupActivityByDay } from "./activity-format";

const CATEGORY_ICONS: Record<ActivityCategory, LucideIcon> = {
  navigation: MousePointerClick,
  action: Zap,
  funnel: Rocket,
  error: AlertTriangle,
};

const CATEGORY_TONE: Record<ActivityCategory, string> = {
  navigation: "bg-muted text-muted-foreground",
  action: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  funnel: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  error: "bg-destructive/10 text-destructive",
};

interface ActivityTimelineProps {
  events: TenantActivityEvent[];
  isLoading: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  /** Mostra a empresa em cada linha (feed de todas as empresas). */
  tenantName?: (tenantId: string) => string;
  onTenantClick?: (tenantId: string) => void;
  emptyMessage?: string;
}

function actorLabel(event: TenantActivityEvent): string {
  const actor = event.actor;
  if (actor) return actor.name || actor.email || actor.uid;
  return event.uid ? "Usuário removido" : "Sistema";
}

export function ActivityTimeline({
  events,
  isLoading,
  isLoadingMore = false,
  hasMore = false,
  onLoadMore,
  tenantName,
  onTenantClick,
  emptyMessage = "Nenhuma atividade registrada.",
}: ActivityTimelineProps) {
  const groups = React.useMemo(() => groupActivityByDay(events), [events]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader size="md" />
      </div>
    );
  }

  if (events.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.key || "sem-data"} aria-label={group.label}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </h3>
          <ul className="divide-y rounded-lg border">
            {group.events.map((event) => {
              const category = (CATEGORY_ICONS[event.category] ? event.category : "navigation") as ActivityCategory;
              const Icon = CATEGORY_ICONS[category];
              const { title, detail } = describeActivity(event);
              return (
                <li
                  key={event.id}
                  data-category={category}
                  className={cn("flex gap-3 px-3 py-2.5", category === "error" && "bg-destructive/[0.03]")}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      CATEGORY_TONE[category],
                    )}
                    aria-hidden
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span
                        className={cn("text-sm font-medium break-words", category === "error" && "text-destructive")}
                      >
                        {title}
                      </span>
                      {event.isDemo && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                          Demo
                        </Badge>
                      )}
                    </div>
                    {detail && <p className="text-xs text-muted-foreground break-all">{detail}</p>}
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                      <span>{activityTime(event.createdAt)}</span>
                      <span aria-hidden>·</span>
                      <span className="truncate" title={event.actor?.email || event.uid || undefined}>
                        {actorLabel(event)}
                      </span>
                      {tenantName && event.tenantId && (
                        <>
                          <span aria-hidden>·</span>
                          {onTenantClick ? (
                            <button
                              type="button"
                              onClick={() => onTenantClick(event.tenantId as string)}
                              className="truncate font-medium text-foreground underline-offset-2 hover:underline"
                            >
                              {tenantName(event.tenantId)}
                            </button>
                          ) : (
                            <span className="truncate">{tenantName(event.tenantId)}</span>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {hasMore && onLoadMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onLoadMore} disabled={isLoadingMore}>
            {isLoadingMore && <Loader size="sm" variant="button" className="mr-2" />}
            Carregar mais
          </Button>
        </div>
      )}
    </div>
  );
}
