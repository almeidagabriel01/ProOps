"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FiscalGap } from "@/services/fiscal-service";

/**
 * Checklist do que falta para emitir.
 *
 * Vive separado do botão porque quem dispara a emissão nem sempre pode
 * hospedar o diálogo: no menu compacto o item é um `DropdownMenuItem`, e o
 * conteúdo do dropdown **desmonta ao fechar** (`if (!open) return null`) —
 * um Dialog renderizado lá dentro seria destruído junto com o menu, e o
 * checklist nunca apareceria. Aqui ele é montado pela página.
 */

/** Rótulo humano de cada área que o usuário precisa corrigir. */
const SCOPE_LABEL: Record<FiscalGap["scope"], string> = {
  emitente: "Dados da sua empresa",
  cliente: "Cadastro do cliente",
  produto: "Cadastro de produtos",
  servico: "Cadastro de serviços",
};

const SCOPE_HREF: Partial<Record<FiscalGap["scope"], string>> = {
  emitente: "/settings/fiscal",
  produto: "/products",
  servico: "/services",
};

interface FiscalGapsDialogProps {
  /** `null` mantém o diálogo fechado. */
  gaps: FiscalGap[] | null;
  onClose: () => void;
}

export function FiscalGapsDialog({ gaps, onClose }: FiscalGapsDialogProps) {
  // Agrupa por área para o usuário resolver uma tela de cada vez.
  const groupedGaps = React.useMemo(() => {
    if (!gaps) return [];
    const groups = new Map<FiscalGap["scope"], FiscalGap[]>();
    for (const gap of gaps) {
      const list = groups.get(gap.scope) ?? [];
      list.push(gap);
      groups.set(gap.scope, list);
    }
    return [...groups.entries()];
  }, [gaps]);

  return (
    <Dialog open={gaps !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Faltam dados para emitir
          </DialogTitle>
          <DialogDescription>
            Complete os itens abaixo e tente de novo. Nenhuma nota foi enviada.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto">
          {groupedGaps.map(([scope, scopeGaps]) => (
            <div key={scope} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{SCOPE_LABEL[scope]}</p>
                {SCOPE_HREF[scope] && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={SCOPE_HREF[scope]!}>
                      <Settings className="mr-1.5 h-3.5 w-3.5" />
                      Abrir
                    </Link>
                  </Button>
                )}
              </div>
              <ul className="flex flex-col gap-1.5">
                {scopeGaps.map((gap, index) => (
                  <li
                    key={`${gap.field}-${gap.entityId ?? index}`}
                    className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
                  >
                    {gap.message}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
