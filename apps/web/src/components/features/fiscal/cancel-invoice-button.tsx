"use client";

import * as React from "react";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { FiscalService, type FiscalInvoice } from "@/services/fiscal-service";
import { humanizeRejection } from "@/lib/fiscal/rejection-messages";
import { Loader } from "@/components/ui/loader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Cancelamento de nota autorizada.
 *
 * A justificativa não é burocracia nossa: o fisco exige entre 15 e 255
 * caracteres e a guarda junto do documento. Validar aqui evita uma ida ao
 * provedor para receber a mesma recusa.
 *
 * O prazo é do fisco, não nosso — 24h na maioria dos estados para NF-e, e por
 * município na NFS-e. Fora dele o cancelamento é recusado e o caminho correto
 * passa a ser uma nota de devolução ou substituição.
 */

const MIN = 15;
const MAX = 255;

interface CancelInvoiceButtonProps {
  invoice: FiscalInvoice;
  onCancelled: (invoice: FiscalInvoice) => void;
}

export function CancelInvoiceButton({ invoice, onCancelled }: CancelInvoiceButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [justificativa, setJustificativa] = React.useState("");
  const [isCancelling, setIsCancelling] = React.useState(false);

  const trimmed = justificativa.trim();
  const isValid = trimmed.length >= MIN && trimmed.length <= MAX;

  async function handleCancel() {
    if (!isValid) return;
    setIsCancelling(true);
    try {
      const updated = await FiscalService.cancelInvoice(invoice.id, trimmed);

      // Confere o estado que voltou em vez de confiar no 200. O backend agora
      // lança quando o fisco recusa, mas o toast não pode depender disso: dizer
      // "cancelada" sobre uma nota que continua valendo é a pior falha possível
      // aqui, porque o usuário para de procurar.
      if (updated.status !== "cancelled") {
        toast.error("O fisco não cancelou a nota.", {
          description: "Ela continua valendo. Verifique o prazo de cancelamento.",
        });
        return;
      }

      onCancelled(updated);
      setOpen(false);
      setJustificativa("");
      toast.success("Nota cancelada.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const humanized = humanizeRejection(undefined, message);
      toast.error(humanized.titulo, { description: humanized.explicacao });
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        title="Cancelar nota"
        onClick={() => setOpen(true)}
      >
        <XCircle className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar nota fiscal</DialogTitle>
            <DialogDescription>
              O cancelamento é definitivo e fica registrado no fisco junto com a
              justificativa. O prazo é definido pela prefeitura ou pela SEFAZ, 
              fora dele, o caminho é uma nota de devolução.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cancel-justificativa">Justificativa</Label>
            <Textarea
              id="cancel-justificativa"
              value={justificativa}
              maxLength={MAX}
              placeholder="Ex.: Nota emitida em duplicidade para o mesmo serviço."
              onChange={(e) => setJustificativa(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {trimmed.length < MIN
                ? `Faltam ${MIN - trimmed.length} caracteres — o fisco exige no mínimo ${MIN}.`
                : `${trimmed.length} de ${MAX} caracteres.`}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={!isValid || isCancelling}
              onClick={() => void handleCancel()}
            >
              {isCancelling && <Loader size="sm" variant="button" className="mr-2" />}
              Cancelar nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
