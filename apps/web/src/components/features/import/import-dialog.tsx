"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { Select } from "@/components/ui/select";
import { usePermissions } from "@/providers/permissions-provider";
import { cn } from "@/lib/utils";
import { downloadSheet } from "@/lib/export/sheet";
import { IMPORT_ACCEPT, MAX_IMPORT_ROWS, readSheetFile, type SheetData } from "@/lib/import/read-sheet";
import {
  autoMap,
  buildImportRows,
  validateLocally,
  type ImportField,
  type ImportKind,
  type ImportRow,
} from "@/lib/import/import-fields";
import { runImport, type ImportRowReport } from "@/services/import-service";

interface ImportDialogProps {
  kind: ImportKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "contato" / "contatos" */
  noun: { singular: string; plural: string };
  fields: ImportField[];
  allowPerMeter?: boolean;
  onImported: () => void;
}

type Step = "file" | "map" | "preview" | "done";

const STATUS_STYLE = {
  ok: "text-emerald-700 dark:text-emerald-400",
  duplicate: "text-amber-700 dark:text-amber-400",
  error: "text-destructive",
} as const;

const MAX_PREVIEW = 300;

function plural(n: number, noun: { singular: string; plural: string }) {
  return `${n} ${n === 1 ? noun.singular : noun.plural}`;
}

/**
 * Importar por planilha em três passos: o arquivo (com o modelo para baixar),
 * a ligação das colunas (feita sozinha pelo nome, ajustável) e a prévia, que
 * marca o que entra, o que é repetido e o que tem erro antes de gravar.
 */
