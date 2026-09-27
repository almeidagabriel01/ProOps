"use client";

import * as React from "react";
import Link from "next/link";
import { ListTodo } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePagePermission } from "@/hooks/usePagePermission";
import { useTasks } from "@/hooks/use-tasks";
import { isMyTask, sortOpenTasks, taskBucket, todayInBrazil } from "@/lib/tasks/tasks";
import type { Task } from "@/types/task";
import { TaskDialog } from "./task-dialog";
import { TaskRow } from "./task-row";

const MAX_ROWS = 5;

interface MyTasksCardProps {
  /**
   * O Dashboard espera as tarefas antes de mostrar a parte de cima, para o
   * card não aparecer (ou um "carregando" sumir) empurrando os gráficos.
   */
  onLoadingChange?: (loading: boolean) => void;
}

/**
 * "Minhas tarefas" no Dashboard: as atrasadas e as de hoje de quem está
 * olhando. Não aparece sem nada para fazer, nem para quem não abre Tarefas.
 * Sem "carregando" próprio: um bloco que some quando não há tarefa é
 * deslocamento de layout na certa.
 */
export function MyTasksCard({ onLoadingChange }: MyTasksCardProps = {}) {
  const { canView, canEdit, canDelete } = usePagePermission("tasks");
  const { reader, isDemo, tasks, loading, people, upsert, removeLocal, toggleDone } = useTasks();
  const [selected, setSelected] = React.useState<Task | null>(null);
  const today = React.useMemo(() => todayInBrazil(), []);
  const pending = !canView ? false : !reader ? true : loading;

  React.useEffect(() => {
    onLoadingChange?.(pending);
  }, [onLoadingChange, pending]);

  if (!canView || !reader || loading) return null;

  const due = sortOpenTasks(
    tasks.filter((t) => {
      const bucket = taskBucket(t, today);
      // Na demonstração as tarefas de exemplo não são de ninguém: mostra todas.
      const mine = isDemo || isMyTask(t, reader.uid);
      return mine && (bucket === "overdue" || bucket === "today");
    }),
  );
  if (due.length === 0) return null;

  return (
    <Card className="border border-border/50 shadow-md">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListTodo className="h-5 w-5" />
            Minhas tarefas de hoje
          </CardTitle>
          <CardDescription>
            {due.length === 1 ? "1 tarefa para hoje ou atrasada" : `${due.length} tarefas para hoje ou atrasadas`}
          </CardDescription>
        </div>
        <Link href="/tasks" className="text-sm text-muted-foreground hover:text-foreground">
          Ver todas
        </Link>
      </CardHeader>
      <CardContent className="p-0 max-sm:p-0">
        <ul className="divide-y border-t">
          {due.slice(0, MAX_ROWS).map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              today={today}
              canEdit={canEdit}
              onToggle={(t) => void toggleDone(t)}
              onOpen={setSelected}
            />
          ))}
        </ul>
      </CardContent>
      <TaskDialog
        open={selected !== null}
        onOpenChange={(value) => !value && setSelected(null)}
        task={selected}
        people={people}
        currentUserId={reader.uid}
        canEdit={canEdit}
        canDelete={canDelete}
        onSaved={upsert}
        onDeleted={removeLocal}
      />
    </Card>
  );
}
