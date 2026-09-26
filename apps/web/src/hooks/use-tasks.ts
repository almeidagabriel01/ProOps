"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
import { TasksService } from "@/services/tasks-service";
import { useTaskReader } from "@/hooks/use-task-reader";
import { usePermissions } from "@/providers/permissions-provider";
import type { Task, TaskContext, TaskPerson } from "@/types/task";

/**
 * Tarefas de quem está olhando: a lista (inteira, ou de um contato, proposta
 * ou lead), as pessoas que podem ser responsáveis e o concluir otimista.
 */
export function useTasks(context?: TaskContext) {
  const reader = useTaskReader();
  const { isDemo } = usePermissions();
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [people, setPeople] = React.useState<TaskPerson[]>([]);

  const contextKey = context ? `${context.clientId ?? ""}|${context.proposalId ?? ""}|${context.leadId ?? ""}` : "";
  const readerKey = reader ? `${reader.tenantId}|${reader.uid}|${reader.scope}` : "";

  React.useEffect(() => {
    if (!reader) return;
    let cancelled = false;
    setLoading(true);
    const load = context ? TasksService.listByContext(reader, context) : TasksService.list(reader);
    load
      .then((list) => {
        if (!cancelled) setTasks(list);
      })
      .catch(() => {
        if (!cancelled) toast.error("Erro ao carregar as tarefas.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // As chaves resumem reader e contexto; os objetos mudam de identidade a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readerKey, contextKey]);

  // A conta de demonstração não chama a API (a lista de pessoas é da empresa real).
  React.useEffect(() => {
    if (!reader || isDemo) return;
    let cancelled = false;
    TasksService.people()
      .then((list) => {
        if (!cancelled) setPeople(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readerKey, isDemo]);

  const upsert = React.useCallback((task: Task) => {
    setTasks((current) => {
      const exists = current.some((t) => t.id === task.id);
      return exists ? current.map((t) => (t.id === task.id ? task : t)) : [task, ...current];
    });
  }, []);

  const removeLocal = React.useCallback((taskId: string) => {
    setTasks((current) => current.filter((t) => t.id !== taskId));
  }, []);

  /** Concluir e reabrir respondem na hora e voltam atrás se o servidor recusar. */
  const toggleDone = React.useCallback(
    async (task: Task) => {
      const done = !task.doneAt;
      const optimistic = { ...task, doneAt: done ? new Date().toISOString() : null, doneBy: done ? reader?.uid ?? null : null };
      upsert(optimistic);
      try {
        upsert(await TasksService.update(task.id, { done }));
      } catch (error) {
        upsert(task);
        toast.error(error instanceof Error ? error.message : "Erro ao atualizar a tarefa.");
      }
    },
    [reader?.uid, upsert],
  );

  return { reader, isDemo, tasks, loading, people, upsert, removeLocal, toggleDone };
}
