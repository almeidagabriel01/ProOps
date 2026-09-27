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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { ProjectsService } from "@/services/projects-service";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (projectId: string) => void;
}

/**
 * Projeto avulso: garantia, manutenção, visita técnica. O projeto de uma venda
 * nasce sozinho quando a proposta é aprovada (ou pelo botão na proposta).
 */
export function NewProjectDialog({ open, onOpenChange, onCreated }: NewProjectDialogProps) {
  const [title, setTitle] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setTitle("");
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (title.trim().length < 2) return;
    setSaving(true);
    try {
      const { projectId } = await ProjectsService.create({ title: title.trim() });
      toast.success("Projeto criado.");
      onOpenChange(false);
      onCreated(projectId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar o projeto.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo projeto</DialogTitle>
          <DialogDescription>
            Para uma obra sem proposta, como garantia ou manutenção. O projeto de uma
            venda nasce sozinho quando a proposta é aprovada.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-project-title">Nome do projeto</Label>
            <Input
              id="new-project-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Garantia do home theater"
              maxLength={160}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || title.trim().length < 2}>
              {saving ? "Criando..." : "Criar projeto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
