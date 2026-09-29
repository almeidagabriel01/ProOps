"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ListTodo, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageViewSwitcher } from "@/components/layout/page-view-switcher";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EmptyState } from "@/components/shared/empty-state";
import { SelectTenantState } from "@/components/shared/select-tenant-state";
import { TaskDialog } from "@/components/features/tasks/task-dialog";
import { TaskRow } from "@/components/features/tasks/task-row";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { usePermissions } from "@/providers/permissions-provider";
import { usePagePermission } from "@/hooks/usePagePermission";
import { useTasks } from "@/hooks/use-tasks";
import {
  TASK_BUCKETS,
  filterTasks,
  sortOpenTasks,
  taskBucket,
  todayInBrazil,
  type TaskFilter,
} from "@/lib/tasks/tasks";
import type { Task } from "@/types/task";
import { TasksSkeleton } from "./_components/tasks-skeleton";

/**
 * Tarefas: o "a fazer" da pessoa, com responsável, prazo e @menção. O membro
 * vê as que criou, as dele e as em que foi citado; o dono vê todas.
 */
export default function TasksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { isMaster } = usePermissions();
  const { canCreate, canEdit, canDelete } = usePagePermission("tasks");
  const { reader, isDemo, tasks, loading, people, upsert, removeLocal, toggleDone } = useTasks();
  const [filter, setFilter] = React.useState<TaskFilter | null>(null);
  const [dialog, setDialog] = React.useState<{ open: boolean; task: Task | null }>({ open: false, task: null });
  const today = React.useMemo(() => todayInBrazil(), []);

  // `?task=` (o link da notificação) abre a tarefa direto.
  const requestedTaskId = searchParams.get("task");
  React.useEffect(() => {
    if (!requestedTaskId || loading) return;
    const task = tasks.find((t) => t.id === requestedTaskId);
    if (task) setDialog({ open: true, task });
    router.replace("/tasks", { scroll: false });
  }, [requestedTaskId, loading, tasks, router]);

  if (!user) return null;
  if (user.role === "superadmin" && !tenant) {
    return <SelectTenantState title="Selecione uma empresa para ver as tarefas" />;
  }
  if (loading || !reader) return <TasksSkeleton />;

  // Na demonstração as tarefas de exemplo não são de ninguém: começa em Todas.
  const activeFilter: TaskFilter = filter ?? (isDemo ? "all" : "mine");
  const visible = filterTasks(tasks, activeFilter, reader.uid);
  const count = (f: TaskFilter) => filterTasks(tasks, f, reader.uid).length;

  const renderRows = (list: Task[]) => (
    <ul className="divide-y rounded-xl border">
      {list.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          today={today}
          canEdit={canEdit}
          onToggle={(t) => void toggleDone(t)}
          onOpen={(t) => setDialog({ open: true, task: t })}
        />
      ))}
    </ul>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Tarefas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            O que fazer, quem faz e até quando. Use @ para avisar alguém da equipe.
          </p>
          <PageViewSwitcher className="mt-3" />
        </div>
        {canCreate && (
          <Button onClick={() => setDialog({ open: true, task: null })}>
            <Plus className="mr-2 h-4 w-4" />
            Nova tarefa
          </Button>
        )}
      </div>

      <SegmentedControl
        id="tasks-filter"
        value={activeFilter}
        onChange={(v) => setFilter(v as TaskFilter)}
        options={[
          { value: "mine", label: "Minhas", count: count("mine") },
          { value: "created", label: "Criadas por mim", count: count("created") },
          { value: "all", label: "Todas", count: count("all") },
          { value: "done", label: "Concluídas", count: count("done") },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title={tasks.length === 0 ? "Nenhuma tarefa ainda" : "Nada neste filtro"}
          description={
            tasks.length === 0
              ? "Crie uma tarefa aqui, na ficha de um contato, numa proposta ou num lead do CRM. Quem for responsável ou citado com @ recebe o aviso."
              : "Troque o filtro para ver as outras tarefas."
          }
        />
      ) : activeFilter === "done" ? (
        renderRows(visible)
      ) : (
        <div className="space-y-6">
          {TASK_BUCKETS.map((bucket) => {
            const inBucket = sortOpenTasks(visible.filter((t) => taskBucket(t, today) === bucket.id));
            if (inBucket.length === 0) return null;
            return (
              <section key={bucket.id} className="space-y-2">
                <h2
                  className={
                    bucket.id === "overdue"
                      ? "text-sm font-semibold text-destructive"
                      : "text-sm font-semibold text-foreground"
                  }
                >
                  {bucket.label} ({inBucket.length})
                </h2>
                {renderRows(inBucket)}
              </section>
            );
          })}
        </div>
      )}

      <TaskDialog
        open={dialog.open}
        onOpenChange={(value) => setDialog((d) => ({ ...d, open: value }))}
        task={dialog.task}
        people={people}
        currentUserId={reader.uid}
        canEdit={canEdit}
        canDelete={canDelete}
        isAdmin={isMaster}
        onSaved={upsert}
        onDeleted={removeLocal}
      />
    </div>
  );
}
