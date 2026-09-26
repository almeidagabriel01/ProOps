"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, Plus, Target } from "lucide-react";
import { KanbanBoard, type KanbanColumn } from "@/components/features/kanban/kanban-board";
import { KanbanBoardSkeleton } from "@/app/crm/_components/kanban-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/providers/tenant-provider";
import { usePagePermission } from "@/hooks/usePagePermission";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";
import { LeadsService, type Lead, type LeadStage } from "@/services/leads-service";
import {
  LEAD_SOURCE_LABELS,
  LEAD_STAGES,
  groupLeadsByStage,
  nextActionState,
  openPipelineValue,
  todayInBrazil,
} from "../_lib/leads";
import { LeadFormDialog } from "./lead-form-dialog";
import { LeadDetailSheet } from "./lead-detail-sheet";

const NEXT_ACTION_TONE = {
  overdue: "text-red-600 dark:text-red-400",
  today: "text-amber-600 dark:text-amber-400",
  upcoming: "text-muted-foreground",
} as const;

function LeadCard({ lead, today }: { lead: Lead; today: string }) {
  const state = nextActionState(lead, today);
  return (
    <div className="space-y-1.5 rounded-lg border bg-card p-3 text-sm shadow-sm">
      <p className="font-medium break-words">{lead.name}</p>
      {lead.company && <p className="text-xs text-muted-foreground break-words">{lead.company}</p>}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{LEAD_SOURCE_LABELS[lead.source]}</span>
        {lead.estimatedValue != null && (
          <span className="font-medium text-foreground">{formatCurrency(lead.estimatedValue)}</span>
        )}
      </div>
      {state && (
        <p className={cn("flex items-center gap-1 text-xs", NEXT_ACTION_TONE[state])}>
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {state === "overdue" ? "Atrasada: " : state === "today" ? "Hoje: " : ""}
            {lead.nextAction || "Próxima ação"}
          </span>
        </p>
      )}
    </div>
  );
}

/** Funil de leads: a oportunidade antes da proposta, em etapas fixas. */
export function LeadsTab() {
  const { tenant, isReadOnly } = useTenant();
  const { canCreate, canEdit, canDelete } = usePagePermission("kanban");
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadFromUrl = searchParams.get("lead");

  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Lead | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(leadFromUrl);
  const [pendingConvert, setPendingConvert] = React.useState<Lead | null>(null);
  const [converting, setConverting] = React.useState(false);
  const today = React.useMemo(() => todayInBrazil(), []);

  const writable = !isReadOnly;
  const tenantId = tenant?.id;

  React.useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    setLoading(true);
    LeadsService.list(tenantId)
      .then((list) => {
        if (!cancelled) setLeads(list);
      })
      .catch(() => {
        if (!cancelled) toast.error("Erro ao carregar os leads.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  React.useEffect(() => {
    if (leadFromUrl) setSelectedId(leadFromUrl);
  }, [leadFromUrl]);

  const upsert = React.useCallback((lead: Lead) => {
    setLeads((prev) =>
      prev.some((l) => l.id === lead.id)
        ? prev.map((l) => (l.id === lead.id ? { ...l, ...lead } : l))
        : [lead, ...prev],
    );
  }, []);

  const columns: KanbanColumn<Lead>[] = React.useMemo(() => {
    const groups = groupLeadsByStage(leads);
    return LEAD_STAGES.map((stage) => ({
      id: stage.id,
      label: stage.label,
      color: stage.color,
      items: groups[stage.id],
    }));
  }, [leads]);

  const handleDragEnd = React.useCallback(
    async (itemId: string, from: string, to: string) => {
      if (from === to) return;
      const lead = leads.find((l) => l.id === itemId);
      if (!lead) return;
      // Convertido só pela conversão, que cria o contato.
      if (to === "convertido") {
        setPendingConvert(lead);
        return;
      }
      const previous = lead.stage;
      upsert({ ...lead, stage: to as LeadStage });
      try {
        await LeadsService.update(lead.id, { stage: to as LeadStage });
      } catch (error) {
        upsert({ ...lead, stage: previous });
        toast.error(error instanceof Error ? error.message : "Erro ao mover o lead.");
      }
    },
    [leads, upsert],
  );

  const selected = leads.find((l) => l.id === selectedId) ?? null;
  const openCount = leads.filter((l) => l.stage !== "convertido" && l.stage !== "perdido").length;

  if (loading) return <KanbanBoardSkeleton />;

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {openCount} {openCount === 1 ? "lead aberto" : "leads abertos"}
          {openCount > 0 ? `, ${formatCurrency(openPipelineValue(leads))} em negociação` : ""}
        </p>
        {writable && canCreate && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo lead
          </Button>
        )}
      </div>

      {leads.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nenhum lead ainda"
          description="Registre quem pediu orçamento antes da proposta: origem, valor estimado e a próxima ação com data. No dia, o sino avisa."
          action={
            writable && canCreate ? (
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo lead
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex-1">
          <KanbanBoard<Lead>
            columns={columns}
            onDragEnd={handleDragEnd}
            renderCard={(lead) => <LeadCard lead={lead} today={today} />}
            getItemId={(lead) => lead.id}
            onCardClick={(lead) => setSelectedId(lead.id)}
            isDragEnabled={writable && canEdit}
            emptyMessage="Nenhum lead"
          />
        </div>
      )}

      <LeadFormDialog
        open={formOpen}
        lead={editing}
        onOpenChange={setFormOpen}
        onSaved={upsert}
      />

      {selected && (
        <LeadDetailSheet
          lead={selected}
          canEdit={writable && canEdit}
          canDelete={writable && canDelete}
          onClose={() => setSelectedId(null)}
          onEdit={(lead) => {
            setEditing(lead);
            setFormOpen(true);
          }}
          onChanged={upsert}
          onDeleted={(id) => {
            setLeads((prev) => prev.filter((l) => l.id !== id));
            setSelectedId(null);
          }}
        />
      )}

      <ConfirmDialog
        open={pendingConvert !== null}
        onOpenChange={(open) => !open && setPendingConvert(null)}
        title="Converter o lead?"
        description={
          pendingConvert
            ? `${pendingConvert.name} vira um contato e você segue para montar a proposta.`
            : ""
        }
        confirmLabel="Converter"
        pendingLabel="Convertendo..."
        isPending={converting}
        onConfirm={async () => {
          if (!pendingConvert) return;
          setConverting(true);
          try {
            const { clientId } = await LeadsService.convert(pendingConvert.id);
            upsert({ ...pendingConvert, stage: "convertido", clientId });
            setPendingConvert(null);
            toast.success("Lead convertido em contato. Monte a proposta.");
            router.push(`/proposals/new?clientId=${encodeURIComponent(clientId)}`);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erro ao converter o lead.");
          } finally {
            setConverting(false);
          }
        }}
      />
    </div>
  );
}
