"use client";

import * as React from "react";
import { CheckCircle2, FileSpreadsheet, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface BulkActionsBarProps {
  selectedCount: number;
  /** Quantos dos selecionados ainda não estão pagos. */
  payableCount: number;
  /** Quantos podem ser excluídos daqui (sem os de proposta). */
  deletableCount: number;
  /** Quantos ficam de fora da exclusão por serem de proposta. */
  skippedProposalCount: number;
  canEdit: boolean;
  canDelete: boolean;
  isBusy: boolean;
  onMarkPaid: () => Promise<void>;
  onExport: () => Promise<void>;
  onDelete: () => void;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * Ações sobre os lançamentos selecionados: marcar como pago, exportar para
 * Excel e excluir. Toda ação que grava pede confirmação com a contagem, porque
 * a lista por vencimento começa com tudo selecionado.
 */
export function BulkActionsBar({
  selectedCount,
  payableCount,
  deletableCount,
  skippedProposalCount,
  canEdit,
  canDelete,
  isBusy,
  onMarkPaid,
  onExport,
  onDelete,
}: BulkActionsBarProps) {
  const [confirm, setConfirm] = React.useState<"paid" | "delete" | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  if (selectedCount === 0) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div
        role="toolbar"
        aria-label="Ações nos lançamentos selecionados"
        className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <span className="text-sm text-muted-foreground">
          <strong className="font-semibold text-foreground">{selectedCount}</strong>{" "}
          {plural(selectedCount, "lançamento selecionado", "lançamentos selecionados")}
        </span>
        <div className="flex flex-wrap gap-2">
          {canEdit && payableCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              disabled={isBusy}
              onClick={() => setConfirm("paid")}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              Marcar como pago
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={isBusy || isExporting}
            onClick={() => void handleExport()}
          >
            {isExporting ? (
              <Loader size="sm" variant="button" className="mr-1.5" />
            ) : (
              <FileSpreadsheet className="mr-1.5 h-4 w-4" />
            )}
            Exportar Excel
          </Button>
          {canDelete && deletableCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              disabled={isBusy}
              onClick={() => setConfirm("delete")}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Excluir
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm === "paid"}
        onOpenChange={(open) => !open && !isBusy && setConfirm(null)}
        title={`Marcar ${payableCount} ${plural(payableCount, "lançamento", "lançamentos")} como ${plural(payableCount, "pago", "pagos")}?`}
        description="Os saldos das carteiras são atualizados. Lançamentos que já estavam pagos ficam como estão."
        confirmLabel="Marcar como pago"
        pendingLabel="Salvando..."
        isPending={isBusy}
        onConfirm={async () => {
          await onMarkPaid();
          setConfirm(null);
        }}
      />

      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Excluir ${deletableCount} ${plural(deletableCount, "lançamento", "lançamentos")}?`}
        description={
          <>
            Depois de excluir, você tem alguns segundos para desfazer.
            {skippedProposalCount > 0 && (
              <span className="mt-2 block">
                {skippedProposalCount}{" "}
                {plural(
                  skippedProposalCount,
                  "lançamento de proposta fica de fora: ele",
                  "lançamentos de proposta ficam de fora: eles",
                )}{" "}
                só sai revertendo a proposta para rascunho.
              </span>
            )}
          </>
        }
        confirmLabel="Excluir"
        destructive
        onConfirm={() => {
          setConfirm(null);
          onDelete();
        }}
      />
    </>
  );
}
