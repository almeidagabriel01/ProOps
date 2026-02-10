"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { Workbook } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";

import {
  Spreadsheet,
  SpreadsheetService,
} from "@/services/spreadsheet-service";
import { WorkbookInstance } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export default function SpreadsheetEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [spreadsheet, setSpreadsheet] = useState<Spreadsheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  // Ref for the Workbook to access data (single source of truth)
  const workbookRef = useRef<WorkbookInstance>(null);

  // Memoize data to prevent re-renders of the heavy Workbook component
  // MUST BE CALLED BEFORE CONDITIONAL RETURNS
  const workbookData = useMemo(() => {
    return spreadsheet && spreadsheet.data && spreadsheet.data.length > 0
      ? spreadsheet.data
      : [{ name: "Sheet1", celldata: [], status: 1 }]; // Ensure valid initial structure
  }, [spreadsheet]); // Only re-create if spreadsheet object changes (which only happens on load)

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
      setSpreadsheet(data);
      setName(data.name);
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

  const handleSave = async () => {
    if (!id || !spreadsheet) return;
    setSaving(true);

    try {
      // Commit the active editing cell before saving.
      // FortuneSheet keeps the editing text in a contenteditable DOM element
      // (`luckysheet-rich-text-editor`) until the user presses Enter or moves
      // to another cell. We read the editing value from the DOM, then patch
      // it directly into the data returned by getAllSheets() — this avoids
      // any async React state timing issues with the setCellValue API.
      let editingRow: number | null = null;
      let editingCol: number | null = null;
      let editingValue: string | null = null;

      const richTextEditor = document.getElementById(
        "luckysheet-rich-text-editor",
      );
      if (richTextEditor && workbookRef.current) {
        const text = richTextEditor.innerText;
        const selection = workbookRef.current.getSelection();
        if (selection && selection.length > 0 && text) {
          editingRow = selection[0].row[0];
          editingCol = selection[0].column[0];
          editingValue = text;
        }
      }

      // Blur to exit edit mode visually
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      // Deep clone because getAllSheets() returns immer-frozen (read-only) data
      const currentData = structuredClone(
        workbookRef.current?.getAllSheets() || [],
      );

      if (!currentData || currentData.length === 0) {
        toast.error("Nenhum dado para salvar");
        return;
      }

      // Patch the editing cell's value into the sheet data.
      // getAllSheets() doesn't include uncommitted edits, so we write
      // the value directly into the active sheet's 2D data array.
      if (editingRow !== null && editingCol !== null && editingValue !== null) {
        const activeSheet = currentData.find(
          (s: { status?: number }) => s.status === 1,
        );
        if (activeSheet?.data) {
          // Ensure the row array exists
          if (!activeSheet.data[editingRow]) {
            activeSheet.data[editingRow] = [];
          }
          // Ensure the cell object exists
          const existingCell = activeSheet.data[editingRow][editingCol];
          if (existingCell && typeof existingCell === "object") {
            existingCell.v = editingValue;
            existingCell.m = editingValue;
          } else {
            activeSheet.data[editingRow][editingCol] = {
              v: editingValue,
              m: editingValue,
              ct: { fa: "General", t: "g" },
            };
          }
        }
      }

      // Capture current selection to restore after reload
      const currentSelection = workbookRef.current?.getSelection();

      await SpreadsheetService.updateSpreadsheet(id, {
        name,
        data: currentData,
      });

      // If the editing cell was patched, also commit it into FortuneSheet's
      // internal state so the UI reflects the saved value without reloading.
      if (
        editingRow !== null &&
        editingCol !== null &&
        editingValue !== null &&
        workbookRef.current
      ) {
        workbookRef.current.setCellValue(editingRow, editingCol, editingValue);
      }

      toast.success("Planilha salva com sucesso!");

      // Restore selection (blur may have cleared it)
      if (currentSelection && currentSelection.length > 0) {
        setTimeout(() => {
          workbookRef.current?.setSelection(currentSelection);
        }, 50);
      }
    } catch (error) {
      console.error("Error saving spreadsheet:", error);
      toast.error("Erro ao salvar planilha");
      // Reload from server to revert any uncommitted changes
      await loadSpreadsheet();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!spreadsheet) return null;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
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
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      {/* Spreadsheet Component */}
      {/* Force text-black to ensure inputs are visible if using light theme spreadsheet in dark mode app */}
      <div className="flex-1 overflow-hidden text-black">
        <Workbook
          key={spreadsheet.id}
          ref={workbookRef}
          data={workbookData}
          onChange={() => {
            // onChange fires as data updates - workbookRef will have the latest state
            // No need to store separately as we query workbookRef on save
          }}
        />
      </div>
    </div>
  );
}
