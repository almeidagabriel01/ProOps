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
      // Capture current selection to restore after reload
      // @ts-expect-error - luckysheet is a global object from FortuneSheet
      const currentSelection = window.luckysheet?.getRange?.()?.[0];

      // Force commit of active cell in FortuneSheet
      const fortuneInput = document.querySelector(
        'input[class*="luckysheet"], textarea[class*="luckysheet"], [contenteditable="true"]',
      ) as HTMLElement;

      if (fortuneInput) {
        fortuneInput.dispatchEvent(new Event("input", { bubbles: true }));
        fortuneInput.dispatchEvent(new Event("change", { bubbles: true }));
        fortuneInput.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            keyCode: 13,
            bubbles: true,
          }),
        );
        fortuneInput.blur();
      }

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      // Wait for FortuneSheet to commit the active cell
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const currentData = workbookRef.current?.getAllSheets() || [];

      if (!currentData || currentData.length === 0) {
        toast.error("Nenhum dado para salvar");
        return;
      }

      await SpreadsheetService.updateSpreadsheet(id, {
        name,
        data: currentData,
      });

      toast.success("Planilha salva com sucesso!");
      await loadSpreadsheet();

      // Restore selection after reload
      if (currentSelection) {
        setTimeout(() => {
          // @ts-expect-error - luckysheet is a global object from FortuneSheet
          window.luckysheet?.setRangeShow?.(currentSelection);
        }, 200);
      }
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
          onChange={() => {
            // onChange fires as data updates - workbookRef will have the latest state
            // No need to store separately as we query workbookRef on save
          }}
        />
      </div>
    </div>
  );
}
