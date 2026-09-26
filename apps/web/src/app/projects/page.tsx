"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { HardHat, Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { EmptyState } from "@/components/shared/empty-state";
import { SelectTenantState } from "@/components/shared/select-tenant-state";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";
import { usePermissions } from "@/providers/permissions-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePagePermission } from "@/hooks/usePagePermission";
import { toast } from "@/lib/toast";
import { ProjectsService } from "@/services/projects-service";
import type { Project } from "@/types/project";
import { ProjectsSkeleton } from "./_components/projects-skeleton";
import { ProjectCard } from "./_components/project-card";
import { NewProjectDialog } from "./_components/new-project-dialog";
import { ProjectSettingsDialog } from "./_components/project-settings-dialog";
import { filterProjects, type ProjectFilter } from "./_lib/projects";

function todayInBrazil(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Projetos de instalação: a obra depois da venda, do início ao aceite da entrega. */
export default function ProjectsPage() {
  const router = useRouter();
  const { tenant, isReadOnly } = useTenant();
  const { user } = useAuth();
  const { isMaster } = usePermissions();
  const { hasProjects, isLoading: isPlanLoading } = usePlanLimits();
  const { canCreate } = usePagePermission("projects");

  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<ProjectFilter>("active");
  const [newOpen, setNewOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const today = React.useMemo(() => todayInBrazil(), []);

  const tenantId = tenant?.id;
  const allowed = hasProjects || user?.role === "superadmin";

  React.useEffect(() => {
    if (!tenantId || !allowed) return;
    let cancelled = false;
    setLoading(true);
    ProjectsService.list(tenantId)
      .then((list) => {
        if (!cancelled) setProjects(list);
      })
      .catch(() => {
        if (!cancelled) toast.error("Erro ao carregar os projetos.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, allowed]);

  if (!user) return null;
  if (user.role === "superadmin" && !tenant) {
    return <SelectTenantState title="Selecione uma empresa para ver os projetos" />;
  }
  if (isPlanLoading) return <ProjectsSkeleton />;
  if (!allowed) {
    return (
      <UpgradeRequired
        feature="Projetos"
        description="Acompanhe cada obra depois da venda: etapas, checklist, fotos, técnico responsável e o aceite do cliente na entrega. Incluído nos planos Pro e Enterprise."
      />
    );
  }
  if (loading) return <ProjectsSkeleton />;

  const visible = filterProjects(projects, filter, user.id ?? null);
  const writable = !isReadOnly;
  const count = (f: ProjectFilter) => filterProjects(projects, f, user.id ?? null).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Projetos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada obra depois da venda: etapas, fotos e a entrega aceita pelo cliente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {writable && isMaster && (
            <Button variant="outline" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="mr-2 h-4 w-4" />
              Configurar etapas
            </Button>
          )}
          {writable && canCreate && (
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo projeto
            </Button>
          )}
        </div>
      </div>

      <SegmentedControl
        id="projects-filter"
        value={filter}
        onChange={(v) => setFilter(v as ProjectFilter)}
        options={[
          { value: "active", label: "Em andamento", count: count("active") },
          { value: "mine", label: "Meus", count: count("mine") },
          { value: "completed", label: "Concluídos", count: count("completed") },
          { value: "all", label: "Todos", count: projects.length },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={HardHat}
          title={projects.length === 0 ? "Nenhum projeto ainda" : "Nada neste filtro"}
          description={
            projects.length === 0
              ? "Quando uma proposta é aprovada, o projeto da obra nasce aqui com as etapas da sua empresa. Marque o checklist, anexe fotos e envie o link para o cliente aceitar a entrega."
              : "Troque o filtro para ver os outros projetos."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((project) => (
            <ProjectCard key={project.id} project={project} today={today} />
          ))}
        </div>
      )}

      <NewProjectDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(projectId) => router.push(`/projects/${projectId}`)}
      />
      <ProjectSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
