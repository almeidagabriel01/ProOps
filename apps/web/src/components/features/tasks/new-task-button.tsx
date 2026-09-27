"use client";

import * as React from "react";
import { ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePagePermission } from "@/hooks/usePagePermission";
import { useTaskReader } from "@/hooks/use-task-reader";
import { TasksService } from "@/services/tasks-service";
import type { TaskContext, TaskPerson } from "@/types/task";
import { TaskDialog } from "./task-dialog";

interface NewTaskButtonProps {
  context: TaskContext;
}

/** "Nova tarefa" já ligada a uma proposta (e ao cliente dela). */
export function NewTaskButton({ context }: NewTaskButtonProps) {
  const { canCreate, canEdit, canDelete } = usePagePermission("tasks");
  const reader = useTaskReader();
  const [open, setOpen] = React.useState(false);
  const [people, setPeople] = React.useState<TaskPerson[]>([]);

  if (!canCreate || !reader) return null;

  const openDialog = () => {
    setOpen(true);
    if (people.length === 0) {
      TasksService.people()
        .then(setPeople)
        .catch(() => undefined);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={openDialog} className="gap-2">
        <ListTodo className="h-4 w-4" />
        Nova tarefa
      </Button>
      <TaskDialog
        open={open}
        onOpenChange={setOpen}
        context={context}
        people={people}
        currentUserId={reader.uid}
        canEdit={canEdit}
        canDelete={canDelete}
        onSaved={() => undefined}
      />
    </>
  );
}
