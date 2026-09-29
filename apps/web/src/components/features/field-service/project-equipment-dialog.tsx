"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { keepOpenOnOutsideClick } from "@/lib/field-service/service-orders";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/loader";
import { toast } from "@/lib/toast";
import { ProposalService } from "@/services/proposal-service";
import { FieldService } from "@/services/field-service-service";
import {
  addMonthsToDay,
  equipmentDraftsFromProposal,
  type EquipmentDraft,
} from "@/lib/field-service/project-equipment";

interface ProjectEquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: { id: string; proposalId: string | null; clientId: string | null; clientName: string | null };
}

function todayInBrazil(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/**
 * Registra os aparelhos que a obra instalou, a partir dos produtos da
 * proposta. Material (tubulação, cabo) se desmarca; a série e o local se
 * completam aqui ou depois, em Equipamentos.
 */
export function ProjectEquipmentDialog({ open, onOpenChange, project }: ProjectEquipmentDialogProps) {
  const [drafts, setDrafts] = React.useState<EquipmentDraft[] | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setDrafts(null);
    if (!project.proposalId) {
      setDrafts([]);
      return;
    }
    ProposalService.getProposalById(project.proposalId)
      .then((proposal) => setDrafts(proposal ? equipmentDraftsFromProposal(proposal) : []))
      .catch(() => setDrafts([]));
  }, [open, project.proposalId]);

  const update = (key: string, patch: Partial<EquipmentDraft>) =>
    setDrafts((list) => (list ?? []).map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const selected = (drafts ?? []).filter((d) => d.selected && d.name.trim().length >= 2);

  const submit = async () => {
    if (!project.clientId || selected.length === 0) return;
    setSaving(true);
    const installedAt = todayInBrazil();
    try {
      await FieldService.createEquipmentBatch({
        clientId: project.clientId,
        projectId: project.id,
        items: selected.map((d) => ({
          name: d.name.trim(),
          brand: d.brand.trim() || null,
          serialNumber: d.serialNumber.trim() || null,
          location: d.location.trim() || null,
          installedAt,
          warrantyUntil: addMonthsToDay(installedAt, 12),
        })),
      });
      toast.success(
        selected.length === 1 ? "Equipamento registrado." : `${selected.length} equipamentos registrados.`,
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao registrar os equipamentos.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-3xl" onInteractOutside={keepOpenOnOutsideClick}>
        <DialogHeader>
          <DialogTitle>Registrar os equipamentos da obra</DialogTitle>
          <DialogDescription>
            Cada aparelho vira um equipamento de {project.clientName ?? "o cliente"}, com garantia de 12 meses a
            partir de hoje. Desmarque o que é material, não equipamento.
          </DialogDescription>
        </DialogHeader>

        {drafts === null ? (
          <div className="flex justify-center py-8">
            <Loader size="md" />
          </div>
        ) : drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            A proposta desta obra não tem produtos. Cadastre os aparelhos em Equipamentos.
          </p>
        ) : (
          <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {drafts.map((d) => (
              <div key={d.key} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[auto_1fr_1fr_1fr] sm:items-center">
                <Checkbox
                  checked={d.selected}
                  aria-label={`Registrar ${d.name}`}
                  onCheckedChange={(checked) => update(d.key, { selected: checked })}
                  disabled={saving}
                />
                <Input
                  aria-label="Nome do equipamento"
                  value={d.name}
                  onChange={(e) => update(d.key, { name: e.target.value })}
                  maxLength={120}
                  disabled={saving || !d.selected}
                />
                <Input
                  aria-label="Número de série"
                  placeholder="Número de série"
                  value={d.serialNumber}
                  onChange={(e) => update(d.key, { serialNumber: e.target.value })}
                  maxLength={80}
                  disabled={saving || !d.selected}
                />
                <Input
                  aria-label="Local"
                  placeholder="Local"
                  value={d.location}
                  onChange={(e) => update(d.key, { location: e.target.value })}
                  maxLength={120}
                  disabled={saving || !d.selected}
                />
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={saving || selected.length === 0 || !project.clientId}>
            {saving && <Loader size="sm" variant="button" className="mr-2" />}
            Registrar {selected.length > 0 ? selected.length : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
