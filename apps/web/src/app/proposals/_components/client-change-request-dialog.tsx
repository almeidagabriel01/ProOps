"use client";

import * as React from "react";
import { CheckCheck, MessageSquareWarning, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDateBR } from "@/utils/date-format";
import type { ClientChangeRequest } from "@/lib/client-acceptance";

interface ClientChangeRequestDialogProps {
  proposalTitle: string;
  request: ClientChangeRequest | null;
  /** Sem permissão de editar a proposta, o diálogo só informa. */
  canDecide: boolean;
  onClose: () => void;
  /** Abre a proposta para edição. Salvar com mudança resolve o pedido sozinho. */
  onEdit: () => void;
  /** Encerra o pedido sem mudar a proposta (conversou e não precisa ajustar). */
  onResolve: () => Promise<void>;
}

/** O que o cliente pediu para mudar, com o caminho para atender. */
export function ClientChangeRequestDialog({
  proposalTitle,
  request,
  canDecide,
  onClose,
  onEdit,
  onResolve,
}: ClientChangeRequestDialogProps) {
  const [busy, setBusy] = React.useState(false);

  const resolve = async () => {
    setBusy(true);
    try {
      await onResolve();
      onClose();
    } catch {
      // Quem chama já mostrou o erro; o diálogo fica aberto.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareWarning className="h-5 w-5 text-amber-600" />
            Pedido de mudanças
          </DialogTitle>
          <DialogDescription className="break-words">
            {request?.name || "O cliente"} pediu ajustes em &quot;{proposalTitle}&quot;
            {request ? ` em ${formatDateBR(request.requestedAt)}` : ""}.
          </DialogDescription>
        </DialogHeader>

        {request && (
          <blockquote className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/40 p-4 text-sm">
            {request.message}
          </blockquote>
        )}

        {canDecide ? (
          <>
            <p className="text-xs text-muted-foreground">
              Ao salvar a proposta com as mudanças, o pedido é dado como atendido e o
              cliente vê a nova versão no mesmo link.
            </p>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => void resolve()} disabled={busy}>
                <CheckCheck className="mr-2 h-4 w-4" />
                {busy ? "Encerrando..." : "Marcar como resolvido"}
              </Button>
              <Button onClick={onEdit} disabled={busy}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar proposta
              </Button>
            </DialogFooter>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Quem pode editar propostas atende ou encerra este pedido.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
