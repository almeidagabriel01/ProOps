"use client";

import * as React from "react";
import { History } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Loader } from "@/components/ui/loader";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "@/lib/toast";
import { MEMBER_AUDIT_LABELS, memberAuditLabel } from "@/lib/team/member-audit-labels";
import { MemberAccessService, type MemberAuditEntry, type MemberAuditFilters } from "@/services/member-access-service";

interface MemberAuditPanelProps {
  /** Para filtrar por pessoa: a equipe (o dono entra pelo próprio nome). */
  people: Array<{ id: string; name: string }>;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

/** O detalhe curto de uma linha: a permissão mudada, o valor ajustado, a quantidade do lote. */
function describeDetails(entry: MemberAuditEntry): string | null {
  const d = entry.details;
  if (!d) return null;
  if (entry.action === "member_permissions_changed" && d.page) {
    return `${d.page}.${d.key}: ${d.before ?? "padrão"} para ${d.after}`;
  }
  if (typeof d.count === "number") return `${d.count} de uma vez`;
  if (typeof d.amount === "number") {
    return d.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (typeof d.reason === "string") return d.reason;
  return null;
}

/**
 * Histórico de ações da equipe (aba de /settings/team): quem aprovou, deu
 * baixa, estornou, ajustou saldo, cancelou nota, mudou permissão, suspendeu.
 * Só o dono e os administradores leem; a API recusa os demais.
 */
export function MemberAuditPanel({ people }: MemberAuditPanelProps) {
  const [filters, setFilters] = React.useState<MemberAuditFilters>({});
  const [entries, setEntries] = React.useState<MemberAuditEntry[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setEntries(null);
    MemberAccessService.listAudit(filters)
      .then((list) => {
        if (!cancelled) setEntries(list);
      })
      .catch(() => {
        if (cancelled) return;
        setEntries([]);
        toast.error("Não foi possível carregar o histórico.");
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const set = (key: keyof MemberAuditFilters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="audit-member">Pessoa</Label>
          <Select id="audit-member" value={filters.memberUid ?? ""} onChange={(e) => set("memberUid", e.target.value)}>
            <option value="">Toda a equipe</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-action">Ação</Label>
          <Select id="audit-action" value={filters.action ?? ""} onChange={(e) => set("action", e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(MEMBER_AUDIT_LABELS).map(([action, label]) => (
              <option key={action} value={action}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-from">De</Label>
          <DatePicker id="audit-from" value={filters.from ?? ""} onChange={(e) => set("from", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-to">Até</Label>
          <DatePicker id="audit-to" value={filters.to ?? ""} onChange={(e) => set("to", e.target.value)} />
        </div>
      </div>

      {entries === null ? (
        <div className="flex justify-center py-10">
          <Loader size="md" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nada no histórico"
          description="As ações da equipe (aprovar, dar baixa, estornar, mudar permissão...) aparecem aqui. O histórico guarda um ano."
        />
      ) : (
        <ul className="divide-y rounded-xl border" aria-label="Histórico da equipe">
          {entries.map((entry) => {
            const detail = describeDetails(entry);
            return (
              <li key={entry.id} className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p>
                    <span className="font-medium">{entry.actorName || "Alguém da equipe"}</span>{" "}
                    <span className="text-muted-foreground">{memberAuditLabel(entry.action).toLowerCase()}</span>
                  </p>
                  {(entry.targetLabel || detail) && (
                    <p className="truncate text-xs text-muted-foreground">
                      {[entry.targetLabel, detail].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <time className="shrink-0 text-xs text-muted-foreground tabular-nums" dateTime={entry.createdAt ?? undefined}>
                  {formatWhen(entry.createdAt)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
