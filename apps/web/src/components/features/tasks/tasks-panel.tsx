"use client";

import * as React from "react";
import { ListTodo, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePagePermission } from "@/hooks/usePagePermission";
import { usePermissions } from "@/providers/permissions-provider";
import { useTasks } from "@/hooks/use-tasks";
import { todayInBrazil, sortOpenTasks } from "@/lib/tasks/tasks";
import type { Task, TaskContext } from "@/types/task";
import { TaskDialog } from "./task-dialog";
import { TaskRow } from "./task-row";

interface TasksPanelProps {
  context: TaskContext;
  /** Esconde o título quando a aba em volta já diz "Tarefas". */
  hideHeading?: boolean;
}

/**
 * As tarefas de um contato, proposta ou lead, com o "Nova tarefa" já ligado a
 * ele. Some para quem não abre a tela de Tarefas.
 */
export function TasksPanel({ context, hideHeading }: TasksPanelProps) {
  const { canView, canCreate, canEdit, canDelete } = usePagePermission("tasks");
  const { isMaster } = usePermissions();
  const { reader, tasks, loading, people, upsert, removeLocal, toggleDone } = useTasks(context);
  const [dialog, setDialog] = React.useState<{ open: boolean; task: Task | null }>({ open: false, task: null });
  const today = React.useMemo(() => todayInBrazil(), []);

  if (!canView || !reader) return null;

  const open = sortOpenTasks(tasks.filter((t) => !t.doneAt));
  const done = tasks.filter((t) => t.doneAt);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        {!hideHeading && <h3 className="text-sm font-semibold">Tarefas</h3>}
        {canCreate && (
          <Button
            size="sm"
            variant="outline"
            className={hideHeading ? "ml-auto" : undefined}
            onClick={() => setDialog({ open: true, task: null })}
          >
            <Plus className="mr-1 h-4 w-4" />
            Nova tarefa
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : tasks.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <ListTodo className="h-4 w-4 shrink-0" />
          Nenhuma tarefa ainda.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {[...open, ...done].map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              today={today}
              canEdit={canEdit}
              hideContext
              onToggle={(t) => void toggleDone(t)}
              onOpen={(t) => setDialog({ open: true, task: t })}
            />
          ))}
        </ul>
      )}

      <TaskDialog
        open={dialog.open}
        onOpenChange={(value) => setDialog((d) => ({ ...d, open: value }))}
        task={dialog.task}
        context={context}
        people={people}
        currentUserId={reader.uid}
        canEdit={canEdit}
        canDelete={canDelete}
        isAdmin={isMaster}
        onSaved={upsert}
        onDeleted={removeLocal}
      />
    </section>
  );
}
