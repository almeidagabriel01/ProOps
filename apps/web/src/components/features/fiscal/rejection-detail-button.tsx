"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { humanizeRejection } from "@/lib/fiscal/rejection-messages";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Motivo da rejeição, em duas camadas.
 *
 * A mensagem do fisco é longa, sem tamanho previsível e escrita para um sistema
 * — cabia numa célula de tabela por acidente, não por desenho: ou era cortada no
 * meio de uma palavra, ou empurrava a linha e criava rolagem horizontal.
 *
 * Aqui a linha mostra só o veredito, e o motivo completo vive num diálogo. É o
 * que Bling e Omie fazem, e a razão é boa: quem está olhando a lista quer saber
 * *quais* notas falharam; quem vai resolver precisa do texto inteiro, com o
 * código, para pesquisar ou mandar ao contador.
 *
 * A mensagem crua continua acessível **na íntegra** — ela é o que o contador
 * pede e o que permite achar o erro. O que muda é onde ela mora.
 */

interface RejectionDetailButtonProps {
  code?: string;
  message?: string;
}

export function RejectionDetailButton({ code, message }: RejectionDetailButtonProps) {
  const [open, setOpen] = React.useState(false);
  const humanized = humanizeRejection(code, message);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <AlertTriangle className="h-3 w-3" />
        Ver motivo
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{humanized.titulo}</DialogTitle>
            {humanized.explicacao && (
              <DialogDescription>{humanized.explicacao}</DialogDescription>
            )}
          </DialogHeader>

          {humanized.original && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Resposta do fisco
              </p>
              {/* `break-words` e não `truncate`: aqui o texto inteiro é o ponto.
                  A rolagem fica DENTRO da caixa, nunca na página. */}
              <div className="max-h-48 overflow-y-auto rounded-md border bg-muted/40 p-3">
                <p className="font-mono text-xs leading-relaxed break-words">
                  {humanized.original}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Esse é o texto que o contador vai pedir.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
