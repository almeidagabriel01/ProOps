"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "@/lib/toast";
import { createUniver, LocaleType, mergeLocales } from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import UniverPresetSheetsCoreEsES from "@univerjs/preset-sheets-core/locales/es-ES";
import { SetCellEditVisibleOperation } from "@univerjs/sheets-ui";
import { localeCurrencySymbolMap } from "@univerjs/sheets-numfmt";
import { DeviceInputEventType } from "@univerjs/engine-render";
import "@univerjs/preset-sheets-core/lib/index.css";

import {
  Spreadsheet,
  SpreadsheetService,
} from "@/services/spreadsheet-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SpreadsheetEditorSkeleton } from "./_components/spreadsheet-editor-skeleton";
import {
  DEFAULT_SPREADSHEET_LOCALE,
  univerPtBrLocale,
} from "@/lib/univer-pt-br";
import { Loader } from "@/components/ui/loader";

type DisposableLike = {
  dispose?: () => void;
};

type UniverWorkbook = {
  getId?: () => string;
  save?: () => unknown;
};

type UniverEventRegistry = {
  CommandExecuted?: string;
  SheetEditChanging?: string;
  SheetEditEnded?: string;
};

type UniverEditorRuntime = {
  univerAPI?: {
    createWorkbook?: (data: Record<string, unknown>) => UniverWorkbook | undefined;
    getActiveWorkbook?: () => UniverWorkbook | undefined;
    executeCommand?: (
      id: string,
      params?: Record<string, unknown>,
    ) => Promise<unknown>;
    addEvent?: (
      event: string,
      callback: (params: unknown) => void,
    ) => DisposableLike;
    Event?: UniverEventRegistry;
  };
  dispose?: () => void;
  univer?: {
    dispose?: () => void;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const resolveSpreadsheetName = (nameInput: string, fallbackName: string): string => {
  const trimmed = nameInput.trim();
  return trimmed.length > 0 ? trimmed : fallbackName;
};

localeCurrencySymbolMap.set(LocaleType.ES_ES, "R$");

const buildBaseWorkbookData = (
  spreadsheet: Spreadsheet,
): Record<string, unknown> => {
  const workbookData = isRecord(spreadsheet.data) ? spreadsheet.data : {};
  const workbookName =
    typeof workbookData.name === "string" && workbookData.name.trim().length > 0
      ? workbookData.name
      : spreadsheet.name;

  return {
    ...workbookData,
    locale: DEFAULT_SPREADSHEET_LOCALE,
    name: workbookName,
  };
};

export default function SpreadsheetEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [spreadsheet, setSpreadsheet] = useState<Spreadsheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [editorBaseData, setEditorBaseData] =
    useState<Record<string, unknown> | null>(null);
  const [hasWorkbookChanges, setHasWorkbookChanges] = useState(false);
  const [hasLiveEditChanges, setHasLiveEditChanges] = useState(false);

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const univerRuntimeRef = useRef<UniverEditorRuntime | null>(null);
  const runtimeDisposablesRef = useRef<DisposableLike[]>([]);
  const ignoreWorkbookEventsRef = useRef(true);
  const persistedNameRef = useRef("");

  const spreadsheetId = spreadsheet?.id;
  const spreadsheetVersion = spreadsheet?.updatedAt ?? "";

  const disposeRuntimeListeners = useCallback(() => {
    runtimeDisposablesRef.current.forEach((disposable) => {
      try {
        disposable.dispose?.();
      } catch (error) {
        console.error("Error disposing Univer listener:", error);
      }
    });
    runtimeDisposablesRef.current = [];
  }, []);

  const commitActiveCellEdit = useCallback(async () => {
    const runtime = univerRuntimeRef.current;
    const univerAPI = runtime?.univerAPI;

    if (!univerAPI?.executeCommand) {
      return;
    }

    const activeWorkbook = univerAPI.getActiveWorkbook?.();
    const unitId = activeWorkbook?.getId?.();

    if (!unitId) {
      return;
    }

    try {
      await univerAPI.executeCommand(SetCellEditVisibleOperation.id, {
        visible: false,
        eventType: DeviceInputEventType.PointerDown,
        unitId,
      });
    } catch (error) {
      console.error("Error finalizing active cell edit:", error);
    }
  }, []);

  const loadSpreadsheet = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await SpreadsheetService.getSpreadsheetById(id);
      if (!data) {
        toast.error("Planilha não encontrada");
        router.push("/spreadsheets");
        return;
      }

      const baseData = buildBaseWorkbookData(data);
      const persistedName = resolveSpreadsheetName(data.name, data.name);

      persistedNameRef.current = persistedName;

      setSpreadsheet(data);
      setName(data.name);
      setEditorBaseData(baseData);
      setHasWorkbookChanges(false);
      setHasLiveEditChanges(false);
    } catch (error) {
      console.error("Error loading spreadsheet:", error);
      toast.error("Erro ao carregar planilha");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadSpreadsheet();
  }, [loadSpreadsheet]);

  const disposeEditor = useCallback(() => {
    disposeRuntimeListeners();

    const runtime = univerRuntimeRef.current;
    if (!runtime) return;

    try {
      if (typeof runtime.dispose === "function") {
        runtime.dispose();
      } else if (runtime.univer && typeof runtime.univer.dispose === "function") {
        runtime.univer.dispose();
      }
    } catch (error) {
      console.error("Error disposing Univer editor:", error);
    } finally {
      univerRuntimeRef.current = null;
      ignoreWorkbookEventsRef.current = true;
    }
  }, [disposeRuntimeListeners]);

  useEffect(() => {
    if (!spreadsheetId || !editorBaseData || !editorContainerRef.current) {
      return;
    }

    disposeEditor();

    try {
      const runtime = createUniver({
        locale: DEFAULT_SPREADSHEET_LOCALE as LocaleType,
        locales: {
          [DEFAULT_SPREADSHEET_LOCALE]: mergeLocales(
            UniverPresetSheetsCoreEsES,
            univerPtBrLocale,
          ),
        },
        presets: [
          UniverSheetsCorePreset({
            container: editorContainerRef.current,
          }),
        ],
      }) as unknown as UniverEditorRuntime;

      univerRuntimeRef.current = runtime;
      ignoreWorkbookEventsRef.current = true;

      const workbook = runtime.univerAPI?.createWorkbook?.(editorBaseData);
      if (!workbook) {
        throw new Error("Univer workbook instance unavailable");
      }

      const univerAPI = runtime.univerAPI;
      const eventRegistry = univerAPI?.Event;

      if (univerAPI?.addEvent && eventRegistry) {
        if (eventRegistry.CommandExecuted) {
          runtimeDisposablesRef.current.push(
            univerAPI.addEvent(eventRegistry.CommandExecuted, () => {
              if (!ignoreWorkbookEventsRef.current) {
                setHasWorkbookChanges(true);
              }
            }),
          );
        }

        if (eventRegistry.SheetEditChanging) {
          runtimeDisposablesRef.current.push(
            univerAPI.addEvent(eventRegistry.SheetEditChanging, () => {
              setHasLiveEditChanges(true);
            }),
          );
        }

        if (eventRegistry.SheetEditEnded) {
          runtimeDisposablesRef.current.push(
            univerAPI.addEvent(eventRegistry.SheetEditEnded, () => {
              setHasLiveEditChanges(false);
              if (!ignoreWorkbookEventsRef.current) {
                setHasWorkbookChanges(true);
              }
            }),
          );
        }
      }

      window.setTimeout(() => {
        ignoreWorkbookEventsRef.current = false;
      }, 0);
    } catch (error) {
      console.error("Error initializing Univer editor:", error);
      toast.error("Erro ao inicializar editor de planilha");
    }

    return () => {
      disposeEditor();
    };
  }, [
    spreadsheetId,
    spreadsheetVersion,
    editorBaseData,
    disposeEditor,
  ]);

  const handleSave = async () => {
    if (!id || !spreadsheet) return;
    setSaving(true);

    try {
      await commitActiveCellEdit();
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 0);
      });

      const activeWorkbook = univerRuntimeRef.current?.univerAPI?.getActiveWorkbook?.();
      const snapshot = activeWorkbook?.save?.();

      if (!isRecord(snapshot)) {
        toast.error("Nenhum dado para salvar");
        return;
      }

      const nextName = resolveSpreadsheetName(name, spreadsheet.name);
      const workbookSnapshot: Record<string, unknown> = {
        ...snapshot,
        locale: DEFAULT_SPREADSHEET_LOCALE,
        name: nextName,
      };

      await SpreadsheetService.updateSpreadsheet(id, {
        name: nextName,
        data: workbookSnapshot,
      });

      persistedNameRef.current = nextName;

      setName(nextName);
      setHasWorkbookChanges(false);
      setHasLiveEditChanges(false);
      setSpreadsheet((prev) =>
        prev
          ? {
              ...prev,
              name: nextName,
            }
          : prev,
      );

      toast.success("Planilha salva com sucesso!");
    } catch (error) {
      console.error("Error saving spreadsheet:", error);
      toast.error("Erro ao salvar planilha");
      await loadSpreadsheet();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <SpreadsheetEditorSkeleton />;
  }

  if (!spreadsheet) return null;

  const resolvedCurrentName = resolveSpreadsheetName(name, spreadsheet.name);
  const hasNameChanges = resolvedCurrentName !== persistedNameRef.current;
  const canSave =
    !saving && (hasNameChanges || hasWorkbookChanges || hasLiveEditChanges);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/spreadsheets")}
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex flex-col">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 w-64 font-medium border-transparent hover:border-input focus:border-input px-2 -ml-2 text-lg"
              placeholder="Nome da Planilha"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={!canSave} className="gap-2">
            {saving ? (
              <Loader size="sm" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-white">
        <div ref={editorContainerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
