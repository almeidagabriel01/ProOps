"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import { ProjectsService } from "@/services/projects-service";
import type { ProjectOnApproval, StageTemplate } from "@/types/project";

const ON_APPROVAL_OPTIONS: Array<{ value: ProjectOnApproval; label: string }> = [
  { value: "ask", label: "Perguntar se a venda tem instalação" },
  { value: "always", label: "Criar o projeto sempre" },
  { value: "never", label: "Nunca criar (só pelo botão na proposta)" },
];

interface ProjectSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EditableStage {
  key: string;
  name: string;
  checklist: string;
}

const toEditable = (stages: StageTemplate[]): EditableStage[] =>
  stages.map((s, i) => ({ key: `${i}-${s.name}`, name: s.name, checklist: s.checklist.join("\n") }));

/** Transforma o formulário no roteiro gravado: uma linha por item, sem linha vazia. */
export function toStageTemplate(stages: EditableStage[]): StageTemplate[] {
  return stages
    .map((s) => ({
      name: s.name.trim(),
      checklist: s.checklist
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    }))
    .filter((s) => s.name.length > 0);
}

/**
 * Configurações dos projetos, só para o administrador: criar o projeto sozinho
 * na aprovação e o roteiro de etapas com que toda obra nova nasce. Mudar o
 * roteiro não mexe nas obras que já existem.
 */
export function ProjectSettingsDialog({ open, onOpenChange }: ProjectSettingsDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [onApproval, setOnApproval] = React.useState<ProjectOnApproval>("ask");
  const [stages, setStages] = React.useState<EditableStage[]>([]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    ProjectsService.getSettings()
      .then((settings) => {
        if (cancelled) return;
        setOnApproval(settings.onApproval);
        setStages(toEditable(settings.stageTemplate));
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Erro ao carregar as configurações.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const patch = (index: number, change: Partial<EditableStage>) =>
    setStages((prev) => prev.map((s, i) => (i === index ? { ...s, ...change } : s)));

  const move = (index: number, delta: number) =>
    setStages((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });

  const template = toStageTemplate(stages);

  const save = async () => {
    setSaving(true);
    try {
      await ProjectsService.saveSettings({ onApproval, stageTemplate: template });
      toast.success("Configurações salvas. Valem para os próximos projetos.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar as configurações.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configurar projetos</DialogTitle>
          <DialogDescription>
            O roteiro de etapas vale para os próximos projetos; os que já existem não mudam.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-6">
            <div className="space-y-1.5 rounded-lg border p-4">
              <Label htmlFor="project-on-approval">Quando a proposta for aprovada</Label>
              <Select
                id="project-on-approval"
                value={onApproval}
                onChange={(e) => setOnApproval(e.target.value as ProjectOnApproval)}
                disableSort
              >
                {ON_APPROVAL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <p className="text-sm text-muted-foreground">
                Nem toda venda é obra: perguntando, quem só vende produto não ganha um projeto a
                cada aprovação.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold">Etapas</p>
              {stages.map((stage, index) => (
                <div key={stage.key} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={`Nome da etapa ${index + 1}`}
                      value={stage.name}
                      onChange={(e) => patch(index, { name: e.target.value })}
                      maxLength={80}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Subir etapa"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Descer etapa"
                      onClick={() => move(index, 1)}
                      disabled={index === stages.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      aria-label="Remover etapa"
                      onClick={() => setStages((prev) => prev.filter((_, i) => i !== index))}
                      disabled={stages.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    aria-label={`Checklist da etapa ${index + 1}`}
                    value={stage.checklist}
                    onChange={(e) => patch(index, { checklist: e.target.value })}
                    placeholder="Um item por linha"
                    className="min-h-[88px]"
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setStages((prev) => [...prev, { key: `new-${Date.now()}`, name: "", checklist: "" }])
                }
                disabled={stages.length >= 15}
              >
                <Plus className="mr-2 h-4 w-4" />
                Incluir etapa
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || loading || template.length === 0}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
