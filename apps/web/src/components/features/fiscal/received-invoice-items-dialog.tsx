"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ReceivedInvoice } from "@/services/received-invoice-service";

/**
 * Os produtos de uma nota de entrada confirmada.
 *
 * É o motivo pelo qual a recepção vale a pena para quem emite: o **NCM** é o
 * único campo fiscal sem default e sem derivação — CFOP sai da operação, CST do
 * regime, unidade do cadastro —, e a nota do fornecedor já o traz classificado
 * por quem foi obrigado a acertar para poder vender.
 *
 * Por isso o NCM tem botão de copiar e os demais campos não: ele é o que sai
 * daqui e vai para o cadastro do produto.
 */

function formatarValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface ReceivedInvoiceItemsDialogProps {
  invoice: ReceivedInvoice | null;
  onClose: () => void;
}

export function ReceivedInvoiceItemsDialog({
  invoice,
  onClose,
}: ReceivedInvoiceItemsDialogProps) {
  const [copiado, setCopiado] = React.useState<string | null>(null);

  async function copiarNcm(ncm: string) {
    try {
      await navigator.clipboard.writeText(ncm);
      setCopiado(ncm);
      // Confirmação no próprio botão em vez de toast: a pessoa está copiando
      // vários em sequência, e uma pilha de toasts atrapalharia.
      window.setTimeout(() => setCopiado(null), 1500);
    } catch {
      toast.error("Não foi possível copiar. Selecione o número e copie à mão.");
    }
  }

  const itens = invoice?.itens ?? [];

  return (
    <Dialog open={invoice !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Produtos desta nota</DialogTitle>
          <DialogDescription>
            {invoice?.emitenteNome || invoice?.emitenteCnpj}
            {invoice?.numero ? ` · nota ${invoice.numero}` : ""} — o NCM aqui é o
            mesmo que o cadastro do produto precisa para emitir.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto">
          {itens.map((item) => (
            <div
              key={`${item.numero}-${item.codigo ?? item.descricao}`}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">{item.descricao}</span>
                <span className="text-xs text-muted-foreground">
                  {item.quantidade} {item.unidade || "un"} ·{" "}
                  {formatarValor(item.valorUnitario)} ·{" "}
                  <strong className="font-medium text-foreground">
                    {formatarValor(item.valorTotal)}
                  </strong>
                  {item.cfop ? ` · CFOP ${item.cfop}` : ""}
                </span>
              </div>

              {item.ncm ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 gap-1.5 font-mono text-xs"
                  onClick={() => void copiarNcm(item.ncm!)}
                  title="Copiar NCM"
                >
                  {copiado === item.ncm ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {item.ncm}
                </Button>
              ) : (
                <span className="shrink-0 text-xs text-muted-foreground">
                  sem NCM
                </span>
              )}
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
