"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, MapPin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePagePermission } from "@/hooks/usePagePermission";
import { toast } from "@/lib/toast";
import { ProjectsService } from "@/services/projects-service";
import type { Project, ProjectStatus, StageStatus } from "@/types/project";
import { Loader } from "@/components/ui/loader";
import { ProjectsSkeleton } from "../_components/projects-skeleton";
import { StageCard } from "../_components/stage-card";
import { DeliveryCard } from "../_components/delivery-card";
import { PROJECT_STATUS_LABELS, computeProgress } from "../_lib/projects";
import {
  EMPTY_OVERLAY,
  applyOverlay,
  dropFromOverlay,
  itemKey,
  pruneOverlay,
  type OverlayField,
  type ProjectOverlay,
} from "../_lib/project-overlay";

/** A obra: etapas com checklist e fotos, responsável, prazo e a entrega. */
export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = String(params.id || "");
  const { tenant, isReadOnly } = useTenant();
  const { user } = useAuth();
  const { hasProjects, isLoading: isPlanLoading } = usePlanLimits();
  const { canEdit: canEditPerm, canDelete: canDeletePerm } = usePagePermission("projects");

  const [serverProject, setProject] = React.useState<Project | null>(null);
  // Mudanças já mostradas e ainda não confirmadas pelo servidor: é o que faz
  // o checklist, a situação, o responsável e as datas responderem na hora.
  const [overlay, setOverlay] = React.useState<ProjectOverlay>(EMPTY_OVERLAY);
  const latest = React.useRef<Project | null>(null);
  const [savingNotes, setSavingNotes] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [assignees, setAssignees] = React.useState<Array<{ id: string; name: string }>>([]);
  const [notes, setNotes] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const allowed = hasProjects || user?.role === "superadmin";

  React.useEffect(() => {
    latest.current = serverProject;
    if (serverProject) setOverlay((o) => pruneOverlay(serverProject, o));
  }, [serverProject]);

  const project = React.useMemo(
    () => (serverProject ? applyOverlay(serverProject, overlay) : null),
    [serverProject, overlay],
  );

  /**
   * Mostra na hora, grava em seguida. Se o servidor recusar, a entrada sai da
   * camada e a tela volta ao valor real, com o aviso do erro.
   */
  const optimistic = React.useCallback(
    async (
      patch: (o: ProjectOverlay) => ProjectOverlay,
      drop: Parameters<typeof dropFromOverlay>[1],
      request: () => Promise<unknown>,
      fallback: string,
    ) => {
      setOverlay(patch);
      try {
        await request();
        // O listener pode ter entregado o valor novo antes da resposta.
        const current = latest.current;
        if (current) setOverlay((o) => pruneOverlay(current, o));
      } catch (error) {
        setOverlay((o) => dropFromOverlay(o, drop));
        toast.error(error instanceof Error ? error.message : fallback);
      }
    },
    [],
  );
  const canEdit = canEditPerm && !isReadOnly;
  const canDelete = canDeletePerm && !isReadOnly;

  React.useEffect(() => {
    if (!projectId || !allowed) return;
    setLoading(true);
    return ProjectsService.subscribe(
      projectId,
      (next) => {
        setProject(next);
        setLoading(false);
      },
      () => {
        setProject(null);
        setLoading(false);
      },
    );
  }, [projectId, allowed]);

  React.useEffect(() => {
    setNotes(serverProject?.notes ?? "");
    // Só ao trocar de projeto: o listener não pode apagar o que está sendo digitado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverProject?.id]);

  React.useEffect(() => {
    if (!canEdit || !allowed) return;
    ProjectsService.assignees()
      .then(setAssignees)
      .catch(() => setAssignees([]));
  }, [canEdit, allowed]);

  const save = (
    input: Parameters<typeof ProjectsService.update>[1],
    display: Partial<Pick<Project, OverlayField>> = {},
  ) => {
    if (!serverProject) return Promise.resolve();
    const fields = { ...input, ...display } as Partial<Pick<Project, OverlayField>>;
    return optimistic(
      (o) => ({ ...o, fields: { ...o.fields, ...fields } }),
      { field: Object.keys(fields) as OverlayField[] },
      () => ProjectsService.update(serverProject.id, input),
      "Erro ao salvar o projeto.",
    );
  };

  const toggleItem = (stageId: string, itemId: string, done: boolean) => {
    if (!serverProject) return;
    const key = itemKey(stageId, itemId);
    const stage = project?.stages.find((s) => s.id === stageId);
    // O backend põe a etapa pendente em andamento ao marcar o primeiro item;
    // a tela antecipa o mesmo para não piscar.
    const startsStage = done && stage?.status === "pending";
    void optimistic(
      (o) => ({
        ...o,
        items: { ...o.items, [key]: done },
        stageStatus: startsStage ? { ...o.stageStatus, [stageId]: "in_progress" } : o.stageStatus,
      }),
      { item: key, stageStatus: startsStage ? stageId : undefined },
      () => ProjectsService.toggleChecklistItem(serverProject.id, stageId, itemId, done),
      "Erro ao atualizar o item.",
    );
  };

  const setStageStatus = (stageId: string, status: StageStatus) => {
    if (!serverProject) return;
    void optimistic(
      (o) => ({ ...o, stageStatus: { ...o.stageStatus, [stageId]: status } }),
      { stageStatus: stageId },
      () => ProjectsService.updateStage(serverProject.id, stageId, { status }),
      "Erro ao atualizar a etapa.",
    );
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    await save({ notes: notes.trim() || null });
    setSavingNotes(false);
  };

  const handleDelete = async () => {
    if (!project) return;
    setDeleting(true);
    try {
      await ProjectsService.remove(project.id);
      toast.success("Projeto excluído.");
      router.push("/projects");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir o projeto.");
      setDeleting(false);
    }
  };

  if (!user) return null;
  if (isPlanLoading) return <ProjectsSkeleton />;
  if (!allowed) {
    return (
      <UpgradeRequired
        feature="Projetos"
        description="Acompanhe cada obra depois da venda. Incluído nos planos Pro e Enterprise."
      />
    );
  }
  if (loading) return <ProjectsSkeleton />;
  if (!project || (tenant && project.tenantId !== tenant.id)) {
    return (
      <EmptyState
        icon={FileText}
        title="Projeto não encontrado"
        description="Ele pode ter sido excluído."
        action={
          <Button asChild variant="outline">
            <Link href="/projects">Voltar para Projetos</Link>
          </Button>
        }
      />
    );
  }

  const progress = computeProgress(project.stages);
  const assigneeOptions =
    project.assigneeId && !assignees.some((a) => a.id === project.assigneeId)
      ? [...assignees, { id: project.assigneeId, name: project.assigneeName || "Responsável" }]
      : assignees;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Voltar para Projetos">
            <Link href="/projects">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold tracking-tight">{project.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {project.clientName && <span>{project.clientName}</span>}
              {project.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {project.address}
                </span>
              )}
              {project.proposalId && (
                <Link href={`/proposals/${project.proposalId}/view`} className="underline-offset-4 hover:underline">
                  Ver proposta{project.proposalCode ? ` ${project.proposalCode}` : ""}
                </Link>
              )}
            </div>
          </div>
        </div>
        {canDelete && (
          <Button variant="ghost" className="self-start text-destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir projeto
          </Button>
        )}
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-4">
        <div className="space-y-1.5 md:col-span-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Andamento</span>
            <span className="text-muted-foreground">
              {progress.stagesDone} de {progress.stagesTotal} etapas, {progress.checklistDone} de{" "}
              {progress.checklistTotal} itens
            </span>
          </div>
          <Progress value={progress.percent} aria-label={`${progress.percent}% concluído`} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="project-status">Situação</Label>
          {canEdit ? (
            <Select
              id="project-status"
              value={project.status}
              onChange={(e) => void save({ status: e.target.value as ProjectStatus })}
              disableSort
            >
              {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((status) => (
                <option key={status} value={status}>
                  {PROJECT_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-sm">{PROJECT_STATUS_LABELS[project.status]}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="project-assignee">Técnico responsável</Label>
          {canEdit ? (
            <Select
              id="project-assignee"
              value={project.assigneeId ?? ""}
              onChange={(e) => {
                const id = e.target.value || null;
                void save(
                  { assigneeId: id },
                  { assigneeName: id ? (assigneeOptions.find((a) => a.id === id)?.name ?? null) : null },
                );
              }}
            >
              <option value="">Sem responsável</option>
              {assigneeOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-sm">{project.assigneeName || "Sem responsável"}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="project-start">Início</Label>
          <DatePicker
            id="project-start"
            value={project.startDate ?? ""}
            disabled={!canEdit}
            onChange={(e) => void save({ startDate: e.target.value || null })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="project-due">Previsão de entrega</Label>
          <DatePicker
            id="project-due"
            value={project.dueDate ?? ""}
            disabled={!canEdit}
            onChange={(e) => void save({ dueDate: e.target.value || null })}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {project.stages.map((stage, index) => (
            <StageCard
              key={stage.id}
              projectId={project.id}
              stage={stage}
              index={index}
              canEdit={canEdit}
              onToggleItem={(itemId, done) => toggleItem(stage.id, itemId, done)}
              onStageStatus={(status) => setStageStatus(stage.id, status)}
            />
          ))}
        </div>

        <div className="space-y-4">
          <DeliveryCard project={project} companyName={tenant?.name} canEdit={canEdit} />

          <section aria-label="Observações" className="space-y-2 rounded-xl border bg-card p-4">
            <Label htmlFor="project-notes" className="font-semibold">
              Observações internas
            </Label>
            <Textarea
              id="project-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canEdit}
              placeholder="Acesso à obra, contato do zelador, pendências..."
              className="min-h-[120px]"
            />
            <p className="text-xs text-muted-foreground">Não aparecem para o cliente.</p>
            {canEdit && (savingNotes || notes !== (project.notes ?? "")) && (
              <Button size="sm" onClick={() => void saveNotes()} disabled={savingNotes}>
                {savingNotes && <Loader size="sm" variant="button" />}
                {savingNotes ? "Salvando..." : "Salvar observações"}
              </Button>
            )}
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir projeto?"
        description={`"${project.title}" e as fotos dele serão excluídos. A proposta e o financeiro não mudam.`}
        confirmLabel="Excluir"
        pendingLabel="Excluindo..."
        destructive
        isPending={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
