"use client";

import * as React from "react";
import { FileText, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { keepOpenOnOutsideClick } from "@/lib/field-service/service-orders";
import { ART_MAX_BYTES, COUNCIL_OPTIONS } from "@/lib/field-service/technical-responsibles";
import { toast } from "@/lib/toast";
import { TechnicalResponsiblesService } from "@/services/technical-responsibles-service";
import type { Council, TechnicalResponsible, TechnicalResponsibleInput } from "@/types/field-service";

interface TechnicalResponsibleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  responsible?: TechnicalResponsible | null;
  onSaved: () => void;
}

interface FormState {
  name: string;
  profession: string;
  council: Council;
  registryNumber: string;
  artNumber: string;
  artValidUntil: string;
  active: boolean;
}

function initial(responsible?: TechnicalResponsible | null): FormState {
  return {
    name: responsible?.name ?? "",
    profession: responsible?.profession ?? "",
    council: responsible?.council ?? "CREA",
    registryNumber: responsible?.registryNumber ?? "",
    artNumber: responsible?.artNumber ?? "",
    artValidUntil: responsible?.artValidUntil ?? "",
    active: responsible?.active ?? true,
  };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

/** Cadastro do responsável técnico, com o PDF da ART opcional. */
export function TechnicalResponsibleDialog({ open, onOpenChange, responsible, onSaved }: TechnicalResponsibleDialogProps) {
  const [form, setForm] = React.useState<FormState>(() => initial(responsible));
  const [file, setFile] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setForm(initial(responsible));
      setFile(null);
    }
  }, [open, responsible]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const valid =
    form.name.trim().length >= 3 && form.profession.trim().length >= 3 && form.registryNumber.trim().length >= 2;

  const pickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!picked) return;
    if (picked.type !== "application/pdf") {
      toast.error("Envie a ART em PDF.");
      return;
    }
    if (picked.size > ART_MAX_BYTES) {
      toast.error(`O PDF da ART pode ter até ${Math.round(ART_MAX_BYTES / 1024)} KB.`);
      return;
    }
    setFile(picked);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    const input: TechnicalResponsibleInput = {
      name: form.name.trim(),
      profession: form.profession.trim(),
      council: form.council,
      registryNumber: form.registryNumber.trim(),
      artNumber: form.artNumber.trim() || null,
      artValidUntil: form.artValidUntil || null,
      active: form.active,
    };
    try {
      let id = responsible?.id ?? null;
      if (id) await TechnicalResponsiblesService.update(id, input);
      else id = (await TechnicalResponsiblesService.create(input)).id;
      if (file) {
        try {
          await TechnicalResponsiblesService.uploadArt(id, await readAsDataUrl(file), file.name);
        } catch (error) {
          toast.error(
            error instanceof Error
              ? `Cadastro salvo, mas a ART não subiu: ${error.message}`
              : "Cadastro salvo, mas a ART não subiu.",
          );
        }
      }
      toast.success(responsible ? "Responsável técnico atualizado." : "Responsável técnico cadastrado.");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar o responsável técnico.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl" onInteractOutside={keepOpenOnOutsideClick}>
        <DialogHeader>
          <DialogTitle>{responsible ? "Editar responsável técnico" : "Novo responsável técnico"}</DialogTitle>
          <DialogDescription>
            Quem assina o PMOC: o registro no conselho e a ART, que precisa estar válida.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rtName">Nome</Label>
              <Input
                id="rtName"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                maxLength={120}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rtProfession">Profissão</Label>
              <Input
                id="rtProfession"
                value={form.profession}
                onChange={(e) => set("profession", e.target.value)}
                placeholder="Ex.: Engenheiro mecânico"
                maxLength={120}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rtCouncil">Conselho</Label>
              <Select
                id="rtCouncil"
                value={form.council}
                onChange={(e) => set("council", e.target.value as Council)}
                disableSort
                disabled={saving}
              >
                {COUNCIL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rtRegistry">Número do registro</Label>
              <Input
                id="rtRegistry"
                value={form.registryNumber}
                onChange={(e) => set("registryNumber", e.target.value)}
                placeholder="Ex.: SP-5061234567"
                maxLength={40}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rtArtNumber">Número da ART</Label>
              <Input
                id="rtArtNumber"
                value={form.artNumber}
                onChange={(e) => set("artNumber", e.target.value)}
                maxLength={40}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rtArtValidUntil">ART válida até</Label>
              <DatePicker
                id="rtArtValidUntil"
                name="rtArtValidUntil"
                value={form.artValidUntil}
                onChange={(e) => set("artValidUntil", e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>PDF da ART</Label>
            <input ref={fileInput} type="file" accept="application/pdf" className="hidden" onChange={pickFile} />
            <div className="flex flex-wrap items-center gap-2">
              {file ? (
                <span className="flex min-w-0 items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    aria-label="Tirar o arquivo"
                    onClick={() => setFile(null)}
                    className="text-muted-foreground hover:text-foreground"
                    disabled={saving}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </span>
              ) : responsible?.artFile ? (
                <a
                  href={responsible.artFile.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">{responsible.artFile.name}</span>
                </a>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={saving}>
                <Upload className="mr-2 h-4 w-4" />
                {responsible?.artFile || file ? "Trocar o PDF" : "Escolher o PDF"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Até {Math.round(ART_MAX_BYTES / 1024)} KB. Vai junto do plano PMOC do cliente.
            </p>
          </div>

          {responsible && (
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Ativo</p>
                <p className="text-xs text-muted-foreground">Desativado, não aparece para os contratos novos.</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(checked) => set("active", checked)} disabled={saving} />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !valid}>
              {saving && <Loader size="sm" variant="button" className="mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
