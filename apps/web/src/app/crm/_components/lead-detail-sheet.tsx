"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  Circle,
  Mail,
  Pencil,
  Phone,
  Trash2,
  UserCheck,
  XCircle,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TasksPanel } from "@/components/features/tasks/tasks-panel";
import { toast } from "@/lib/toast";
import { formatCurrency } from "@/utils/format";
import { useTenant } from "@/providers/tenant-provider";
import {
  ActivitiesService,
  LeadsService,
  type Activity,
  type ActivityType,
  type Lead,
} from "@/services/leads-service";
import {
  ACTIVITY_TYPE_LABELS,
  LEAD_SOURCE_LABELS,
  LEAD_STAGES,
  isLeadOpen,
} from "../_lib/leads";
import { Loader } from "@/components/ui/loader";

interface LeadDetailSheetProps {
  lead: Lead | null;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: (lead: Lead) => void;
  onChanged: (lead: Lead) => void;
  onDeleted: (leadId: string) => void;
}

function formatDay(day: string | null): string {
  if (!day) return "";
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

/** Ficha do lead: dados, próxima ação, atividades e a conversão em proposta. */
export function LeadDetailSheet({
  lead,
  canEdit,
  canDelete,
  onClose,
  onEdit,
  onChanged,
  onDeleted,
}: LeadDetailSheetProps) {
  const router = useRouter();
  const { tenant } = useTenant();
  const [activities, setActivities] = React.useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = React.useState(false);
  const [newType, setNewType] = React.useState<ActivityType>("ligacao");
  const [newTitle, setNewTitle] = React.useState("");
  const [newDueAt, setNewDueAt] = React.useState("");
  const [savingActivity, setSavingActivity] = React.useState(false);
  const [converting, setConverting] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const leadId = lead?.id;
  const tenantId = tenant?.id;

  React.useEffect(() => {
    if (!leadId || !tenantId) return;
    let cancelled = false;
    setLoadingActivities(true);
    setActivities([]);
    ActivitiesService.listByLead(tenantId, leadId)
      .then((list) => {
        if (!cancelled) setActivities(list);
      })
      .catch(() => {
        if (!cancelled) toast.error("Erro ao carregar as atividades.");
      })
      .finally(() => {
        if (!cancelled) setLoadingActivities(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId, tenantId]);

  if (!lead) return null;

  const stage = LEAD_STAGES.find((s) => s.id === lead.stage);
  const open = isLeadOpen(lead.stage);

  const handleAddActivity = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTitle.trim()) return;
    setSavingActivity(true);
    try {
      const created = await ActivitiesService.create({
        leadId: lead.id,
        type: newType,
        title: newTitle.trim(),
        dueAt: newDueAt || null,
      });
      setActivities((prev) => [created, ...prev]);
      setNewTitle("");
      setNewDueAt("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar a atividade.");
    } finally {
      setSavingActivity(false);
    }
  };

  const toggleDone = async (activity: Activity) => {
    try {
      const updated = await ActivitiesService.setDone(activity.id, !activity.doneAt);
      setActivities((prev) => prev.map((a) => (a.id === activity.id ? { ...a, ...updated } : a)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar a atividade.");
    }
  };

  const handleConvert = async () => {
    setConverting(true);
    try {
      const { clientId } = await LeadsService.convert(lead.id);
      onChanged({ ...lead, stage: "convertido", clientId });
      toast.success("Lead convertido em contato. Monte a proposta.");
      router.push(`/proposals/new?clientId=${encodeURIComponent(clientId)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao converter o lead.");
    } finally {
      setConverting(false);
    }
  };

  const handleMarkLost = async () => {
    try {
      const updated = await LeadsService.update(lead.id, { stage: "perdido" });
      onChanged(updated);
      toast.success("Lead marcado como perdido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar o lead.");
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await LeadsService.remove(lead.id);
      onDeleted(lead.id);
      setConfirmDelete(false);
      toast.success("Lead excluído.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir o lead.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="space-y-2 pr-8 text-left">
          <SheetTitle className="break-words">{lead.name}</SheetTitle>
          <div className="flex flex-wrap items-center gap-2">
            {stage && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: stage.color }}
              >
                {stage.label}
              </span>
            )}
            <Badge variant="outline">{LEAD_SOURCE_LABELS[lead.source]}</Badge>
            {lead.estimatedValue != null && (
              <Badge variant="secondary">{formatCurrency(lead.estimatedValue)}</Badge>
            )}
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <section className="space-y-2 text-sm">
            {lead.company && <p className="text-muted-foreground">{lead.company}</p>}
            {lead.phone && (
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {lead.phone}
              </p>
            )}
            {lead.email && (
              <p className="flex items-center gap-2 break-all">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                {lead.email}
              </p>
            )}
            {lead.nextAction || lead.nextActionAt ? (
              <p className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {lead.nextAction || "Próxima ação"}
                  {lead.nextActionAt ? `, ${formatDay(lead.nextActionAt)}` : ""}
                </span>
              </p>
            ) : null}
            {lead.notes && (
              <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-muted-foreground">
                {lead.notes}
              </p>
            )}
            {lead.ownerName && (
              <p className="text-xs text-muted-foreground">Responsável: {lead.ownerName}</p>
            )}
          </section>

          {canEdit && (
            <section className="flex flex-wrap gap-2">
              {open && (
                <Button size="sm" onClick={handleConvert} disabled={converting}>
                  {converting && <Loader size="sm" variant="button" className="mr-2" />}
                  <UserCheck className="mr-2 h-4 w-4" />
                  {converting ? "Convertendo..." : "Converter em proposta"}
                </Button>
              )}
              {!open && lead.clientId && (
                <Button
                  size="sm"
                  onClick={() => router.push(`/proposals/new?clientId=${encodeURIComponent(lead.clientId!)}`)}
                >
                  Nova proposta para o contato
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => onEdit(lead)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
              {open && (
                <Button size="sm" variant="outline" onClick={handleMarkLost}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Marcar como perdido
                </Button>
              )}
              {canDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </Button>
              )}
            </section>
          )}

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Atividades</h3>
            <p className="text-xs text-muted-foreground">
              O histórico do lead, visto pela equipe. O que fazer, com responsável, vai em Próximas ações.
            </p>

            {canEdit && (
              <form onSubmit={handleAddActivity} className="space-y-2 rounded-lg border p-3">
                <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
                  <Select
                    aria-label="Tipo de atividade"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as ActivityType)}
                    disableSort
                  >
                    {/* "Tarefa" virou a tela de Tarefas (abaixo): uma só forma de
                        registrar o que fazer, com responsável e aviso. */}
                    {Object.entries(ACTIVITY_TYPE_LABELS)
                      .filter(([value]) => value !== "tarefa")
                      .map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                  </Select>
                  <div className="space-y-1">
                    <Label htmlFor="activity-title" className="sr-only">
                      O que foi feito ou o que fazer
                    </Label>
                    <Input
                      id="activity-title"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="O que foi feito ou o que fazer"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <DatePicker
                    id="activity-due"
                    value={newDueAt}
                    onChange={(e) => setNewDueAt(e.target.value)}
                    placeholder="Prazo (opcional)"
                    className="sm:w-[180px]"
                  />
                  <Button type="submit" size="sm" disabled={savingActivity || !newTitle.trim()}>
                    {savingActivity && <Loader size="sm" variant="button" className="mr-2" />}
                    {savingActivity ? "Salvando..." : "Registrar"}
                  </Button>
                </div>
              </form>
            )}

            {loadingActivities ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
            ) : (
              <ul className="space-y-2">
                {activities.map((activity) => {
                  const done = Boolean(activity.doneAt);
                  return (
                    <li key={activity.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                      <button
                        type="button"
                        onClick={() => canEdit && toggleDone(activity)}
                        disabled={!canEdit}
                        aria-label={done ? "Reabrir atividade" : "Concluir atividade"}
                        className="mt-0.5 text-muted-foreground disabled:cursor-default"
                      >
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Circle className="h-4 w-4" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={done ? "text-muted-foreground line-through break-words" : "break-words"}>
                          {activity.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {ACTIVITY_TYPE_LABELS[activity.type]}
                          {activity.dueAt ? ` · prazo ${formatDay(activity.dueAt)}` : ""}
                          {activity.createdByName ? ` · ${activity.createdByName}` : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <TasksPanel context={{ leadId: lead.id, leadName: lead.name }} />
        </div>

        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Excluir lead?"
          description={`"${lead.name}" e as atividades dele serão excluídos.`}
          confirmLabel="Excluir"
          pendingLabel="Excluindo..."
          destructive
          isPending={deleting}
          onConfirm={handleDelete}
        />
      </SheetContent>
    </Sheet>
  );
}
