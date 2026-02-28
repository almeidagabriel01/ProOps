"use client";

import * as React from "react";
import { ProposalStatus } from "@/types/proposal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// ============================================
// COLOR PALETTE
// ============================================

const COLOR_PRESETS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f97316", // orange
  "#ec4899", // pink
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#94a3b8", // slate
  "#84cc16", // lime
];

// ============================================
// STATUS OPTIONS
// ============================================

const PROPOSAL_STATUS_OPTIONS: { value: ProposalStatus; label: string }[] = [
  { value: "draft", label: "Rascunho" },
  { value: "in_progress", label: "Em Aberto" },
  { value: "sent", label: "Enviada" },
  { value: "approved", label: "Aprovada" },
  { value: "rejected", label: "Rejeitada" },
];

// ============================================
// DIALOG
// ============================================

interface KanbanStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    label: string;
    color: string;
    mappedStatus: ProposalStatus;
  }) => void;
  initialData?: {
    label: string;
    color: string;
    mappedStatus: ProposalStatus;
  };
  isSaving?: boolean;
}

export function KanbanStatusDialog({
  open,
  onOpenChange,
  onSave,
  initialData,
  isSaving = false,
}: KanbanStatusDialogProps) {
  const [label, setLabel] = React.useState(initialData?.label ?? "");
  const [color, setColor] = React.useState(
    initialData?.color ?? COLOR_PRESETS[0],
  );
  const [mappedStatus, setMappedStatus] = React.useState<ProposalStatus>(
    initialData?.mappedStatus ?? "in_progress",
  );

  const isEditing = !!initialData;

  // Reset when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      setLabel(initialData?.label ?? "");
      setColor(initialData?.color ?? COLOR_PRESETS[0]);
      setMappedStatus(initialData?.mappedStatus ?? "in_progress");
    }
  }, [open, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    onSave({ label: label.trim(), color, mappedStatus });
  };

  const canSubmit = label.trim().length > 0 && !isSaving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Coluna" : "Nova Coluna"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Edite o nome, cor e status mapeado desta coluna."
              : "Crie uma nova coluna para o seu Kanban de propostas."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Label */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Nome da Coluna
            </label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Em Negociação"
              autoFocus
              maxLength={40}
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Cor</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-8 h-8 rounded-lg transition-all duration-150 border-2",
                    color === c
                      ? "border-foreground scale-110 shadow-md"
                      : "border-transparent hover:scale-105 hover:border-border",
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Mapped Status */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Status Mapeado
            </label>
            <p className="text-xs text-muted-foreground">
              Ao arrastar uma proposta para esta coluna, ela receberá o status
              selecionado.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {PROPOSAL_STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMappedStatus(option.value)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 border",
                    mappedStatus === option.value
                      ? "bg-primary/10 border-primary/40 text-primary shadow-sm"
                      : "bg-card border-border/40 text-muted-foreground hover:bg-muted/60 hover:border-border",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Pré-visualização
            </label>
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border border-border/30">
              <div
                className="w-3 h-3 rounded-full ring-2 ring-white/20 shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm font-semibold text-foreground">
                {label || "Nome da coluna"}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                →{" "}
                {
                  PROPOSAL_STATUS_OPTIONS.find((o) => o.value === mappedStatus)
                    ?.label
                }
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
