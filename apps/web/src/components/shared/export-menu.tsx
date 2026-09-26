"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/lib/toast";
import type { SheetFormat } from "@/lib/export/sheet";

interface ExportMenuProps {
  onExport: (format: SheetFormat) => Promise<void>;
  disabled?: boolean;
  className?: string;
  size?: "default" | "sm" | "lg";
}

/** "Exportar" com a escolha entre Excel (.xlsx) e CSV. */
export function ExportMenu({ onExport, disabled, className, size = "default" }: ExportMenuProps) {
  const [busy, setBusy] = React.useState(false);

  const run = async (format: SheetFormat) => {
    setBusy(true);
    try {
      await onExport(format);
    } catch {
      toast.error("Não foi possível gerar a planilha.", { title: "Erro ao exportar" });
    } finally {
      setBusy(false);
    }
  };

  return (
    // O wrapper interno do DropdownMenu tem mt-1, que desceria o botão em
    // relação aos vizinhos da linha, e é inline-block, que no celular
    // encolheria o botão em vez de ocupar a linha inteira.
    <div className={`[&>div]:mt-0 [&>div]:block sm:[&>div]:inline-block ${className ?? ""}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size={size} className="w-full gap-2 sm:w-auto" disabled={disabled || busy}>
            {busy ? <Loader size="sm" variant="button" /> : <Download className="h-4 w-4" />}
            Exportar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => void run("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
          <DropdownMenuItem onClick={() => void run("csv")}>CSV (.csv)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
