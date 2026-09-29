"use client";

import * as React from "react";
import { CheckCircle2, PencilLine, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDocumento } from "@/lib/format-document";
import { formatDateBR } from "@/utils/date-format";
import type { ClientAcceptance } from "@/lib/client-acceptance";
import { Loader } from "@/components/ui/loader";

interface ClientAcceptanceDialogProps {
  proposalTitle: string;
  acceptance: ClientAcceptance | null;
  /** Sem permissão de editar a proposta, o diálogo só informa. */
  canDecide: boolean;
  onClose: () => void;
  /** Leva a proposta para a coluna aprovada (lançamentos, Drive, nota). */
  onConfirm: () => Promise<void>;
  /** Descarta o aceite e abre a proposta para edição. */
  onAdjust: () => Promise<void>;
}

/**
 * Revisão do aceite que o cliente deu pelo link. Confirmar é aprovar a
 * proposta; ajustar descarta o aceite, e o cliente aceita de novo pelo mesmo
 * link depois da edição.
 */
export function ClientAcceptanceDialog({
  proposalTitle,
  acceptance,
  canDecide,
  onClose,
  onConfirm,
  onAdjust,
}: ClientAcceptanceDialogProps) {
  const [busy, setBusy] = React.useState<"confirm" | "adjust" | null>(null);

  const run = async (kind: "confirm" | "adjust") => {
    setBusy(kind);
    try {
      await (kind === "confirm" ? onConfirm() : onAdjust());
      onClose();
    } catch {
      // Quem chama já mostrou o erro; o diálogo fica aberto para tentar de novo.
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={acceptance !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
            Aceite do cliente
          </DialogTitle>
          <DialogDescription className="break-words">
            O cliente aceitou &quot;{proposalTitle}&quot; pelo link. Nada foi
            lançado ainda: confira a proposta e confirme a aprovação.
          </DialogDescription>
        </DialogHeader>

        {acceptance && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
            <dt className="text-muted-foreground">Nome</dt>
            <dd className="break-words font-medium">{acceptance.name}</dd>
            <dt className="text-muted-foreground">CPF/CNPJ</dt>
            <dd>{formatDocumento(acceptance.document)}</dd>
            <dt className="text-muted-foreground">Aceito em</dt>
            <dd>{formatDateBR(acceptance.acceptedAt)}</dd>
          </dl>
        )}

        {canDecide ? (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => void run("adjust")} disabled={busy !== null}>
              {busy === "adjust" && <Loader size="sm" variant="button" className="mr-2" />}
              <PencilLine className="mr-2 h-4 w-4" />
              {busy === "adjust" ? "Descartando..." : "Ajustar a proposta"}
            </Button>
            <Button onClick={() => void run("confirm")} disabled={busy !== null}>
              {busy === "confirm" && <Loader size="sm" variant="button" className="mr-2" />}
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {busy === "confirm" ? "Confirmando..." : "Confirmar aprovação"}
            </Button>
          </DialogFooter>
        ) : (
          <p className="text-sm text-muted-foreground">
            Quem pode editar propostas confirma ou ajusta este aceite.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
