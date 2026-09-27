"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2, HardHat, User } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatDateBR } from "@/utils/date-format";
import type { Project } from "@/types/project";
import {
  PROJECT_STATUS_LABELS,
  computeProgress,
  currentStage,
  isProjectLate,
} from "../_lib/projects";

interface ProjectCardProps {
  project: Project;
  today: string;
}

/** Cartão da lista: em que etapa a obra está, quanto falta, quem cuida e o prazo. */
export function ProjectCard({ project, today }: ProjectCardProps) {
  const progress = computeProgress(project.stages);
  const stage = currentStage(project.stages);
  const late = isProjectLate(project, today);
  const accepted = project.delivery?.status === "accepted";

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold leading-tight break-words">{project.title}</p>
          {project.clientName && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{project.clientName}</p>
          )}
        </div>
        {project.status !== "active" && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {PROJECT_STATUS_LABELS[project.status]}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate">
            {stage ? `Etapa: ${stage.name}` : "Todas as etapas concluídas"}
          </span>
          <span className="shrink-0">
            {progress.stagesDone}/{progress.stagesTotal}
          </span>
        </div>
        <Progress value={progress.percent} aria-label={`${progress.percent}% concluído`} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <User className="h-3.5 w-3.5" />
          {project.assigneeName || "Sem responsável"}
        </span>
        {project.dueDate && (
          <span className={cn("flex items-center gap-1", late && "font-medium text-red-600 dark:text-red-400")}>
            <CalendarClock className="h-3.5 w-3.5" />
            {late ? "Atrasado: " : "Entrega: "}
            {formatDateBR(project.dueDate)}
          </span>
        )}
        {accepted ? (
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Entrega aceita
          </span>
        ) : project.delivery?.status === "sent" ? (
          <span className="flex items-center gap-1">
            <HardHat className="h-3.5 w-3.5" />
            Aguardando aceite do cliente
          </span>
        ) : null}
      </div>
    </Link>
  );
}
