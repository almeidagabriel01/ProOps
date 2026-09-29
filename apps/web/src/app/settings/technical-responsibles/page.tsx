"use client";

import * as React from "react";
import { FileText, HardHat, Pencil, Plus, Shield, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormContainer, FormHeader, FormHeaderSkeleton } from "@/components/ui/form-components";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { useReportSettingsLoading } from "@/app/settings/_components/settings-chrome";
import { TechnicalResponsiblesListSkeleton } from "@/app/settings/_components/settings-skeleton";
import { TechnicalResponsibleDialog } from "@/app/settings/_components/technical-responsible-dialog";
import { useCurrentNicheConfig } from "@/hooks/useCurrentNicheConfig";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useTechnicalResponsibles } from "@/hooks/useTechnicalResponsibles";
import { formatDay } from "@/lib/field-service/contracts";
import {
  ART_STATUS_LABELS,
  ART_STATUS_STYLES,
  artStatus,
  todayInBrazil,
} from "@/lib/field-service/technical-responsibles";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { usePermissions } from "@/providers/permissions-provider";
import { useTenant } from "@/providers/tenant-provider";
import { TechnicalResponsiblesService } from "@/services/technical-responsibles-service";
import type { TechnicalResponsible } from "@/types/field-service";

function Restricted({ message }: { message: string }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
      <Shield className="mb-4 h-16 w-16 text-muted-foreground" />
      <h2 className="mb-2 text-2xl font-bold">Acesso Restrito</h2>
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * Responsáveis técnicos do PMOC: o engenheiro ou técnico que assina o plano,
 * com a ART. Só climatização (`NicheConfig.fieldService.pmoc`), só com o
 * módulo de assistência técnica, e só o dono e os administradores cadastram.
 */
export default function TechnicalResponsiblesPage() {
  const niche = useCurrentNicheConfig();
  const { user } = useAuth();
  const { tenant, isReadOnly } = useTenant();
  const { permissions, isDemo, isLoading: permLoading } = usePermissions();
  const { hasFieldService, isLoading: planLoading } = usePlanLimits();
  const isSuperAdmin = user?.role === "superadmin";
  const isAdmin = ["MASTER", "ADMIN"].includes(String(permissions?.role ?? "")) || isSuperAdmin;
  const canSee = niche.fieldService.pmoc && (hasFieldService || isSuperAdmin) && (isAdmin || isDemo);
  const canEdit = canSee && !isReadOnly && !isDemo;

  const { responsibles, loading, refresh } = useTechnicalResponsibles(tenant?.id, canSee);
  const [editing, setEditing] = React.useState<TechnicalResponsible | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [removing, setRemoving] = React.useState<TechnicalResponsible | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const pageLoading = permLoading || planLoading || (canSee && loading);
  useReportSettingsLoading(pageLoading);

  if (!niche.fieldService.pmoc) {
    return <Restricted message="Responsáveis técnicos existem para o PMOC, do nicho de climatização." />;
  }
  if (!planLoading && !hasFieldService && !isSuperAdmin) {
    return (
      <UpgradeRequired
        feature="PMOC"
        description="Monte o PMOC dos seus clientes com o responsável técnico e a ART, e deixe as visitas preventivas abrirem sozinhas. Incluído nos planos Pro e Enterprise, ou como add-on no Starter."
      />
    );
  }

  const today = todayInBrazil();
  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (responsible: TechnicalResponsible) => {
    setEditing(responsible);
    setDialogOpen(true);
  };
  const confirmRemove = async () => {
    if (!removing) return;
    setDeleting(true);
    try {
      await TechnicalResponsiblesService.remove(removing.id);
      toast.success("Responsável técnico excluído.");
      setRemoving(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir o responsável técnico.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <FormContainer>
      {permLoading ? (
        <FormHeaderSkeleton />
      ) : (
        <FormHeader
          title="Responsáveis técnicos"
          subtitle="Quem assina o PMOC dos seus clientes, com o registro no conselho e a ART"
          icon={HardHat}
        />
      )}

      {permLoading || (canSee && loading) ? (
        <TechnicalResponsiblesListSkeleton />
      ) : !canSee ? (
        <Restricted message="Apenas o dono e os administradores cadastram os responsáveis técnicos." />
      ) : (
        <div className="space-y-4">
          {canEdit && responsibles.length > 0 && (
            <div className="flex justify-end">
              <Button onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" />
                Novo responsável
              </Button>
            </div>
          )}

          {responsibles.length === 0 ? (
            <EmptyState
              icon={HardHat}
              title="Nenhum responsável técnico"
              description="O PMOC precisa de um engenheiro ou técnico registrado, com ART válida. Cadastre quem assina os planos da empresa."
              action={
                canEdit ? (
                  <Button onClick={openNew}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo responsável
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {responsibles.map((responsible) => {
                const status = artStatus(responsible.artValidUntil, today);
                return (
                  <li
                    key={responsible.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{responsible.name}</p>
                        {!responsible.active && <Badge variant="outline">Desativado</Badge>}
                        <Badge variant="outline" className={cn("font-normal", ART_STATUS_STYLES[status])}>
                          {ART_STATUS_LABELS[status]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {responsible.profession} · {responsible.council} {responsible.registryNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {responsible.artNumber ? `ART ${responsible.artNumber}` : "Sem número de ART"}
                        {responsible.artValidUntil ? `, válida até ${formatDay(responsible.artValidUntil)}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {responsible.artFile && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={responsible.artFile.url} target="_blank" rel="noreferrer">
                            <FileText className="mr-2 h-4 w-4" />
                            Ver a ART
                          </a>
                        </Button>
                      )}
                      {canEdit && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => openEdit(responsible)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Excluir ${responsible.name}`}
                            onClick={() => setRemoving(responsible)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <TechnicalResponsibleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        responsible={editing}
        onSaved={() => void refresh()}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && !deleting && setRemoving(null)}
        title="Excluir responsável técnico"
        description={
          removing
            ? `${removing.name} sai da lista, com o PDF da ART. Contrato PMOC em vigor que o usa impede a exclusão: nesse caso, desative o cadastro.`
            : ""
        }
        confirmLabel="Excluir"
        pendingLabel="Excluindo..."
        destructive
        isPending={deleting}
        onConfirm={confirmRemove}
      />
    </FormContainer>
  );
}