export function ImportDialog({ kind, open, onOpenChange, noun, fields, allowPerMeter, onImported }: ImportDialogProps) {
  const { isDemo } = usePermissions();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [step, setStep] = React.useState<Step>("file");
  const [sheet, setSheet] = React.useState<SheetData | null>(null);
  const [fileName, setFileName] = React.useState("");
  const [mapping, setMapping] = React.useState<Record<string, number>>({});
  const [rows, setRows] = React.useState<ImportRow[]>([]);
  const [reports, setReports] = React.useState<ImportRowReport[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState(0);
  const [onlyProblems, setOnlyProblems] = React.useState(false);

  React.useEffect(() => {
    if (open) return;
    setStep("file");
    setSheet(null);
    setFileName("");
    setRows([]);
    setReports([]);
    setError(null);
    setCreated(0);
    setOnlyProblems(false);
  }, [open]);

  const downloadTemplate = () =>
    downloadSheet({
      format: "xlsx",
      fileName: `modelo-${noun.plural}`,
      sheetName: noun.plural,
      columns: fields.map((f) => ({ header: f.required ? `${f.label}*` : f.label, key: f.key, width: 24, kind: "text" as const })),
      rows: [Object.fromEntries(fields.map((f) => [f.key, f.example]))],
    });

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const data = await readSheetFile(file);
      if (data.rows.length === 0) {
        setError("A planilha não tem linhas depois do cabeçalho.");
        return;
      }
      if (data.rows.length > MAX_IMPORT_ROWS) {
        setError(`A planilha tem ${data.rows.length} linhas. Importe até ${MAX_IMPORT_ROWS} por vez.`);
        return;
      }
      setSheet(data);
      setFileName(file.name);
      setMapping(autoMap(data.headers, fields));
      setStep("map");
    } catch {
      setError("Não foi possível ler o arquivo. Use .xlsx ou .csv.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const missingRequired = fields.filter((f) => f.required && (mapping[f.key] ?? -1) < 0);

  const preview = async () => {
    if (!sheet) return;
    const built = buildImportRows(sheet.rows, mapping);
    setRows(built);
    setError(null);
    if (isDemo) {
      setReports(
        built.map((row, index) => {
          const problem = validateLocally(kind, row);
          return problem ? { index, status: "error" as const, message: problem } : { index, status: "ok" as const };
        }),
      );
      setStep("preview");
      return;
    }
    setBusy(true);
    try {
      const outcome = await runImport(kind, built, { dryRun: true, allowPerMeter });
      setReports(outcome.reports);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível conferir a planilha.");
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    setBusy(true);
    setError(null);
    try {
      const outcome = await runImport(kind, rows, { dryRun: false, allowPerMeter });
      setReports(outcome.reports);
      setCreated(outcome.created);
      setStep("done");
      if (outcome.created > 0) onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível importar.");
    } finally {
      setBusy(false);
    }
  };

  const counts = {
    ok: reports.filter((r) => r.status === "ok").length,
    duplicate: reports.filter((r) => r.status === "duplicate").length,
    error: reports.filter((r) => r.status === "error").length,
  };
  const nameOf = (index: number) => rows[index]?.name || `Linha ${index + 2}`;
  const visible = reports.filter((r) => !onlyProblems || r.status !== "ok").slice(0, MAX_PREVIEW);

  return (
    <Dialog open={open} onOpenChange={(value) => !busy && onOpenChange(value)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar {noun.plural}</DialogTitle>
          <DialogDescription>
            {step === "file" && "Suba a planilha que você já tem, em .xlsx ou .csv, ou preencha o modelo."}
            {step === "map" && `${fileName}: confira de qual coluna sai cada informação.`}
            {step === "preview" && "Confira antes de gravar. Repetidos e linhas com erro ficam de fora."}
            {step === "done" && "Importação concluída."}
          </DialogDescription>
        </DialogHeader>

        {step === "file" && (
          <div className="space-y-4">
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>A primeira linha precisa ter o nome das colunas.</li>
              <li>
                Obrigatório: {fields.filter((f) => f.required).map((f) => f.label).join(" e ")}. O resto é opcional.
              </li>
              {kind === "clients" && <li>Contato com CPF/CNPJ, e-mail ou telefone que já existe fica de fora.</li>}
              {kind !== "clients" && <li>{noun.singular[0].toUpperCase() + noun.singular.slice(1)} com o mesmo nome de um que já existe fica de fora.</li>}
              <li>Até {MAX_IMPORT_ROWS} linhas por vez.</li>
            </ul>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => void downloadTemplate()}>
                <Download className="mr-2 h-4 w-4" />
                Baixar modelo
              </Button>
              <Button type="button" onClick={() => fileRef.current?.click()} disabled={busy}>
                {busy ? <Loader size="sm" variant="button" className="mr-2" /> : <Upload className="mr-2 h-4 w-4" />}
                Escolher planilha
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept={IMPORT_ACCEPT}
                className="hidden"
                aria-label="Planilha para importar"
                onChange={(e) => void pickFile(e.target.files?.[0])}
              />
            </div>
          </div>
        )}

        {step === "map" && sheet && (
          <div className="space-y-4">
            <ul className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
              {fields.map((field) => {
                const index = mapping[field.key] ?? -1;
                const sample = index >= 0 ? sheet.rows.find((r) => r[index])?.[index] : "";
                return (
                  <li key={field.key} className="grid gap-1.5 sm:grid-cols-[10rem_1fr] sm:items-center">
                    <Label htmlFor={`map-${field.key}`}>
                      {field.label}
                      {field.required && <span className="text-destructive"> *</span>}
                    </Label>
                    <div className="min-w-0 space-y-1">
                      <Select
                        id={`map-${field.key}`}
                        value={String(index)}
                        onChange={(e) => setMapping({ ...mapping, [field.key]: Number(e.target.value) })}
                        disableSort
                      >
                        <option value="-1">Não importar</option>
                        {sheet.headers.map((header, i) => (
                          <option key={i} value={i}>
                            {header || `Coluna ${i + 1}`}
                          </option>
                        ))}
                      </Select>
                      {sample && <p className="truncate text-xs text-muted-foreground">Ex.: {sample}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
            {missingRequired.length > 0 && (
              <p className="text-sm text-destructive">
                Escolha a coluna de {missingRequired.map((f) => f.label).join(" e ")}.
              </p>
            )}
            <div className="flex justify-between gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep("file")} disabled={busy}>
                Voltar
              </Button>
              <Button type="button" onClick={() => void preview()} disabled={busy || missingRequired.length > 0}>
                {busy && <Loader size="sm" variant="button" className="mr-2" />}
                Ver prévia
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className={STATUS_STYLE.ok}>{plural(counts.ok, noun)} para importar</span>
              {counts.duplicate > 0 && <span className={STATUS_STYLE.duplicate}>{counts.duplicate} repetidos</span>}
              {counts.error > 0 && <span className={STATUS_STYLE.error}>{counts.error} com erro</span>}
            </div>
            {isDemo && (
              <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                Na conta de demonstração a prévia confere só o formato. Os repetidos aparecem quando a conta é sua.
              </p>
            )}
            {(counts.duplicate > 0 || counts.error > 0) && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />
                Mostrar só as que ficam de fora
              </label>
            )}
            <ul className="max-h-[40vh] divide-y overflow-y-auto rounded-lg border">
              {visible.map((report) => (
                <li key={report.index} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="text-muted-foreground">{report.index + 2}.</span> {nameOf(report.index)}
                  </span>
                  <span className={cn("shrink-0 text-right", STATUS_STYLE[report.status])}>
                    {report.status === "ok" ? "Pronto" : report.message}
                  </span>
                </li>
              ))}
            </ul>
            {reports.length > MAX_PREVIEW && (
              <p className="text-xs text-muted-foreground">Mostrando as {MAX_PREVIEW} primeiras linhas.</p>
            )}
            {isDemo ? (
              <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span>Para importar os seus {noun.plural}, assine um plano.</span>
                <Button asChild size="sm">
                  <Link href="/subscribe">Ver planos</Link>
                </Button>
              </div>
            ) : (
              <div className="flex justify-between gap-2">
                <Button type="button" variant="ghost" onClick={() => setStep("map")} disabled={busy}>
                  Voltar
                </Button>
                <Button type="button" onClick={() => void commit()} disabled={busy || counts.ok === 0}>
                  {busy && <Loader size="sm" variant="button" className="mr-2" />}
                  Importar {plural(counts.ok, noun)}
                </Button>
              </div>
            )}
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <p className="text-lg font-semibold">{plural(created, noun)} importados.</p>
            {counts.duplicate + counts.error > 0 && (
              <p className="text-sm text-muted-foreground">
                {counts.duplicate > 0 && `${counts.duplicate} repetidos`}
                {counts.duplicate > 0 && counts.error > 0 && " e "}
                {counts.error > 0 && `${counts.error} com erro`} ficaram de fora.
              </p>
            )}
            <Button type="button" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        )}

        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** O botão "Importar" das telas de cadastro. */
export function ImportButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button type="button" variant="outline" size="lg" className={cn("w-full gap-2 sm:w-auto", className)} onClick={onClick}>
      <FileSpreadsheet className="h-5 w-5" />
      Importar
    </Button>
  );
}
