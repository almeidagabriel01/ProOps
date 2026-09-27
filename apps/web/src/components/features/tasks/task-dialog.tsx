"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Loader } from "@/components/ui/loader";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "@/lib/toast";
import { mentionedUids } from "@/lib/tasks/tasks";
import { TasksService } from "@/services/tasks-service";
import type { Task, TaskContext, TaskPerson } from "@/types/task";
import { MentionTextarea } from "./mention-textarea";

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sem tarefa, cria uma nova. */
  task?: Task | null;
  /** Onde a tarefa nova nasce: contato, proposta ou lead. */
  context?: TaskContext;
  people: TaskPerson[];
  currentUserId: string;
  canEdit: boolean;
  canDelete: boolean;
  /** Dono e administradores excluem qualquer tarefa; o membro, só as que criou. */
  isAdmin?: boolean;
  onSaved: (task: Task) => void;
  onDeleted?: (taskId: string) => void;
}

function contextLabel(source: TaskContext | Task | null | undefined): string | null {
  if (!source) return null;
  const parts = [
    source.clientName ? `Contato: ${source.clientName}` : null,
    source.proposalTitle ? `Proposta: ${source.proposalTitle}` : null,
    source.leadName ? `Lead: ${source.leadName}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  context,
  people,
  currentUserId,
  canEdit,
  canDelete,
  isAdmin = false,
  onSaved,
  onDeleted,
}: TaskDialogProps) {
  const isNew = !task;
  const [title, setTitle] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [dueAt, setDueAt] = React.useState("");
  const [assigneeId, setAssigneeId] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setNotes(task?.notes ?? "");
    setDueAt(task?.dueAt ?? "");
    // Tarefa nova nasce com quem cria como responsável: é o caso mais comum.
    setAssigneeId(task ? (task.assigneeId ?? "") : currentUserId);
  }, [open, task, currentUserId]);

  const readOnly = !isNew && !canEdit;
  const linked = contextLabel(task ?? context);
  const mayDelete =
    !isNew && canDelete && Boolean(onDeleted) && (isAdmin || task?.createdBy === currentUserId);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || readOnly) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        notes: notes.trim(),
        dueAt: dueAt || null,
        assigneeId: assigneeId || null,
        mentionUids: mentionedUids(notes, people),
      };
      const saved = isNew
        ? await TasksService.create({
            ...payload,
            clientId: context?.clientId,
            proposalId: context?.proposalId,
            leadId: context?.leadId,
          })
        : await TasksService.update(task.id, payload);
      toast.success(isNew ? "Tarefa criada." : "Tarefa salva.");
      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar a tarefa.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!task) return;
    setDeleting(true);
    try {
      await TasksService.remove(task.id);
      toast.success("Tarefa excluída.");
      onDeleted?.(task.id);
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir a tarefa.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(value) => !saving && onOpenChange(value)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isNew ? "Nova tarefa" : readOnly ? "Tarefa" : "Editar tarefa"}</DialogTitle>
            {linked && <DialogDescription className="break-words">{linked}</DialogDescription>}
          </DialogHeader>

          <form id="task-form" onSubmit={save} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="task-title">O que fazer</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Confirmar a data da instalação"
                disabled={readOnly}
                maxLength={200}
                autoFocus={isNew}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="task-assignee">Responsável</Label>
                <Select
                  id="task-assignee"
                  aria-label="Responsável"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  disabled={readOnly}
                  disableSort
                >
                  <option value="">Sem responsável</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.id === currentUserId ? `${person.name} (você)` : person.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-due">Prazo</Label>
                <DatePicker
                  id="task-due"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  placeholder="Sem prazo"
                  disabled={readOnly}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-notes">Detalhes</Label>
              <MentionTextarea
                id="task-notes"
                value={notes}
                onChange={setNotes}
                people={people.filter((p) => p.id !== currentUserId)}
                placeholder="Use @ para avisar alguém da equipe"
                disabled={readOnly}
              />
              {!readOnly && (
                <p className="text-xs text-muted-foreground">
                  Quem for citado com @ recebe o aviso e passa a ver a tarefa.
                </p>
              )}
            </div>
          </form>

          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {mayDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setConfirmDelete(true)}
                  disabled={saving}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                {readOnly ? "Fechar" : "Cancelar"}
              </Button>
              {!readOnly && (
                <Button type="submit" form="task-form" disabled={saving || !title.trim()}>
                  {saving && <Loader size="sm" variant="button" className="mr-2" />}
                  {isNew ? "Criar tarefa" : "Salvar"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(value) => !deleting && setConfirmDelete(value)}
        title="Excluir esta tarefa?"
        description="Ela sai da lista de todos que a acompanham."
        confirmLabel="Excluir"
        pendingLabel="Excluindo..."
        destructive
        isPending={deleting}
        onConfirm={remove}
      />
    </>
  );
}
