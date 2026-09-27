"use client";

import * as React from "react";
import { Camera, CheckCircle2, Circle, Plus, Trash2, X } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { downscaleCatalogImage } from "@/lib/image-downscale";
import { ProjectsService } from "@/services/projects-service";
import type { ProjectStage, StageStatus } from "@/types/project";
import { STAGE_STATUS_LABELS } from "../_lib/projects";

/** Limite do backend para a foto já reduzida (`PHOTO_MAX_BYTES`). */
export const PHOTO_MAX_BYTES = 700 * 1024;

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler a foto."));
    reader.readAsDataURL(file);
  });
}

interface StageCardProps {
  projectId: string;
  stage: ProjectStage;
  index: number;
  canEdit: boolean;
  /** Marca ou desmarca o item. A tela mostra na hora; o servidor confirma depois. */
  onToggleItem: (itemId: string, done: boolean) => void;
  /** Troca a situação da etapa, também com resposta imediata. */
  onStageStatus: (status: StageStatus) => void;
}

/**
 * Uma etapa da obra. Tudo o que se grava aqui volta pelo listener do projeto,
 * então a tela não mantém cópia própria das etapas: o técnico marca o item no
 * celular e o escritório vê na hora.
 */
export function StageCard({ projectId, stage, index, canEdit, onToggleItem, onStageStatus }: StageCardProps) {
  const [newItem, setNewItem] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(0);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const done = stage.checklist.filter((i) => i.done).length;

  const run = async (key: string, action: () => Promise<unknown>, fallback: string) => {
    setBusy(key);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : fallback);
    } finally {
      setBusy(null);
    }
  };

  const addItem = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = newItem.trim();
    if (!text) return;
    await run("add", () => ProjectsService.addChecklistItem(projectId, stage.id, text), "Erro ao incluir o item.");
    setNewItem("");
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setUploading((n) => n + list.length);
    await Promise.all(
      list.map(async (file) => {
        try {
          const reduced = await downscaleCatalogImage(file);
          if (reduced.size > PHOTO_MAX_BYTES) {
            throw new Error(`"${file.name}" ficou grande demais mesmo reduzida. Tente outra foto.`);
          }
          await ProjectsService.uploadPhoto(projectId, stage.id, await fileToDataUrl(reduced));
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Erro ao enviar a foto.");
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <section
      aria-label={`Etapa ${index + 1}: ${stage.name}`}
      className={cn(
        "space-y-4 rounded-xl border bg-card p-4",
        stage.status === "done" && "border-emerald-500/40",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          {stage.status === "done" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
          )}
          <h3 className="truncate font-semibold">
            {index + 1}. {stage.name}
          </h3>
          <span className="shrink-0 text-xs text-muted-foreground">
            {done}/{stage.checklist.length}
          </span>
        </div>
        {canEdit ? (
          <Select
            aria-label={`Situação da etapa ${stage.name}`}
            value={stage.status}
            onChange={(e) => onStageStatus(e.target.value as StageStatus)}
            disableSort
            className="sm:w-44"
          >
            {(Object.keys(STAGE_STATUS_LABELS) as StageStatus[]).map((status) => (
              <option key={status} value={status}>
                {STAGE_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        ) : (
          <span className="text-sm text-muted-foreground">{STAGE_STATUS_LABELS[stage.status]}</span>
        )}
      </div>

      <ul className="space-y-2">
        {stage.checklist.map((item) => (
          <li key={item.id} className="flex items-center gap-3">
            <Checkbox
              checked={item.done}
              disabled={!canEdit}
              onCheckedChange={(checked) => onToggleItem(item.id, checked === true)}
              aria-label={item.text}
            />
            <span className={cn("min-w-0 flex-1 break-words text-sm", item.done && "text-muted-foreground line-through")}>
              {item.text}
            </span>
            {canEdit && (
              <button
                type="button"
                aria-label={`Remover "${item.text}"`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() =>
                  void run(
                    `del-${item.id}`,
                    () => ProjectsService.deleteChecklistItem(projectId, stage.id, item.id),
                    "Erro ao remover o item.",
                  )
                }
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
        {stage.checklist.length === 0 && (
          <li className="text-sm text-muted-foreground">Sem itens nesta etapa.</li>
        )}
      </ul>

      {canEdit && (
        <form onSubmit={addItem} className="flex gap-2">
          <Input
            aria-label={`Novo item da etapa ${stage.name}`}
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Novo item do checklist"
            maxLength={200}
          />
          <Button type="submit" variant="outline" disabled={!newItem.trim() || busy === "add"}>
            <Plus className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Incluir</span>
          </Button>
        </form>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Fotos</p>
          {canEdit && (
            <>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                aria-label={`Enviar fotos da etapa ${stage.name}`}
                onChange={(e) => void uploadFiles(e.target.files)}
              />
              <Button type="button" size="sm" variant="outline" onClick={() => fileInput.current?.click()} disabled={uploading > 0}>
                {uploading > 0 ? <Loader size="sm" variant="button" /> : <Camera className="mr-2 h-4 w-4" />}
                {uploading > 0 ? `Enviando ${uploading}...` : "Adicionar fotos"}
              </Button>
            </>
          )}
        </div>
        {stage.photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma foto nesta etapa.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {stage.photos.map((photo) => (
              <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
                <a href={photo.url} target="_blank" rel="noopener noreferrer" aria-label={photo.caption || "Abrir foto"}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={photo.caption || `Foto da etapa ${stage.name}`} className="h-full w-full object-cover" loading="lazy" />
                </a>
                {canEdit && (
                  <button
                    type="button"
                    aria-label="Excluir foto"
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-100 md:opacity-0 md:group-hover:opacity-100"
                    onClick={() =>
                      void run(
                        `photo-${photo.id}`,
                        () => ProjectsService.deletePhoto(projectId, stage.id, photo.id),
                        "Erro ao excluir a foto.",
                      )
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
