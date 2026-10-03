"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePagePermission } from "@/hooks/usePagePermission";
import { toast } from "@/lib/toast";
import { isApprovedColumn } from "@/lib/proposal-approval";
import { KanbanService } from "@/services/kanban-service";
import { ProjectsService } from "@/services/projects-service";
import { Loader } from "@/components/ui/loader";

interface ProposalProjectButtonProps {
  proposalId: string;
  proposalStatus: string;
}

/**
 * Atalho da proposta para a obra: abre o projeto se ele existe, ou cria a
 * partir da proposta aprovada (a empresa pode ter desligado a criação
 * automática, ou a proposta foi aprovada antes do módulo existir).
 */
export function ProposalProjectButton({ proposalId, proposalStatus }: ProposalProjectButtonProps) {
  const router = useRouter();
  const { tenant, isReadOnly } = useTenant();
  const { hasProjects } = usePlanLimits();
  const { canView, canCreate } = usePagePermission("projects");
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [approved, setApproved] = React.useState(proposalStatus === "approved");
  const [creating, setCreating] = React.useState(false);

  const tenantId = tenant?.id;
  const enabled = hasProjects && canView;

  React.useEffect(() => {
    if (!enabled || !tenantId) return;
    let cancelled = false;
    ProjectsService.getByProposal(proposalId)
      .then((found) => {
        if (!cancelled) setProjectId(found?.id ?? null);
      })
      .catch(() => undefined);
    if (proposalStatus !== "approved") {
      KanbanService.getStatuses(tenantId)
        .then((columns) => {
          if (cancelled) return;
          const column = columns.find((c) => c.id === proposalStatus || c.mappedStatus === proposalStatus);
          setApproved(isApprovedColumn(column));
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [enabled, tenantId, proposalId, proposalStatus]);

  if (!enabled) return null;

  if (projectId) {
    return (
      <Button variant="outline" className="gap-2" onClick={() => router.push(`/projects/${projectId}`)}>
        <HardHat className="h-4 w-4" />
        Projeto da obra
      </Button>
    );
  }

  if (!approved || !canCreate || isReadOnly) return null;

  const create = async () => {
    setCreating(true);
    try {
      const result = await ProjectsService.create({ proposalId });
      router.push(`/projects/${result.projectId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar o projeto.");
      setCreating(false);
    }
  };

  return (
    <Button variant="outline" className="gap-2" onClick={() => void create()} disabled={creating}>
      {creating && <Loader size="sm" variant="button" className="mr-2" />}
      <HardHat className="h-4 w-4" />
      {creating ? "Criando..." : "Criar projeto da obra"}
    </Button>
  );
}
