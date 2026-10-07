"use client";

import * as React from "react";
import { Radio, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { Skeleton } from "@/components/ui/skeleton";
import { PresenceDot, PresenceIndicator } from "@/components/admin/presence/presence-indicator";
import {
  TenantActivityDrawer,
  type ActivityTenantTarget,
} from "@/components/admin/activity/tenant-activity-drawer";
import { useOnlinePresence } from "@/hooks/use-online-presence";
import { formatPresenceTime } from "@/lib/presence-format";
import type { PresencePerson, TenantPresenceEntry } from "@/services/admin-service";

const ROLE_LABELS: Record<string, string> = {
  master: "Dono",
  admin: "Administrador",
  member: "Membro",
  free: "Conta gratuita",
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role.toLowerCase()] ?? role;
}

function PersonRow({ person }: { person: PresencePerson }) {
  return (
    <li className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {person.name || person.email || "Sem nome"}
          {person.role && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">{roleLabel(person.role)}</span>
          )}
        </p>
        {person.name && person.email && (
          <p className="truncate text-xs text-muted-foreground">{person.email}</p>
        )}
      </div>
      <PresenceIndicator presence={person} className="shrink-0 text-xs" />
    </li>
  );
}

function TenantPresenceCard({
  entry,
  onOpenActivity,
}: {
  entry: TenantPresenceEntry;
  onOpenActivity: (tenant: ActivityTenantTarget) => void;
}) {
  const online = entry.people.filter((p) => p.status === "online").length;
  const away = entry.people.filter((p) => p.status === "away").length;
  return (
    <Card data-testid="presence-tenant" data-status={entry.status}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <button
            type="button"
            onClick={() => onOpenActivity({ id: entry.tenantId, name: entry.tenantName })}
            className="flex min-w-0 items-center gap-2 text-left font-semibold text-foreground hover:underline"
            title="Ver a atividade da empresa"
          >
            <PresenceDot status={entry.status} />
            <span className="truncate">{entry.tenantName}</span>
          </button>
          <span className="text-xs text-muted-foreground">
            {[online && `${online} online`, away && `${away} ausente${away > 1 ? "s" : ""}`]
              .filter(Boolean)
              .join(", ") || "Ninguém agora"}
          </span>
        </div>
        <PresenceIndicator presence={entry} className="mt-1 text-xs" />
        <ul className="mt-2 divide-y divide-border/60">
          {entry.people.map((person) => (
            <PersonRow key={person.uid} person={person} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * Quem está usando o ERP agora, por empresa e por pessoa, e quem passou por
 * ele hoje e já saiu (entrou 10:15, saiu 10:20, ficou 5 min). Cada sessão
 * encerrada também entra na Atividade da empresa.
 */
export default function AdminOnlinePage() {
  const { data, isLoading, error, reload } = useOnlinePresence();
  const [drawerTenant, setDrawerTenant] = React.useState<ActivityTenantTarget | null>(null);

  const tenants = data?.tenants ?? [];
  const now = tenants.filter((t) => t.status !== "offline");
  const earlier = tenants.filter((t) => t.status === "offline");
  const people = tenants.flatMap((t) => t.people);
  const onlineCount = people.filter((p) => p.status === "online").length;
  const awayCount = people.filter((p) => p.status === "away").length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 md:p-6 max-md:p-0">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Radio className="w-6 h-6 text-primary" />
          Online
        </h1>
        <p className="text-sm text-muted-foreground">
          Quem está usando o ERP agora e quem passou por ele hoje. Online é quem está com a
          plataforma aberta e mexendo; ausente é quem deixou aberta sem mexer há 5 minutos ou
          em outra aba; quem fecha sai em até 3 minutos. Atualiza sozinha a cada 30 segundos.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-6" data-testid="presence-summary">
          <div>
            <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{onlineCount}</p>
            <p className="text-xs text-muted-foreground">online</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400">{awayCount}</p>
            <p className="text-xs text-muted-foreground">ausentes</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-foreground">{tenants.length}</p>
            <p className="text-xs text-muted-foreground">empresas hoje</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {data?.now && (
            <span className="text-xs text-muted-foreground">
              Atualizado às {formatPresenceTime(data.now)}
            </span>
          )}
          <Button variant="outline" onClick={reload} disabled={isLoading}>
            {isLoading ? (
              <Loader size="sm" variant="button" className="mr-2" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Atualizar
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading && !data ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Agora
            </h2>
            {now.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Ninguém está usando o ERP neste momento.
                </CardContent>
              </Card>
            ) : (
              now.map((entry) => (
                <TenantPresenceCard key={entry.tenantId} entry={entry} onOpenActivity={setDrawerTenant} />
              ))
            )}
          </section>

          {earlier.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Passaram hoje e já saíram
              </h2>
              {earlier.map((entry) => (
                <TenantPresenceCard key={entry.tenantId} entry={entry} onOpenActivity={setDrawerTenant} />
              ))}
            </section>
          )}
        </>
      )}

      <TenantActivityDrawer tenant={drawerTenant} onClose={() => setDrawerTenant(null)} />
    </div>
  );
}
