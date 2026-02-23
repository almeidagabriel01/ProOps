"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { createUniver, LocaleType, mergeLocales } from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import UniverPresetSheetsCoreEnUS from "@univerjs/preset-sheets-core/locales/en-US";
import { SetCellEditVisibleOperation } from "@univerjs/sheets-ui";
import { DeviceInputEventType } from "@univerjs/engine-render";
import "@univerjs/preset-sheets-core/lib/index.css";

import {
  Spreadsheet,
  SpreadsheetService,
} from "@/services/spreadsheet-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SpreadsheetEditorSkeleton } from "./_components/spreadsheet-editor-skeleton";

type UniverWorkbookSnapshot = Record<string, unknown>;

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
    createWorkbook?: (data: UniverWorkbookSnapshot) => UniverWorkbook | undefined;
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

const normalizeForSignature = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForSignature(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  const normalized: Record<string, unknown> = {};
  const sortedEntries = Object.entries(value).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  sortedEntries.forEach(([key, item]) => {
    normalized[key] = normalizeForSignature(item);
  });

  return normalized;
};

const createWorkbookSignature = (
  snapshot: UniverWorkbookSnapshot,
  workbookName: string,
): string => {
  const signaturePayload: UniverWorkbookSnapshot = {
    ...snapshot,
    name: workbookName,
  };

  return JSON.stringify(normalizeForSignature(signaturePayload));
};

const buildBaseWorkbookData = (
  spreadsheet: Spreadsheet,
): UniverWorkbookSnapshot => {
  const workbookData = isRecord(spreadsheet.data) ? spreadsheet.data : {};
  const workbookName =
    typeof workbookData.name === "string" && workbookData.name.trim().length > 0
      ? workbookData.name
      : spreadsheet.name;

  return {
    ...workbookData,
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
    useState<UniverWorkbookSnapshot | null>(null);
  const [hasWorkbookChanges, setHasWorkbookChanges] = useState(false);
  const [hasLiveEditChanges, setHasLiveEditChanges] = useState(false);

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const univerRuntimeRef = useRef<UniverEditorRuntime | null>(null);
  const runtimeDisposablesRef = useRef<DisposableLike[]>([]);
  const dirtyCheckTimeoutRef = useRef<number | null>(null);
  const savedWorkbookSignatureRef = useRef<string | null>(null);
  const persistedNameRef = useRef("");

  const spreadsheetId = spreadsheet?.id;
  const spreadsheetVersion = spreadsheet?.updatedAt ?? "";

  const clearScheduledDirtyCheck = useCallback(() => {
    if (dirtyCheckTimeoutRef.current !== null) {
      window.clearTimeout(dirtyCheckTimeoutRef.current);
      dirtyCheckTimeoutRef.current = null;
    }
  }, []);

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

  const getCurrentWorkbookSnapshot = useCallback((): UniverWorkbookSnapshot | null => {
    const activeWorkbook = univerRuntimeRef.current?.univerAPI?.getActiveWorkbook?.();
    const snapshot = activeWorkbook?.save?.();
    return isRecord(snapshot) ? snapshot : null;
  }, []);

  const refreshWorkbookDirtyState = useCallback(() => {
    const savedSignature = savedWorkbookSignatureRef.current;
    const snapshot = getCurrentWorkbookSnapshot();

    if (!savedSignature || !snapshot) {
      setHasWorkbookChanges(false);
      return;
    }

    const currentSignature = createWorkbookSignature(
      snapshot,
      persistedNameRef.current,
    );
    setHasWorkbookChanges(currentSignature !== savedSignature);
  }, [getCurrentWorkbookSnapshot]);

  const scheduleWorkbookDirtyCheck = useCallback(() => {
    if (dirtyCheckTimeoutRef.current !== null) {
      return;
    }

    dirtyCheckTimeoutRef.current = window.setTimeout(() => {
      dirtyCheckTimeoutRef.current = null;
      refreshWorkbookDirtyState();
    }, 0);
  }, [refreshWorkbookDirtyState]);

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
        toast.error("Planilha nao encontrada");
        router.push("/spreadsheets");
        return;
      }

      const baseData = buildBaseWorkbookData(data);
      const persistedName = resolveSpreadsheetName(data.name, data.name);

      persistedNameRef.current = persistedName;
      savedWorkbookSignatureRef.current = createWorkbookSignature(
        baseData,
        persistedName,
      );

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
    clearScheduledDirtyCheck();

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
    }
  }, [clearScheduledDirtyCheck, disposeRuntimeListeners]);

  useEffect(() => {
    if (!spreadsheetId || !editorBaseData || !editorContainerRef.current) {
      return;
    }

    disposeEditor();

    try {
      const runtime = createUniver({
        locale: LocaleType.EN_US,
        locales: {
          [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS),
        },
        presets: [
          UniverSheetsCorePreset({
            container: editorContainerRef.current,
          }),
        ],
      }) as unknown as UniverEditorRuntime;

      univerRuntimeRef.current = runtime;

      const workbook = runtime.univerAPI?.createWorkbook?.(editorBaseData);
      if (!workbook) {
        throw new Error("Univer workbook instance unavailable");
      }

      const runtimeSnapshot = workbook.save?.();
      if (isRecord(runtimeSnapshot)) {
        savedWorkbookSignatureRef.current = createWorkbookSignature(
          runtimeSnapshot,
          persistedNameRef.current,
        );
      }

      const univerAPI = runtime.univerAPI;
      const eventRegistry = univerAPI?.Event;

      if (univerAPI?.addEvent && eventRegistry) {
        if (eventRegistry.CommandExecuted) {
          runtimeDisposablesRef.current.push(
            univerAPI.addEvent(eventRegistry.CommandExecuted, () => {
              scheduleWorkbookDirtyCheck();
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
              scheduleWorkbookDirtyCheck();
            }),
          );
        }
      }
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
    scheduleWorkbookDirtyCheck,
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
        name: nextName,
      };

      await SpreadsheetService.updateSpreadsheet(id, {
        name: nextName,
        data: workbookSnapshot,
      });

      savedWorkbookSignatureRef.current = createWorkbookSignature(
        workbookSnapshot,
        nextName,
      );
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
              <Loader2 className="w-4 h-4 animate-spin" />
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
