"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Circle, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDue, taskBucket } from "@/lib/tasks/tasks";
import type { Task } from "@/types/task";

interface TaskRowProps {
  task: Task;
  today: string;
  canEdit: boolean;
  /** Esconde o vínculo quando a lista já está dentro dele (a ficha do contato, por exemplo). */
  hideContext?: boolean;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
}

function contextLink(task: Task): { href: string; label: string } | null {
  if (task.proposalId) {
    return { href: `/proposals/${task.proposalId}/view`, label: task.proposalTitle || "Proposta" };
  }
  if (task.leadId) return { href: `/crm?tab=leads&lead=${task.leadId}`, label: task.leadName || "Lead" };
  if (task.clientId) return { href: `/contacts/${task.clientId}`, label: task.clientName || "Contato" };
  return null;
}

export function TaskRow({ task, today, canEdit, hideContext, onToggle, onOpen }: TaskRowProps) {
  const bucket = taskBucket(task, today);
  const done = bucket === "done";
  const due = formatDue(task.dueAt);
  const link = hideContext ? null : contextLink(task);

  return (
    <li className="flex items-start gap-3 p-3">
      <button
        type="button"
        onClick={() => canEdit && onToggle(task)}
        disabled={!canEdit}
        aria-label={done ? `Reabrir "${task.title}"` : `Concluir "${task.title}"`}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground disabled:cursor-default disabled:hover:text-muted-foreground"
      >
        {done ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5" />}
      </button>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onOpen(task)}
          className={cn(
            "block w-full break-words text-left text-sm font-medium hover:underline",
            done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {due && (
            <span
              className={cn(
                bucket === "overdue" && "font-medium text-destructive",
                bucket === "today" && "font-medium text-amber-600 dark:text-amber-400",
              )}
            >
              {bucket === "overdue" ? `Atrasada, ${due}` : bucket === "today" ? "Hoje" : due}
            </span>
          )}
          {task.assigneeName && (
            <span className="inline-flex items-center gap-1">
              <UserRound className="h-3 w-3" />
              {task.assigneeName}
            </span>
          )}
          {link && (
            <Link href={link.href} className="max-w-[16rem] truncate hover:text-foreground hover:underline">
              {link.label}
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
