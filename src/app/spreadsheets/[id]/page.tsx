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
import { SheetData, WorkbookInstance } from "@/types";
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

  // Ref for the Workbook to access data
  const workbookRef = useRef<WorkbookInstance>(null);
  // Ref to store current data directly from onChange to ensure we don't miss updates
  const dataRef = useRef<SheetData[]>([]);

  // Memoize data to prevent re-renders of the heavy Workbook component
  // MUST BE CALLED BEFORE CONDITIONAL RETURNS
  const workbookData = useMemo(() => {
    return spreadsheet && spreadsheet.data && spreadsheet.data.length > 0
      ? spreadsheet.data
      : [{ name: "Sheet1", celldata: [], status: 1 }]; // Ensure valid initial structure
  }, [spreadsheet]); // Only re-create if spreadsheet object changes (which only happens on load)

  // Sync dataRef with initial loaded data so if we save without editing, we don't lose data
  useEffect(() => {
    if (spreadsheet?.data && spreadsheet.data.length > 0) {
      dataRef.current = spreadsheet.data;
    } else {
      dataRef.current = [{ name: "Sheet1", celldata: [], status: 1 }];
    }
  }, [spreadsheet]);

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
      // DEBUG: Check ref state
      console.log(
        "Debug Save: Starting save process. Ref exists?",
        !!workbookRef.current,
      );

      // Force commit of any active edit by blurring the inputs
      if (document.activeElement instanceof HTMLElement) {
        console.log("Debug Save: Triggering blur on active element");
        document.activeElement.blur();
      }

      // VITAL: Wait for the blur event to propagate and FortuneSheet to update its internal model
      // React state updates and event loops can be async.
      console.log("Debug Save: Waiting for valid state...");
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log("Debug Save: Reading data now.");

      // Probe cells to see if Ref is alive and looking at the right data
      try {
        const cell00 = workbookRef.current?.getCellValue(0, 0);
        const cell01 = workbookRef.current?.getCellValue(0, 1);
        console.log("Debug Save Probe (0,0):", JSON.stringify(cell00));
        console.log("Debug Save Probe (0,1):", JSON.stringify(cell01));
      } catch (e) {
        console.error("Debug Save Probe Failed:", e);
      }

      // 1. Get data from onChange ref
      const onChangeData = dataRef.current;

      // 2. Get data from Workbook ref
      // We re-query the ref AFTER the delay
      const workbookRefData = workbookRef.current?.getAllSheets() || [];
      console.log("Debug Save: workbookRefData (raw):", workbookRefData);

      // Helper to count populated cells
      const countCells = (sheets: SheetData[]) => {
        if (!sheets || !Array.isArray(sheets)) return 0;
        let count = 0;
        sheets.forEach((sheet) => {
          if (sheet.data && Array.isArray(sheet.data)) {
            sheet.data.forEach((row) => {
              if (Array.isArray(row)) {
                row.forEach((cell) => {
                  if (cell !== null && cell !== undefined) count++;
                });
              }
            });
          } else if (sheet.celldata && Array.isArray(sheet.celldata)) {
            // Also count celldata if present (initial state often uses this)
            count += sheet.celldata.length;
          }
        });
        return count;
      };

      const onChangeCount = countCells(onChangeData);
      const workbookCount = countCells(workbookRefData);

      console.log(
        `Debug Save: onChangeCells=${onChangeCount}, workbookRefCells=${workbookCount}`,
      );

      // Choose the best data source (prefer workbookRef if equal, as it's the source of truth)
      let finalData = [];
      if (workbookCount >= onChangeCount && workbookCount > 0) {
        finalData = workbookRefData;
        console.log("Debug Save: Using WorkbookRef data");
      } else if (onChangeCount > 0) {
        finalData = onChangeData;
        console.log("Debug Save: Using onChange data (fallback)");
      } else {
        // Both empty? try to fallback to existing spreadsheet data if we have it?
        // No, if user cleared it, we should save clear.
        // But if it's an error, we risk data loss.
        // For now, save whatever we have.
        finalData = workbookRefData || onChangeData || [];
        console.warn("Debug Save: Both sources appear empty!");
      }

      await SpreadsheetService.updateSpreadsheet(id, {
        name,
        data: finalData,
      });
      toast.success("Planilha salva com sucesso!");

      // Reload to confirm data is persistent and update state
      await loadSpreadsheet();
    } catch (error) {
      console.error("Error saving spreadsheet:", error);
      toast.error("Erro ao salvar planilha");
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
          onChange={(d: SheetData[]) => {
            // Capture every change
            dataRef.current = d;
            // DEBUG: Find where the data is!
            if (d && d[0]) {
              console.log(
                "JSS OnChange Update. Sheet 0 Keys:",
                Object.keys(d[0]),
              );
              console.log(
                "JSS OnChange Celldata Length:",
                d[0].celldata?.length,
              );
              const firstRow = d[0].data?.[0];
              if (Array.isArray(firstRow)) {
                // Log non-null cells in first row
                const filled = firstRow.filter((c) => c !== null);
                console.log(
                  `JSS OnChange Row 0: ${firstRow.length} cells, ${filled.length} filled.`,
                );
                if (filled.length > 0) console.log("Sample cell:", filled[0]);
              } else {
                console.log("JSS OnChange: Sheet 0 has no 'data' array.");
              }
            }
          }}
        />
      </div>
    </div>
  );
}
